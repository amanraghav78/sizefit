/**
 * Image-to-PDF tests (§7) against real encoded images and a real encoder.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildPdf, buildSizedPdf } from '../src/core/pdfBuilder';
import type { CompressRequest } from '../src/core/types';
import { FIXTURE_DIR, generateFixtures } from './fixtures/generate';
import { SharpCodec } from './sharpCodec';

const KB = 1024;
const codec = new SharpCodec();

const imageRequest: Omit<CompressRequest, 'sourceUri'> = {
  minBytes: null,
  maxBytes: 100 * KB,
  targetWidth: null,
  targetHeight: null,
  format: 'jpeg',
  dimensionMode: 'preserve',
};

beforeAll(async () => {
  await generateFixtures();
});

function fixture(name: string): string {
  return join(FIXTURE_DIR, name);
}

describe('buildPdf', () => {
  it('makes a one-page PDF sized to the image', async () => {
    const jpeg = new Uint8Array(await readFile(fixture('already-small.jpg')));
    const pdf = await buildPdf([{ bytes: jpeg, format: 'jpeg' }]);

    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBe(1);
    const page = parsed.getPage(0);
    expect(Math.round(page.getWidth())).toBe(600);
    expect(Math.round(page.getHeight())).toBe(800);
  });

  it('adds one page per image, in order', async () => {
    const a = new Uint8Array(await readFile(fixture('already-small.jpg')));
    const b = new Uint8Array(await readFile(fixture('signature-scan.jpg')));
    const pdf = await buildPdf([
      { bytes: a, format: 'jpeg' },
      { bytes: b, format: 'jpeg' },
      { bytes: a, format: 'jpeg' },
    ]);

    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBe(3);
    expect(Math.round(parsed.getPage(1).getWidth())).toBe(1200);
  });

  it('embeds PNG pages too', async () => {
    const png = new Uint8Array(await readFile(fixture('screenshot-phone.png')));
    const pdf = await buildPdf([{ bytes: png, format: 'png' }]);
    expect(await PDFDocument.load(pdf).then((d) => d.getPageCount())).toBe(1);
  });

  it('centres images on A4 without enlarging them', async () => {
    const small = new Uint8Array(await readFile(fixture('signature-scan-small.jpg')));
    const pdf = await buildPdf([{ bytes: small, format: 'jpeg' }], { pageSize: 'a4' });

    const parsed = await PDFDocument.load(pdf);
    const page = parsed.getPage(0);
    expect(Math.round(page.getWidth())).toBe(595);
    expect(Math.round(page.getHeight())).toBe(842);
  });

  it('writes no identifying metadata', async () => {
    const jpeg = new Uint8Array(await readFile(fixture('already-small.jpg')));
    const pdf = await buildPdf([{ bytes: jpeg, format: 'jpeg' }]);

    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getCreator() ?? '').toBe('');
    expect(parsed.getTitle() ?? '').toBe('');
    expect(parsed.getAuthor() ?? '').toBe('');
    expect(parsed.getSubject() ?? '').toBe('');
    expect(parsed.getKeywords() ?? '').toBe('');

    // pdf-lib stamps its own attribution into Producer during save() and gives
    // no way to suppress it. That names the library, not the user — what must
    // never appear is anything identifying the device or the person.
    expect(parsed.getProducer() ?? '').toBe('pdf-lib (https://github.com/Hopding/pdf-lib)');
  });

  it('embeds bytes verbatim — metadata in, metadata out', async () => {
    // Documents the contract rather than a guarantee: embedding does not
    // re-encode, so a raw EXIF-bearing JPEG keeps its EXIF. This is why
    // buildSizedPdf (below) is the entry point the app uses.
    const withExif = new Uint8Array(await readFile(fixture('exif-gps-rotated.jpg')));
    const pdf = await buildPdf([{ bytes: withExif, format: 'jpeg' }]);
    expect(Buffer.from(pdf).toString('latin1')).toContain('FixtureCam');
  });

  it('refuses an empty document', async () => {
    await expect(buildPdf([])).rejects.toThrow(/at least one image/);
  });
});

describe('buildSizedPdf', () => {
  it('lands a multi-image PDF under the ceiling', async () => {
    const result = await buildSizedPdf(
      {
        sourceUris: [
          fixture('phone-photo-landscape.jpg'),
          fixture('phone-photo-portrait.jpg'),
          fixture('scanned-a4-300dpi.jpg'),
        ],
        imageRequest,
        maxPdfBytes: 300 * KB,
      },
      codec,
    );

    expect(result.status).toBe('exact');
    expect(result.bytes.length).toBeLessThanOrEqual(300 * KB);
    expect(result.perImage).toHaveLength(3);
    expect(await PDFDocument.load(result.bytes).then((d) => d.getPageCount())).toBe(3);
  });

  it('re-runs the image loop at a lower ceiling when the first build overshoots', async () => {
    // A tight ceiling for four photos: the first pass cannot fit, so §7's
    // rebuild loop has to kick in.
    const result = await buildSizedPdf(
      {
        sourceUris: [
          fixture('phone-photo-landscape.jpg'),
          fixture('phone-photo-portrait.jpg'),
          fixture('phone-photo-selfie.jpg'),
          fixture('square-passport.jpg'),
        ],
        imageRequest: { ...imageRequest, maxBytes: 500 * KB },
        maxPdfBytes: 120 * KB,
      },
      codec,
    );

    expect(result.bytes.length).toBeLessThanOrEqual(120 * KB);
    expect(result.status).toBe('exact');
  });

  it('holds the ceiling for a single large photo', async () => {
    const result = await buildSizedPdf(
      {
        sourceUris: [fixture('dslr-huge.jpg')],
        imageRequest,
        maxPdfBytes: 200 * KB,
      },
      codec,
    );
    expect(result.bytes.length).toBeLessThanOrEqual(200 * KB);
  });

  it('reports best_effort_over rather than returning an oversized PDF quietly', async () => {
    const result = await buildSizedPdf(
      {
        sourceUris: [fixture('phone-photo-landscape.jpg'), fixture('phone-photo-portrait.jpg')],
        // Unreachable: a JPEG page cannot be a few hundred bytes.
        maxPdfBytes: 900,
        imageRequest,
      },
      codec,
    );
    expect(result.status).toBe('best_effort_over');
    expect(result.bytes.length).toBeGreaterThan(900);
  });

  it('drops a minimum that no longer fits the shrinking per-image budget', async () => {
    // A 50KB floor cannot survive a 60KB PDF split across three images; the
    // document must still build rather than failing every page.
    const result = await buildSizedPdf(
      {
        sourceUris: [
          fixture('phone-photo-landscape.jpg'),
          fixture('signature-scan.jpg'),
          fixture('grayscale-photo.jpg'),
        ],
        imageRequest: { ...imageRequest, minBytes: 50 * KB },
        maxPdfBytes: 60 * KB,
      },
      codec,
    );
    expect(result.bytes.length).toBeLessThanOrEqual(60 * KB);
    expect(await PDFDocument.load(result.bytes).then((d) => d.getPageCount())).toBe(3);
  });

  it('strips EXIF and GPS from every page, because each image is re-encoded', async () => {
    const result = await buildSizedPdf(
      {
        sourceUris: [fixture('exif-gps-rotated.jpg'), fixture('phone-photo-landscape.jpg')],
        imageRequest,
        maxPdfBytes: 300 * KB,
      },
      codec,
    );

    // Acceptance test 7, extended to the PDF path.
    const text = Buffer.from(result.bytes).toString('latin1');
    expect(text).not.toContain('FixtureCam');
    expect(text).not.toContain('GPSLatitude');
    expect(text).not.toContain('SizeFit');
    expect(text).not.toContain('exif-gps-rotated');
  });

  it('refuses an empty source list', async () => {
    await expect(
      buildSizedPdf({ sourceUris: [], imageRequest, maxPdfBytes: 100 * KB }, codec),
    ).rejects.toThrow(/at least one image/);
  });
});
