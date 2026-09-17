/**
 * Image-to-PDF assembly (design doc §7, v1 scope).
 *
 * This is NOT PDF compression — no page is rasterised or recompressed. Images
 * that have already been squeezed to the right size by §5 are embedded as-is,
 * so the PDF lands close to the sum of its images plus a small container
 * overhead. True PDF compression needs a native module and is explicitly v1.1.
 *
 * Pure: pdf-lib is plain JavaScript, so this file stays free of React Native
 * and can be tested in Node against real image bytes.
 */
import { PDFDocument, type PDFImage } from 'pdf-lib';
import { compress } from './compress';
import type { CompressRequest, CompressResult, ImageCodec, ImageFormat } from './types';

/**
 * One page's worth of already-encoded image.
 *
 * IMPORTANT: these bytes are embedded verbatim. Whatever metadata they carry —
 * EXIF, GPS, camera model — travels into the PDF with them, because embedding
 * does not re-encode. Callers must pass images that have been through
 * `compress`, which strips all of it (§5.3, §10). `buildSizedPdf` does exactly
 * that and is the safe entry point; raw `buildPdf` trusts its caller.
 */
export interface PdfSourceImage {
  bytes: Uint8Array;
  format: ImageFormat;
}

export interface BuildPdfOptions {
  /**
   * Page size. 'image' gives every page the exact pixel dimensions of its
   * image, which keeps the document faithful to what the user compressed.
   * 'a4' centres each image on a portrait A4 page, which is what a form
   * usually expects of a scanned document.
   */
  pageSize?: 'image' | 'a4';
  /** Margin in points, only meaningful for 'a4'. */
  marginPt?: number;
}

/** A4 at 72 dpi, in PDF points. */
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const DEFAULT_MARGIN_PT = 24;

export async function buildPdf(
  images: PdfSourceImage[],
  options: BuildPdfOptions = {},
): Promise<Uint8Array> {
  if (images.length === 0) {
    throw new Error('buildPdf: at least one image is required');
  }

  const pageSize = options.pageSize ?? 'image';
  const margin = options.marginPt ?? DEFAULT_MARGIN_PT;
  const doc = await PDFDocument.create();

  for (const image of images) {
    const embedded: PDFImage =
      image.format === 'png' ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);

    if (pageSize === 'image') {
      const page = doc.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      continue;
    }

    const page = doc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    const usableWidth = A4_WIDTH_PT - margin * 2;
    const usableHeight = A4_HEIGHT_PT - margin * 2;
    // Never enlarge: scaling a 140x60 signature to fill A4 would look absurd.
    const scale = Math.min(usableWidth / embedded.width, usableHeight / embedded.height, 1);
    const width = embedded.width * scale;
    const height = embedded.height * scale;
    page.drawImage(embedded, {
      x: (A4_WIDTH_PT - width) / 2,
      y: (A4_HEIGHT_PT - height) / 2,
      width,
      height,
    });
  }

  // §10: the document must say nothing about the device or the person. These
  // are blanked rather than left to inherit anything from the source images.
  //
  // pdf-lib overwrites Producer with its own attribution string during save()
  // and offers no way to suppress it. That is the library's name, not the
  // user's, so it is left alone — no filename, device, location or identity
  // reaches the output either way.
  doc.setCreator('');
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);

  return doc.save({ useObjectStreams: false });
}

export interface SizedPdfRequest {
  sourceUris: string[];
  /** The per-image target, minus the source. `maxBytes` here is the PDF's. */
  imageRequest: Omit<CompressRequest, 'sourceUri'>;
  /** Hard ceiling for the finished PDF. */
  maxPdfBytes: number;
  options?: BuildPdfOptions;
}

export interface SizedPdfResult {
  bytes: Uint8Array;
  perImage: CompressResult[];
  /** How many build attempts were needed. */
  rounds: number;
  status: 'exact' | 'best_effort_over';
}

/**
 * §7: build the PDF, and if it overshoots, re-run the image loop at a lower
 * ceiling and rebuild.
 *
 * The per-image budget starts at the PDF ceiling divided between the images,
 * with headroom for the container. If the finished document is still too big,
 * the budget is scaled by how far over it landed — the same measured-overshoot
 * approach the dimension fallback uses, for the same reason: a fixed step
 * wastes rounds.
 */
export const MAX_PDF_ROUNDS = 4;
/** The container costs a little; leave room for it from the start. */
const CONTAINER_HEADROOM = 0.92;

export async function buildSizedPdf(
  request: SizedPdfRequest,
  codec: ImageCodec,
): Promise<SizedPdfResult> {
  const { sourceUris, imageRequest, maxPdfBytes } = request;
  if (sourceUris.length === 0) {
    throw new Error('buildSizedPdf: at least one image is required');
  }

  let perImageBudget = Math.max(
    1024,
    Math.floor((maxPdfBytes * CONTAINER_HEADROOM) / sourceUris.length),
  );
  let best: { bytes: Uint8Array; perImage: CompressResult[] } | null = null;

  for (let round = 1; round <= MAX_PDF_ROUNDS; round += 1) {
    const perImage: CompressResult[] = [];
    const pages: PdfSourceImage[] = [];

    for (const sourceUri of sourceUris) {
      const result = await compress(
        {
          ...imageRequest,
          sourceUri,
          maxBytes: perImageBudget,
          // A floor that no longer fits inside the shrinking budget would make
          // every image unsatisfiable; drop it rather than fail the document.
          minBytes:
            imageRequest.minBytes !== null && imageRequest.minBytes < perImageBudget
              ? imageRequest.minBytes
              : null,
        },
        codec,
      );
      perImage.push(result);
      pages.push({
        bytes: await codec.readBytes(result.outputUri),
        format: imageRequest.format,
      });
    }

    const bytes = await buildPdf(pages, request.options ?? {});
    best = { bytes, perImage };

    if (bytes.length <= maxPdfBytes) {
      return { bytes, perImage, rounds: round, status: 'exact' };
    }

    const overshoot = bytes.length / maxPdfBytes;
    const next = Math.floor((perImageBudget / overshoot) * 0.9);
    if (next >= perImageBudget || next < 1024) break; // no longer converging
    perImageBudget = next;
  }

  // Never silently return an over-limit file (§5 Step 5).
  return {
    bytes: best!.bytes,
    perImage: best!.perImage,
    rounds: MAX_PDF_ROUNDS,
    status: 'best_effort_over',
  };
}
