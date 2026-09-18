/**
 * An ImageCodec backed by sharp, for running the algorithm against real image
 * files in Node. Test-only: the app ships the expo-image-manipulator codec in
 * src/platform. It exists to prove the algorithm against real encoder
 * behaviour, which the fake codec cannot model.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { CorruptInputError } from '../src/core/errors';
import type {
  EncodedImage,
  ImageCodec,
  ImageFormat,
  ProbeResult,
  RenderRequest,
} from '../src/core/types';

export class SharpCodec implements ImageCodec {
  private outputDir: string | null = null;
  private counter = 0;

  async probe(sourceUri: string): Promise<ProbeResult> {
    let buffer: Buffer;
    try {
      buffer = await readFile(sourceUri);
    } catch (error) {
      throw new CorruptInputError(`Cannot read ${sourceUri}: ${String(error)}`);
    }
    if (buffer.length === 0) {
      throw new CorruptInputError('Source file is zero bytes');
    }

    try {
      const meta = await sharp(buffer).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      // EXIF orientation 5-8 swaps the axes; report what the user will see.
      const swapped = (meta.orientation ?? 1) >= 5;
      return {
        width: swapped ? height : width,
        height: swapped ? width : height,
        bytes: buffer.length,
        format: toProbeFormat(meta.format),
        hasMetadata: Boolean(meta.exif ?? meta.xmp ?? meta.icc ?? (meta.orientation ?? 1) !== 1),
      };
    } catch (error) {
      throw new CorruptInputError(`Cannot decode ${sourceUri}: ${String(error)}`);
    }
  }

  async render(req: RenderRequest): Promise<EncodedImage> {
    // Always re-encode from the original source: no generation loss across
    // search iterations.
    const pipeline = sharp(await readFile(req.sourceUri))
      .rotate() // applies EXIF orientation
      // Explicit rotation comes after the EXIF fix-up and before the resize,
      // because req.width/height describe the already-rotated image.
      .rotate(req.rotate)
      // 'cover' scales until the box is covered and crops the overflow, which
      // is how a named pixel size delivers its exact shape without squashing
      // the picture. 'fill' is the stretch the other modes already expect.
      .resize(req.width, req.height, {
        fit: req.fit === 'cover' ? 'cover' : 'fill',
        position: 'centre',
      });

    const buffer =
      req.format === 'jpeg'
        ? // flatten() drops alpha onto a solid background (§5.3); sharp strips all
          // metadata unless withMetadata() is called, which we never do (§10).
          await pipeline
            .flatten({ background: req.flattenBackground })
            .jpeg({ quality: req.quality, mozjpeg: true })
            .toBuffer()
        : await pipeline.png({ compressionLevel: 9 }).toBuffer();

    const uri = await this.persist(new Uint8Array(buffer), req.format);
    return {
      uri,
      bytes: buffer.length,
      width: req.width,
      height: req.height,
      quality: req.quality,
    };
  }

  async readBytes(uri: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(uri));
  }

  async writeBytes(bytes: Uint8Array, format: ImageFormat): Promise<string> {
    return this.persist(bytes, format);
  }

  async dispose(): Promise<void> {
    if (this.outputDir) {
      await rm(this.outputDir, { recursive: true, force: true });
      this.outputDir = null;
    }
  }

  private async persist(bytes: Uint8Array, format: ImageFormat): Promise<string> {
    this.outputDir ??= await mkdtemp(join(tmpdir(), 'sizefit-'));
    this.counter += 1;
    const path = join(this.outputDir, `out-${this.counter}.${format === 'jpeg' ? 'jpg' : 'png'}`);
    await writeFile(path, bytes);
    return path;
  }
}

function toProbeFormat(format: string | undefined): ProbeResult['format'] {
  if (format === 'jpeg' || format === 'jpg') return 'jpeg';
  if (format === 'png') return 'png';
  if (format === 'heif' || format === 'heic' || format === 'avif') return 'heic';
  return 'other';
}
