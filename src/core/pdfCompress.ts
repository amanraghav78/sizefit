/**
 * PDF-to-target-size compression (design doc §7, the v1.1 item).
 *
 * `pdfBuilder.ts` makes a PDF out of images. This does the opposite job: it
 * takes a PDF that already exists — almost always a phone scan or a flatbed
 * scan of a form — and squeezes it under a byte ceiling.
 *
 * The technique, and its limits
 * -----------------------------
 * A scanned PDF is a thin container around one big JPEG per page. So the
 * document is not rasterised and no page is re-rendered; instead each image
 * XObject is pulled out, run back through the same codec port §5 uses, and
 * written into the object graph in place. Text, vectors and the page tree are
 * left exactly as they were, which is the whole point — the words stay sharp
 * and selectable while the photographic bulk shrinks.
 *
 * That also defines what this cannot do. A PDF whose weight is text, fonts or
 * vector art has nothing here to recompress, and comes back close to its
 * original size with `status: 'best_effort_over'` rather than a wrong promise.
 * Rasterising such a file would need a PDF renderer — a native module the
 * project does not carry, and it would turn selectable text into pixels.
 *
 * Pure: pdf-lib is plain JavaScript, so this file stays free of React Native
 * and is tested in Node against real scanner-shaped documents.
 */
import { PDFDocument, PDFName, PDFNumber, PDFRawStream, type PDFRef } from 'pdf-lib';
import { CancelledError, CorruptInputError, InvalidRequestError } from './errors';
import type { CompressStatus, ImageCodec } from './types';

/**
 * Rounds of rebuild-and-measure. Each round re-encodes every image in the
 * document, so this is the expensive dial: six rounds on a 20-page scan is
 * 120 encodes. The overshoot-driven step below is what keeps the usual case
 * to two or three.
 */
export const MAX_PDF_IMAGE_ROUNDS = 6;

/** Below this the page stops being readable; refuse to go further. */
export const MIN_IMAGE_EDGE = 200;

/** Quality ladder, walked only once scale has bottomed out. */
const QUALITY_LADDER = [80, 65, 50, 40, 30, 20];

/** Same soft floor as §5: without a lower bound, aim near the ceiling. */
const SOFT_FLOOR_RATIO = 0.85;

/** Leave the predictive step a little short of the mark; overshooting costs a round. */
const PREDICTION_SAFETY = 0.95;

export interface PdfCompressRequest {
  sourceUri: string;
  /** null = no lower bound. */
  minBytes: number | null;
  /** Hard ceiling for the finished document. Never exceeded. */
  maxBytes: number;
}

export interface PdfCompressOptions {
  signal?: AbortSignal;
  /** Background for flattening alpha when an image is re-encoded as JPEG. */
  flattenBackground?: string;
}

export interface PdfCompressResult {
  bytes: Uint8Array;
  finalBytes: number;
  pageCount: number;
  /** Image XObjects that were re-encoded. */
  imagesRecompressed: number;
  /**
   * Image XObjects left alone because they are not JPEG-coded — a bitmap mask,
   * a flate-coded scan, a JPEG 2000 page. Re-encoding those means decoding a
   * raw colour-space buffer, which the image codec port cannot accept.
   */
  imagesSkipped: number;
  rounds: number;
  status: CompressStatus;
  /** The document already fitted and carried no images worth touching. */
  passthrough: boolean;
}

/** One recompressible page image, located in the object graph. */
interface ImageSlot {
  ref: PDFRef;
  /** The original JPEG bytes, kept so every attempt re-encodes from source. */
  source: Uint8Array;
  width: number;
  height: number;
}

