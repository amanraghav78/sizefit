/**
 * The codec for web builds: canvas for pixels, blobs for bytes.
 *
 * The website is a real target, not a preview — everything happens in the
 * browser, so a file being compressed is never uploaded anywhere. It
 * implements the same `ImageCodec` port as the native codec, which is why
 * `src/core` runs completely unmodified in both places.
 *
 * Canvas also gives us one thing the native codec cannot do yet: alpha
 * flattening onto a solid background, so §5.3's white-background rule is
 * honoured here while it is still open on device.
 *
 * Known browser limits:
 * - HEIC/HEIF decodes in Safari but not in Chrome or Firefox, which have no
 *   HEIF decoder. An iPhone photo shared to a desktop Chrome user will fail to
 *   decode, and the user sees the "cannot read that file" error.
 * - Very large images are bounded by the browser's canvas limits rather than
 *   by device memory; the §5.3 4000px cap keeps normal photos well inside them.
 */
import { CorruptInputError } from '../core/errors';
import { HEAD_BYTES, detectFormat, hasMetadata } from '../core/sniff';
import type {
  EncodedImage,
  ImageCodec,
  ImageFormat,
  ProbeResult,
  RenderRequest,
} from '../core/types';

/** Batch runs walk several files, so more than one decode stays warm. */
const MAX_CACHED_SOURCES = 2;

export class WebImageCodec implements ImageCodec {
  private readonly sources = new Map<string, ImageBitmap>();
  private readonly blobs = new Map<string, Blob>();
  private readonly objectUrls: string[] = [];

  async probe(sourceUri: string): Promise<ProbeResult> {
    const blob = await fetchBlob(sourceUri);
    if (blob.size === 0) {
      throw new CorruptInputError('Source file is zero bytes');
    }

    const head = new Uint8Array(await blob.slice(0, HEAD_BYTES).arrayBuffer());
    const bitmap = await this.sourceBitmap(sourceUri, blob);

    return {
      width: bitmap.width,
      height: bitmap.height,
      bytes: blob.size,
      format: detectFormat(head),
      hasMetadata: hasMetadata(head),
    };
  }

  async render(req: RenderRequest): Promise<EncodedImage> {
    const bitmap = await this.sourceBitmap(req.sourceUri);

    const canvas = document.createElement('canvas');
    canvas.width = req.width;
    canvas.height = req.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('WebImageCodec: 2D canvas context unavailable');

    if (req.format === 'jpeg') {
      // §5.3: flatten transparency onto the requested background before encode.
      context.fillStyle = req.flattenBackground;
      context.fillRect(0, 0, req.width, req.height);
    }
    if (req.rotate === 0) {
      context.drawImage(bitmap, 0, 0, req.width, req.height);
    } else {
      // Rotate about the canvas centre. For a quarter turn the drawn box is
      // the canvas with its axes swapped, because req.width/height already
      // describe the rotated result.
      const quarter = req.rotate === 90 || req.rotate === 270;
      const drawWidth = quarter ? req.height : req.width;
      const drawHeight = quarter ? req.width : req.height;
      context.translate(req.width / 2, req.height / 2);
      context.rotate((req.rotate * Math.PI) / 180);
      context.drawImage(bitmap, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      context.setTransform(1, 0, 0, 1, 0, 0);
    }

    const blob = await canvasToBlob(canvas, req.format, req.quality / 100);
    const uri = this.hold(blob);
    return { uri, bytes: blob.size, width: req.width, height: req.height, quality: req.quality };
  }

  async readBytes(uri: string): Promise<Uint8Array> {
    const blob = this.blobs.get(uri) ?? (await fetchBlob(uri));
    return new Uint8Array(await blob.arrayBuffer());
  }

  async writeBytes(bytes: Uint8Array, format: ImageFormat): Promise<string> {
    const copy = new Uint8Array(bytes);
    return this.hold(new Blob([copy], { type: mimeFor(format) }));
  }

  async dispose(keepUri?: string): Promise<void> {
    for (const uri of this.objectUrls) {
      if (uri === keepUri) continue;
      URL.revokeObjectURL(uri);
      this.blobs.delete(uri);
    }
    this.objectUrls.length = 0;
    for (const bitmap of this.sources.values()) bitmap.close();
    this.sources.clear();
  }

  private async sourceBitmap(sourceUri: string, preloaded?: Blob): Promise<ImageBitmap> {
    const cached = this.sources.get(sourceUri);
    if (cached) {
      this.sources.delete(sourceUri);
      this.sources.set(sourceUri, cached);
      return cached;
    }

    const blob = preloaded ?? (await fetchBlob(sourceUri));
    let bitmap: ImageBitmap;
    try {
      // imageOrientation 'from-image' applies EXIF rotation, as §5.3 requires.
      bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch (error) {
      throw new CorruptInputError(`Cannot decode image: ${String(error)}`);
    }

    this.sources.set(sourceUri, bitmap);
    while (this.sources.size > MAX_CACHED_SOURCES) {
      const oldest = this.sources.keys().next();
      if (oldest.done) break;
      this.sources.get(oldest.value)?.close();
      this.sources.delete(oldest.value);
    }
    return bitmap;
  }

  private hold(blob: Blob): string {
    const uri = URL.createObjectURL(blob);
    this.blobs.set(uri, blob);
    this.objectUrls.push(uri);
    return uri;
  }
}

async function fetchBlob(uri: string): Promise<Blob> {
  try {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.blob();
  } catch (error) {
    throw new CorruptInputError(`Cannot read ${uri}: ${String(error)}`);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      mimeFor(format),
      quality,
    );
  });
}

function mimeFor(format: ImageFormat): string {
  return format === 'jpeg' ? 'image/jpeg' : 'image/png';
}
