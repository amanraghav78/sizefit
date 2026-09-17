/**
 * The ImageCodec the app runs on: expo-image-manipulator for pixels,
 * expo-file-system for bytes.
 *
 * Two things make this fast enough for a phone:
 *
 * 1. The source is decoded once into a native ImageRef and reused. Each
 *    dimension the search tries is resized once and cached, so the eight
 *    quality probes at that size are pure encodes - no decode, no resize.
 * 2. Encoded attempts stay in the cache directory. Only the winning file is
 *    ever read into JS, and only when the padding path needs it.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import { CorruptInputError } from '../core/errors';
import { HEAD_BYTES, detectFormat, hasMetadata } from '../core/sniff';
import type {
  EncodedImage,
  ImageCodec,
  ImageFormat,
  ProbeResult,
  RenderRequest,
} from '../core/types';

const WORK_DIR = 'sizefit-work';

/**
 * How many decoded sources to hold at once. Batch runs walk a list of images
 * one at a time, so a small cache keeps the current file (and its resizes)
 * warm without pinning a whole album's worth of bitmaps in memory.
 */
const MAX_CACHED_SOURCES = 2;

export class ExpoImageCodec implements ImageCodec {
  /** uri -> decoded source, in least-recently-used order. */
  private readonly sources = new Map<string, ImageRef>();
  /** "uri@WxH" -> resized render of that source. */
  private readonly resized = new Map<string, ImageRef>();
  private readonly temps: string[] = [];
  private counter = 0;

  async probe(sourceUri: string): Promise<ProbeResult> {
    const file = new File(sourceUri);
    if (!file.exists) {
      throw new CorruptInputError(`No file at ${sourceUri}`);
    }
    const bytes = file.size;
    if (bytes <= 0) {
      throw new CorruptInputError('Source file is zero bytes');
    }

    const head = readHead(file);
    const format = detectFormat(head);

    // Decoding here is not wasted work: the ref is cached and every render
    // below starts from it.
    const ref = await this.sourceRef(sourceUri);
    return {
      width: ref.width,
      height: ref.height,
      bytes,
      format,
      hasMetadata: hasMetadata(head),
    };
  }

  async render(req: RenderRequest): Promise<EncodedImage> {
    // GAP: expo-image-manipulator has no flatten operation on native, so
    // req.flattenBackground cannot be honoured here yet - a transparent PNG
    // saved as JPEG takes whatever the platform encoder fills alpha with.
    // Core covers the behaviour (§5.3); the device fix is a Phase 4 item.
    const resized = await this.resizedRef(req.sourceUri, req.width, req.height, req.rotate);
    const saved = await resized.saveAsync({
      compress: clampQuality(req.quality),
      format: req.format === 'png' ? SaveFormat.PNG : SaveFormat.JPEG,
    });
    this.temps.push(saved.uri);

    const size = new File(saved.uri).size;
    return {
      uri: saved.uri,
      bytes: size,
      width: saved.width,
      height: saved.height,
      quality: req.quality,
    };
  }

  async readBytes(uri: string): Promise<Uint8Array> {
    return new File(uri).bytes();
  }

  async writeBytes(bytes: Uint8Array, format: ImageFormat): Promise<string> {
    const file = new File(this.workDir(), `padded-${this.nextId()}.${extensionFor(format)}`);
    file.create({ overwrite: true });
    file.write(bytes);
    this.temps.push(file.uri);
    return file.uri;
  }

  /**
   * §10: clear the temp files. `keepUri` is the file being handed to the user,
   * which must survive until they have saved or shared it.
   */
  async dispose(keepUri?: string): Promise<void> {
    for (const uri of this.temps) {
      if (uri === keepUri) continue;
      try {
        const file = new File(uri);
        if (file.exists) file.delete();
      } catch {
        // A temp file we cannot delete is not worth failing the compression for.
      }
    }
    this.temps.length = 0;
    this.resized.clear();
    this.sources.clear();
  }

  private async sourceRef(sourceUri: string): Promise<ImageRef> {
    const cached = this.sources.get(sourceUri);
    if (cached) {
      // Refresh recency so the file being worked on is never the one evicted.
      this.sources.delete(sourceUri);
      this.sources.set(sourceUri, cached);
      return cached;
    }

    let ref: ImageRef;
    try {
      // NOTE: expo-image-manipulator applies EXIF orientation on load and
      // writes no metadata on save, which is what §5.3 and §10 require.
      // Verify both on a real device before shipping.
      ref = await ImageManipulator.manipulate(sourceUri).renderAsync();
    } catch (error) {
      throw new CorruptInputError(`Cannot decode ${sourceUri}: ${String(error)}`);
    }

    this.sources.set(sourceUri, ref);
    this.evictOldestSources();
    return ref;
  }

  /** Drop the least recently used sources, and any resizes belonging to them. */
  private evictOldestSources(): void {
    while (this.sources.size > MAX_CACHED_SOURCES) {
      const oldest = this.sources.keys().next();
      if (oldest.done) return;
      this.sources.delete(oldest.value);
      for (const key of [...this.resized.keys()]) {
        if (key.startsWith(`${oldest.value}@`)) this.resized.delete(key);
      }
    }
  }

  private async resizedRef(
    sourceUri: string,
    width: number,
    height: number,
    rotate: number,
  ): Promise<ImageRef> {
    const key = `${sourceUri}@${width}x${height}r${rotate}`;
    const cached = this.resized.get(key);
    if (cached) return cached;

    const source = await this.sourceRef(sourceUri);
    const unchanged = rotate === 0 && source.width === width && source.height === height;
    if (unchanged) {
      this.resized.set(key, source);
      return source;
    }

    // Rotate before resizing: width/height describe the rotated image.
    let context = ImageManipulator.manipulate(source);
    if (rotate !== 0) context = context.rotate(rotate);
    const ref = await context.resize({ width, height }).renderAsync();
    this.resized.set(key, ref);
    return ref;
  }

  private workDir(): Directory {
    const dir = new Directory(Paths.cache, WORK_DIR);
    if (!dir.exists) dir.create({ intermediates: true });
    return dir;
  }

  private nextId(): number {
    this.counter += 1;
    return this.counter;
  }
}

function readHead(file: File): Uint8Array {
  const handle = file.open();
  try {
    return handle.readBytes(Math.min(HEAD_BYTES, file.size));
  } finally {
    handle.close();
  }
}

/** expo-image-manipulator takes 0.0-1.0; the algorithm speaks 1-100. */
function clampQuality(quality: number): number {
  return Math.min(1, Math.max(0, quality / 100));
}

function extensionFor(format: ImageFormat): string {
  return format === 'jpeg' ? 'jpg' : 'png';
}
