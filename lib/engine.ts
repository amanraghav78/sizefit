/**
 * The bridge between the website and the engine.
 *
 * Everything below `../src/core` is plain TypeScript with no React Native and
 * no Expo imports — that was a deliberate constraint from the start, and this
 * file is what it buys: the website runs the *same* compression algorithm as
 * the test suite does, with no second implementation to keep in step.
 *
 * What the website supplies is the other half of the port: a codec built on
 * canvas and Blob. The test suite's `sharpCodec` is the other implementation of
 * the same interface, which is how the algorithm can be proved against real
 * photographs in Node and still ship to a browser unchanged.
 */
import { compress } from '../src/core/compress';
import { CompressError } from '../src/core/errors';
import { detectFormat } from '../src/core/sniff';
import type {
  CompressRequest,
  CompressResult,
  DimensionMode,
  ImageFormat,
} from '../src/core/types';
import { WebImageCodec } from '../src/platform/webImageCodec';

export type { CompressRequest, CompressResult, DimensionMode, ImageFormat };
export { detectFormat, CompressError };

export const KB = 1024;

export interface SizeTarget {
  minKB: number | null;
  maxKB: number;
  widthPx: number | null;
  heightPx: number | null;
  dimensionMode: DimensionMode;
  format: ImageFormat;
}

export interface ImageOutcome {
  name: string;
  sourceBytes: number;
  result: CompressResult | null;
  /** Object URL of the finished file, ready to download. */
  url: string | null;
  error: string | null;
}

/**
 * Compress one or more images, each to its own target.
 *
 * Files are done one at a time on purpose. The codec keeps a decoded bitmap
 * warm for the file it is working on, and several full-size bitmaps at once is
 * how a browser tab runs out of memory on a phone.
 */
export async function compressImages(
  files: File[],
  target: SizeTarget,
  options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<ImageOutcome[]> {
  const codec = new WebImageCodec();
  const outcomes: ImageOutcome[] = [];

  try {
    for (const [index, file] of files.entries()) {
      try {
        const sourceUri = codec.stage(file);
        const request: CompressRequest = {
          sourceUri,
          minBytes: target.minKB === null ? null : Math.round(target.minKB * KB),
          maxBytes: Math.round(target.maxKB * KB),
          targetWidth: target.widthPx,
          targetHeight: target.heightPx,
          format: target.format,
          dimensionMode: target.dimensionMode,
        };
        const result = await compress(request, codec, { signal: options.signal });
        const bytes = await codec.readBytes(result.outputUri);
        outcomes.push({
          name: file.name,
          sourceBytes: file.size,
          result,
          url: URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeFor(target.format) })),
          error: null,
        });
      } catch (cause) {
        // One unreadable file must not sink the whole selection.
        outcomes.push({
          name: file.name,
          sourceBytes: file.size,
          result: null,
          url: null,
          error: explain(cause),
        });
      }
      options.onProgress?.(index + 1, files.length);
    }
  } finally {
    // The object URLs handed back above are owned by the caller now; the
    // codec's own scratch URLs are not, and go here.
    await codec.dispose();
  }

  return outcomes;
}

export function mimeFor(format: ImageFormat): string {
  return format === 'png' ? 'image/png' : 'image/jpeg';
}

/** Turn a thrown engine error into a sentence a visitor can act on. */
export function explain(cause: unknown): string {
  if (cause instanceof CompressError) {
    switch (cause.code) {
      case 'corrupt_input':
        return 'That file could not be read. It may be damaged, or in a format this browser cannot open.';
      case 'encrypted_pdf':
        return 'That PDF is password-protected, so it cannot be opened here. Remove the password in your PDF reader and try again.';
      case 'invalid_request':
        return `Those settings do not work: ${cause.message}`;
      case 'cancelled':
        return 'Cancelled.';
      default:
        return cause.message;
    }
  }
  return String(cause);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function downloadBlobUrl(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** "photo.jpg" + "jpeg" -> "photo-sizefit.jpg" */
export function outputName(original: string, format: ImageFormat): string {
  const stem = original.replace(/\.[^.]+$/, '') || 'image';
  return `${stem}-sizefit.${format === 'png' ? 'png' : 'jpg'}`;
}