export async function compressPdf(
  request: PdfCompressRequest,
  codec: ImageCodec,
  options: PdfCompressOptions = {},
): Promise<PdfCompressResult> {
  validate(request);
  const { signal } = options;
  throwIfAborted(signal);

  const original = await codec.readBytes(request.sourceUri);
  if (original.length === 0) {
    throw new CorruptInputError('Source file is zero bytes');
  }

  const probe = await load(original);
  const pageCount = probe.getPageCount();
  const slots = collectJpegImages(probe);
  const imageXObjects = countImageXObjects(probe);
  const imagesSkipped = imageXObjects - slots.length;

  // Nothing photographic to shrink. Say so honestly rather than burning six
  // rounds re-saving a text document that will not move.
  if (slots.length === 0) {
    const rebuilt = await save(await load(original));
    const bytes = rebuilt.length <= original.length ? rebuilt : original;
    return {
      bytes,
      finalBytes: bytes.length,
      pageCount,
      imagesRecompressed: 0,
      imagesSkipped,
      rounds: 0,
      status: bytes.length <= request.maxBytes ? 'exact' : 'best_effort_over',
      passthrough: bytes === original,
    };
  }

  // §5.3's passthrough rule, applied to documents: already inside the band and
  // nothing to strip. A PDF always carries an /Info dictionary, so "nothing to
  // strip" is never true — the document is rewritten even when it fits, which
  // is what clears the producing scanner's name out of it (§10).
  const imageBytes = slots.reduce((sum, slot) => sum + slot.source.length, 0);
  const structureBytes = Math.max(0, original.length - imageBytes);

  // Structure alone blows the ceiling: no amount of image squeezing can win.
  // Still do one pass at the bottom of the ladder so the user gets the
  // smallest document this file can become.
  const hopeless = structureBytes >= request.maxBytes;

  let best: Attempt | null = null;
  let bestUnder: Attempt | null = null;
  let scale = 1;
  let qualityStep = 0;
  let rounds = 0;

  for (let round = 1; round <= MAX_PDF_IMAGE_ROUNDS; round += 1) {
    throwIfAborted(signal);
    rounds = round;
    const quality = QUALITY_LADDER[Math.min(qualityStep, QUALITY_LADDER.length - 1)]!;
    const attempt = await rebuild(original, slots, scale, quality, codec, options);
    best = smallest(best, attempt);

    if (attempt.bytes.length <= request.maxBytes) {
      bestUnder = larger(bestUnder, attempt);
      const floor = request.minBytes ?? Math.floor(request.maxBytes * SOFT_FLOOR_RATIO);
      if (attempt.bytes.length >= floor) {
        return done(attempt, pageCount, slots.length, imagesSkipped, round, 'exact');
      }
      // Under the floor: the last step overshot downward. There is no cheap way
      // back up that is worth another full rebuild of every page, so take it —
      // being comfortably under a ceiling is not a failure the way exceeding
      // one is.
      return done(
        attempt,
        pageCount,
        slots.length,
        imagesSkipped,
        round,
        request.minBytes === null ? 'exact' : 'best_effort_under',
      );
    }

    if (hopeless && qualityStep >= QUALITY_LADDER.length - 1 && scale <= minScale(slots)) {
      break;
    }

    // Predict the next scale from how far this attempt actually landed over,
    // charging the miss to the image bytes alone — the structure will not move.
    const imagePortion = Math.max(1, attempt.imageBytes);
    const budget = request.maxBytes - structureBytes;
    if (budget <= 0) {
      if (qualityStep >= QUALITY_LADDER.length - 1) break;
      qualityStep += 1;
      continue;
    }
    const predicted = Math.sqrt(budget / imagePortion) * PREDICTION_SAFETY;
    const next = scale * Math.min(predicted, 0.85);

    if (next < minScale(slots)) {
      // Pixels are at the floor; spend a quality step instead.
      scale = Math.max(next, minScale(slots));
      if (qualityStep >= QUALITY_LADDER.length - 1) break;
      qualityStep += 1;
    } else {
      scale = next;
    }
  }

  const winner = bestUnder ?? best!;
  return done(
    winner,
    pageCount,
    slots.length,
    imagesSkipped,
    rounds,
    winner.bytes.length <= request.maxBytes ? 'exact' : 'best_effort_over',
  );
}

interface Attempt {
  bytes: Uint8Array;
  imageBytes: number;
}

function done(
  attempt: Attempt,
  pageCount: number,
  recompressed: number,
  skipped: number,
  rounds: number,
  status: CompressStatus,
): PdfCompressResult {
  return {
    bytes: attempt.bytes,
    finalBytes: attempt.bytes.length,
    pageCount,
    imagesRecompressed: recompressed,
    imagesSkipped: skipped,
    rounds,
    status,
    passthrough: false,
  };
}

/**
 * One full attempt: re-encode every page image at the given scale and quality,
 * write them into a fresh copy of the object graph, and save.
 *
 * A fresh copy each time matters. Rewriting the same document repeatedly would
 * re-encode an already-encoded JPEG on every round and stack generation loss;
 * `slot.source` holds the original bytes so every attempt starts from them.
 */
