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
    // Rotation is settled first, into an upright intermediate, so the crop
    // below can work in plain image coordinates. Doing both in one pass means
    // mapping a crop rectangle back through the rotation, which is easy to get
    // subtly wrong and impossible to see in a unit test.
    const quarter = req.rotate === 90 || req.rotate === 270;
    const sourceWidth = quarter ? bitmap.height : bitmap.width;
    const sourceHeight = quarter ? bitmap.width : bitmap.height;

    let source: CanvasImageSource = bitmap;
    if (req.rotate !== 0) {
      const upright = document.createElement('canvas');
      upright.width = sourceWidth;
      upright.height = sourceHeight;
      const uprightContext = upright.getContext('2d');
      if (!uprightContext) throw new Error('WebImageCodec: 2D canvas context unavailable');
      uprightContext.translate(sourceWidth / 2, sourceHeight / 2);
      uprightContext.rotate((req.rotate * Math.PI) / 180);
      uprightContext.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      source = upright;
    }

    if (req.fit === 'cover') {
      // Take the largest centred rectangle of the source that has the target's
      // aspect ratio, and let drawImage scale it to fill. Nothing is distorted;
      // the overflow on the long axis is what gets cut.
      const scale = Math.max(req.width / sourceWidth, req.height / sourceHeight);
      const cropWidth = Math.min(sourceWidth, req.width / scale);
      const cropHeight = Math.min(sourceHeight, req.height / scale);
      context.drawImage(
        source,
        (sourceWidth - cropWidth) / 2,
        (sourceHeight - cropHeight) / 2,
        cropWidth,
        cropHeight,
        0,
        0,
        req.width,
        req.height,
      );
    } else {
      context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, req.width, req.height);
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

  /**
   * Take a Blob or File the page already holds and return a uri the port
   * understands, owned and cleaned up by this codec like any other.
   *
   * The app reaches files through a picker that hands back a uri already. A
   * website gets a File object from an <input> or a drop event, and this is
   * the one step needed to feed it to the same engine.
   */
  stage(blob: Blob): string {
    return this.hold(blob);
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
