/**
 * The PDF half of the engine, kept in its own module on purpose.
 *
 * pdf-lib is ~185KB of JavaScript. Importing it from `engine.ts` pulled it
 * into every page that touched the engine at all, so the image compressor —
 * the page most people will land on — was shipping a PDF library it never
 * calls. The PDF tools import this lazily, at the moment the button is
 * pressed, which keeps it off every other page entirely.
 */
import { buildSizedPdf } from '../src/core/pdfBuilder';
import { compressPdf } from '../src/core/pdfCompress';
import { WebImageCodec } from '../src/platform/webImageCodec';
import { KB } from './engine';

export interface PdfOutcome {
  url: string;
  bytes: number;
  pageCount: number;
  imagesRecompressed: number;
  imagesSkipped: number;
  status: string;
  overLimit: boolean;
}

/** Shrink an existing PDF to a byte ceiling. */
export async function compressExistingPdf(
  file: File,
  maxKB: number,
  minKB: number | null,
  options: { signal?: AbortSignal } = {},
): Promise<PdfOutcome> {
  const codec = new WebImageCodec();
  try {
    const sourceUri = codec.stage(file);
    const maxBytes = Math.round(maxKB * KB);
    const outcome = await compressPdf(
      {
        sourceUri,
        minBytes: minKB === null ? null : Math.round(minKB * KB),
        maxBytes,
      },
      codec,
      options.signal ? { signal: options.signal } : {},
    );
    return {
      url: URL.createObjectURL(new Blob([outcome.bytes as BlobPart], { type: 'application/pdf' })),
      bytes: outcome.finalBytes,
      pageCount: outcome.pageCount,
      imagesRecompressed: outcome.imagesRecompressed,
      imagesSkipped: outcome.imagesSkipped,
      status: outcome.status,
      overLimit: outcome.finalBytes > maxBytes,
    };
  } finally {
    await codec.dispose();
  }
}

/** Assemble images into one PDF that lands under a ceiling. */
export async function imagesToPdf(
  files: File[],
  maxKB: number,
  pageSize: 'image' | 'a4',
): Promise<PdfOutcome> {
  const codec = new WebImageCodec();
  try {
    const sourceUris: string[] = [];
    for (const file of files) sourceUris.push(codec.stage(file));

    const maxBytes = Math.round(maxKB * KB);
    const outcome = await buildSizedPdf(
      {
        sourceUris,
        imageRequest: {
          minBytes: null,
          maxBytes,
          targetWidth: null,
          targetHeight: null,
          format: 'jpeg',
          dimensionMode: 'preserve',
        },
        maxPdfBytes: maxBytes,
        options: { pageSize },
      },
      codec,
    );
    return {
      url: URL.createObjectURL(new Blob([outcome.bytes as BlobPart], { type: 'application/pdf' })),
      bytes: outcome.bytes.length,
      pageCount: files.length,
      imagesRecompressed: files.length,
      imagesSkipped: 0,
      status: outcome.status,
      overLimit: outcome.bytes.length > maxBytes,
    };
  } finally {
    await codec.dispose();
  }
}