async function rebuild(
  original: Uint8Array,
  slots: ImageSlot[],
  scale: number,
  quality: number,
  codec: ImageCodec,
  options: PdfCompressOptions,
): Promise<Attempt> {
  const doc = await load(original);
  let imageBytes = 0;

  for (const slot of slots) {
    throwIfAborted(options.signal);
    const width = Math.max(1, Math.round(slot.width * scale));
    const height = Math.max(1, Math.round(slot.height * scale));

    // Out to a temp file and back through the codec port, so this module never
    // needs to know what an encoder is.
    const sourceUri = await codec.writeBytes(slot.source, 'jpeg');
    const encoded = await codec.render({
      sourceUri,
      width,
      height,
      format: 'jpeg',
      quality,
      rotate: 0,
      flattenBackground: options.flattenBackground ?? '#FFFFFF',
    });
    const bytes = await codec.readBytes(encoded.uri);
    imageBytes += bytes.length;

    const target = doc.context.lookup(slot.ref);
    if (!(target instanceof PDFRawStream)) continue;
    const replacement = PDFRawStream.of(target.dict, bytes);
    // The dictionary is shared with the stream we are replacing, so these three
    // must be reset or the reader will trust stale numbers and render garbage.
    replacement.dict.set(PDFName.of('Length'), PDFNumber.of(bytes.length));
    replacement.dict.set(PDFName.of('Width'), PDFNumber.of(encoded.width));
    replacement.dict.set(PDFName.of('Height'), PDFNumber.of(encoded.height));
    doc.context.assign(slot.ref, replacement);
  }

  return { bytes: await save(doc), imageBytes };
}

/** §10: the document must say nothing about the device, the scanner or the person. */
async function save(doc: PDFDocument): Promise<Uint8Array> {
  doc.setCreator('');
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setProducer('');
  // Object streams save a fraction of a percent here and cost compatibility
  // with older readers, which is the wrong trade for a document someone is
  // about to upload to a government portal.
  return doc.save({ useObjectStreams: false });
}

async function load(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    // Scanner output is frequently a little out of spec; refusing to open a
    // file the user's own reader displays fine would be the wrong call.
    return await PDFDocument.load(bytes, { ignoreEncryption: false, throwOnInvalidObject: false });
  } catch (error) {
    throw new CorruptInputError(`Cannot read PDF: ${String(error)}`);
  }
}

/**
 * Every image XObject whose stream is a complete JPEG file.
 *
 * `/DCTDecode` means the stream bytes are literally a JPEG — that is what makes
 * this cheap. Anything else (flate-coded raw samples, JPX, CCITT fax, a 1-bit
 * stencil mask) would have to be decoded against its colour space first, so it
 * is counted and skipped.
 */
function collectJpegImages(doc: PDFDocument): ImageSlot[] {
  const slots: ImageSlot[] = [];
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    const dict = object.dict;
    if (dict.get(PDFName.of('Subtype'))?.toString() !== '/Image') continue;
    if (dict.get(PDFName.of('Filter'))?.toString() !== '/DCTDecode') continue;

    const width = asNumber(dict.get(PDFName.of('Width')));
    const height = asNumber(dict.get(PDFName.of('Height')));
    if (width === null || height === null || width < 1 || height < 1) continue;

    slots.push({ ref, source: object.contents, width, height });
  }
  return slots;
}

function countImageXObjects(doc: PDFDocument): number {
  let count = 0;
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    if (object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') count += 1;
  }
  return count;
}

/** The scale at which the smallest image in the document hits the edge floor. */
function minScale(slots: ImageSlot[]): number {
  let smallest = Infinity;
  for (const slot of slots) {
    const shortest = Math.min(slot.width, slot.height);
    smallest = Math.min(smallest, MIN_IMAGE_EDGE / shortest);
  }
  return Math.min(1, smallest === Infinity ? 1 : smallest);
}

function smallest(a: Attempt | null, b: Attempt): Attempt {
  return a === null || b.bytes.length < a.bytes.length ? b : a;
}

function larger(a: Attempt | null, b: Attempt): Attempt {
  return a === null || b.bytes.length > a.bytes.length ? b : a;
}

function asNumber(value: unknown): number | null {
  if (value instanceof PDFNumber) return value.asNumber();
  return null;
}

function validate(request: PdfCompressRequest): void {
  if (!request.sourceUri) {
    throw new InvalidRequestError('sourceUri is required');
  }
  if (!Number.isFinite(request.maxBytes) || request.maxBytes <= 0) {
    throw new InvalidRequestError('maxBytes must be a positive number');
  }
  if (request.minBytes !== null) {
    if (!Number.isFinite(request.minBytes) || request.minBytes < 0) {
      throw new InvalidRequestError('minBytes must be zero or more');
    }
    if (request.minBytes > request.maxBytes) {
      throw new InvalidRequestError('minBytes cannot exceed maxBytes');
    }
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new CancelledError();
}
