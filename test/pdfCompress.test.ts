/**
 * PDF-to-target-size tests, against real scanner-shaped documents and a real
 * encoder.
 *
 * The documents under test are built from the image fixtures rather than
 * checked in, for the same reason the image fixtures are generated: a binary
 * blob in the repository is something nobody can review.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFName, PDFRawStream, StandardFonts, rgb } from 'pdf-lib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compressPdf } from '../src/core/pdfCompress';
import { detectFormat } from '../src/core/sniff';
import { CorruptInputError, EncryptedPdfError, InvalidRequestError } from '../src/core/errors';
import { FIXTURE_DIR, generateFixtures } from './fixtures/generate';
import { SharpCodec } from './sharpCodec';

const KB = 1024;
const codec = new SharpCodec();
let workDir: string;

beforeAll(async () => {
  await generateFixtures();
  workDir = await mkdtemp(join(tmpdir(), 'sizefit-pdf-'));
});

afterAll(async () => {
  await codec.dispose();
  await rm(workDir, { recursive: true, force: true });
});

/** A scan: one full-page JPEG per page, which is what a scanner app emits. */
async function makeScan(fixtureName: string, pages: number): Promise<string> {
  const jpeg = new Uint8Array(await readFile(join(FIXTURE_DIR, fixtureName)));
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) {
    const image = await doc.embedJpg(jpeg);
    const page = doc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const path = join(workDir, `scan-${fixtureName}-${pages}-${Date.now()}.pdf`);
  await writeFile(path, await doc.save({ useObjectStreams: false }));
  return path;
}

/** A text document: nothing photographic to recompress. */
async function makeTextPdf(pages: number): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i += 1) {
    const page = doc.addPage([595, 842]);
    for (let line = 0; line < 40; line += 1) {
      page.drawText(`Page ${i + 1}, line ${line + 1}: the quick brown fox jumps over it.`, {
        x: 48,
        y: 780 - line * 18,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }
  const path = join(workDir, `text-${pages}-${Date.now()}.pdf`);
  await writeFile(path, await doc.save({ useObjectStreams: false }));
  return path;
}

async function sizeOf(path: string): Promise<number> {
  return (await readFile(path)).length;
}

describe('detectFormat', () => {
  it('recognises a PDF header', async () => {
    const path = await makeScan('signature-scan.jpg', 1);
    const head = new Uint8Array(await readFile(path)).subarray(0, 64);
    expect(detectFormat(head)).toBe('pdf');
  });

  it('does not mistake a JPEG for a PDF', async () => {
    const jpeg = new Uint8Array(await readFile(join(FIXTURE_DIR, 'already-small.jpg')));
    expect(detectFormat(jpeg.subarray(0, 64))).toBe('jpeg');
  });
});

describe('compressPdf', () => {
  it('gets a multi-page scan under a hard ceiling', async () => {
    const path = await makeScan('scanned-a4-300dpi.jpg', 3);
    const before = await sizeOf(path);
    const result = await compressPdf({ sourceUri: path, minBytes: null, maxBytes: 300 * KB }, codec);

    expect(result.finalBytes).toBeLessThanOrEqual(300 * KB);
    expect(result.finalBytes).toBeLessThan(before);
    expect(result.status).toBe('exact');
    expect(result.pageCount).toBe(3);
    expect(result.imagesRecompressed).toBe(3);
  });

  it('never exceeds the ceiling across a range of targets', async () => {
    const path = await makeScan('scanned-a4-300dpi.jpg', 2);
    for (const target of [50, 100, 200, 500, 1024]) {
      const max = target * KB;
      const result = await compressPdf({ sourceUri: path, minBytes: null, maxBytes: max }, codec);
      expect(result.finalBytes, `target ${target}KB`).toBeLessThanOrEqual(max);
    }
  });

  it('honours a minimum as well as a maximum', async () => {
    const path = await makeScan('scanned-a4-300dpi.jpg', 2);
    const result = await compressPdf(
      { sourceUri: path, minBytes: 100 * KB, maxBytes: 300 * KB },
      codec,
    );
    expect(result.finalBytes).toBeLessThanOrEqual(300 * KB);
    if (result.status === 'exact') {
      expect(result.finalBytes).toBeGreaterThanOrEqual(100 * KB);
    }
  });

  it('produces a document that still opens and keeps its pages', async () => {
    const path = await makeScan('phone-photo-portrait.jpg', 4);
    const result = await compressPdf({ sourceUri: path, minBytes: null, maxBytes: 200 * KB }, codec);

    const reopened = await PDFDocument.load(result.bytes);
    expect(reopened.getPageCount()).toBe(4);
    // Page geometry is untouched: only the image inside each page shrinks.
    const original = await PDFDocument.load(await readFile(path));
    expect(reopened.getPage(0).getWidth()).toBeCloseTo(original.getPage(0).getWidth(), 1);
  });

  it('leaves every page image a valid JPEG after the rewrite', async () => {
    const path = await makeScan('scanned-a4-300dpi.jpg', 2);
    const result = await compressPdf({ sourceUri: path, minBytes: null, maxBytes: 150 * KB }, codec);

    const doc = await PDFDocument.load(result.bytes);
    let checked = 0;
    for (const [, object] of doc.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFRawStream)) continue;
      if (object.dict.get(PDFName.of('Subtype'))?.toString() !== '/Image') continue;
      const bytes = object.contents;
      // SOI ... EOI: a complete JPEG, not a truncated stream.
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes[bytes.length - 2]).toBe(0xff);
      expect(bytes[bytes.length - 1]).toBe(0xd9);
      // The dictionary must agree with the stream it now describes.
      expect(object.dict.get(PDFName.of('Length'))?.toString()).toBe(String(bytes.length));
      checked += 1;
    }
    expect(checked).toBe(2);
  });

  it('strips document metadata', async () => {
    const jpeg = new Uint8Array(await readFile(join(FIXTURE_DIR, 'exif-gps-rotated.jpg')));
    const doc = await PDFDocument.create();
    doc.setAuthor('Aman');
    doc.setTitle('Passport scan');
    doc.setCreator('SomeScannerApp 4.2');
    doc.setSubject('personal');
    doc.setKeywords(['passport', 'private']);
    const image = await doc.embedJpg(jpeg);
    const page = doc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    const path = join(workDir, `meta-${Date.now()}.pdf`);
    await writeFile(path, await doc.save({ useObjectStreams: false }));

    const result = await compressPdf({ sourceUri: path, minBytes: null, maxBytes: 100 * KB }, codec);
    const out = await PDFDocument.load(result.bytes);
    expect(out.getAuthor() ?? '').toBe('');
    expect(out.getTitle() ?? '').toBe('');
    expect(out.getSubject() ?? '').toBe('');
    expect(out.getKeywords() ?? '').toBe('');
    expect(out.getCreator() ?? '').toBe('');
  });

  it('reports best_effort_over for a text PDF it cannot shrink', async () => {
    const path = await makeTextPdf(3);
    const result = await compressPdf({ sourceUri: path, minBytes: null, maxBytes: 1 * KB }, codec);

    expect(result.imagesRecompressed).toBe(0);
    expect(result.status).toBe('best_effort_over');
    expect(result.pageCount).toBe(3);
  });

  it('passes a text PDF through when it already fits', async () => {
    const path = await makeTextPdf(1);
    const result = await compressPdf({ sourceUri: path, minBytes: null, maxBytes: 5 * 1024 * KB }, codec);
    expect(result.status).toBe('exact');
    expect(result.imagesRecompressed).toBe(0);
  });

  it('counts images it cannot recompress instead of silently dropping them', async () => {
    // A PNG embeds as FlateDecode, which this technique deliberately skips.
    const png = new Uint8Array(await readFile(join(FIXTURE_DIR, 'transparent-logo.png')));
    const jpeg = new Uint8Array(await readFile(join(FIXTURE_DIR, 'scanned-a4-300dpi.jpg')));
    const doc = await PDFDocument.create();
    const embeddedPng = await doc.embedPng(png);
    const embeddedJpg = await doc.embedJpg(jpeg);
    const page = doc.addPage([embeddedJpg.width, embeddedJpg.height]);
    page.drawImage(embeddedJpg, { x: 0, y: 0, width: embeddedJpg.width, height: embeddedJpg.height });
    page.drawImage(embeddedPng, { x: 0, y: 0, width: 200, height: 200 });
    const path = join(workDir, `mixed-${Date.now()}.pdf`);
    await writeFile(path, await doc.save({ useObjectStreams: false }));

    const result = await compressPdf({ sourceUri: path, minBytes: null, maxBytes: 200 * KB }, codec);
    expect(result.imagesRecompressed).toBeGreaterThanOrEqual(1);
    expect(result.imagesSkipped).toBeGreaterThanOrEqual(1);
  });

  it('can be cancelled', async () => {
    const path = await makeScan('dslr-huge.jpg', 2);
    const controller = new AbortController();
    controller.abort();
    await expect(
      compressPdf({ sourceUri: path, minBytes: null, maxBytes: 100 * KB }, codec, {
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it('rejects a nonsense request', async () => {
    const path = await makeScan('already-small.jpg', 1);
    await expect(
      compressPdf({ sourceUri: path, minBytes: null, maxBytes: 0 }, codec),
    ).rejects.toBeInstanceOf(InvalidRequestError);
    await expect(
      compressPdf({ sourceUri: path, minBytes: 200 * KB, maxBytes: 100 * KB }, codec),
    ).rejects.toBeInstanceOf(InvalidRequestError);
  });

  it('tells a password-protected PDF apart from a damaged one', async () => {
    // A protected file is not broken, so it must not come back as corrupt —
    // telling someone their bank statement is damaged sends them hunting for a
    // problem that does not exist.
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const clean = await doc.save({ useObjectStreams: false });
    const withEncryptEntry = Buffer.from(
      Buffer.from(clean).toString('latin1').replace('trailer\n<<', 'trailer\n<< /Encrypt 1 0 R'),
      'latin1',
    );
    const path = join(workDir, `locked-${Date.now()}.pdf`);
    await writeFile(path, withEncryptEntry);

    await expect(
      compressPdf({ sourceUri: path, minBytes: null, maxBytes: 100 * KB }, codec),
    ).rejects.toBeInstanceOf(EncryptedPdfError);
  });

  it('rejects a file that is not a PDF', async () => {
    const path = join(workDir, `notapdf-${Date.now()}.pdf`);
    await writeFile(path, 'this is not a pdf at all');
    await expect(
      compressPdf({ sourceUri: path, minBytes: null, maxBytes: 100 * KB }, codec),
    ).rejects.toBeInstanceOf(CorruptInputError);
  });
});
