/**
 * A deterministic in-memory ImageCodec for unit tests.
 *
 * It models the one property the algorithm actually relies on: encoded size
 * grows monotonically with both quality and pixel count. Real-image behaviour
 * is covered separately by the sharp-backed integration tests.
 */
import { CorruptInputError } from '../errors';
import type {
  EncodedImage,
  ImageCodec,
  ImageFormat,
  ProbeResult,
  RenderRequest,
} from '../types';

export interface FakeCodecConfig {
  width: number;
  height: number;
  /** Size of the source file on disk. */
  bytes: number;
  format: ProbeResult['format'];
  hasMetadata: boolean;
  /**
   * Bytes per pixel at a given JPEG quality. Must be monotonically increasing
   * in `quality`. Defaults to a curve roughly resembling a photo.
   */
  bytesPerPixel: (quality: number) => number;
  /** Bytes per pixel for lossless PNG output. */
  pngBytesPerPixel: number;
}

export interface RenderLogEntry {
  width: number;
  height: number;
  quality: number;
  format: ImageFormat;
  size: number;
  rotate: number;
}

const photoCurve = (quality: number): number => 0.015 + 0.3 * Math.pow(quality / 100, 1.7);

export class FakeCodec implements ImageCodec {
  readonly renders: RenderLogEntry[] = [];
  readonly writes: Uint8Array[] = [];
  disposed = false;
  private readonly config: FakeCodecConfig;
  private readonly files = new Map<string, Uint8Array>();
  private counter = 0;

  constructor(config: Partial<FakeCodecConfig> = {}) {
    this.config = {
      width: 3000,
      height: 4000,
      bytes: 4_200_000,
      format: 'jpeg',
      hasMetadata: true,
      bytesPerPixel: photoCurve,
      pngBytesPerPixel: 1.2,
      ...config,
    };
  }

  async probe(sourceUri: string): Promise<ProbeResult> {
    if (sourceUri === 'corrupt://empty') {
      throw new CorruptInputError('zero-byte file');
    }
    return {
      width: this.config.width,
      height: this.config.height,
      bytes: this.config.bytes,
      format: this.config.format,
      hasMetadata: this.config.hasMetadata,
    };
  }

  async render(req: RenderRequest): Promise<EncodedImage> {
    const pixels = req.width * req.height;
    const perPixel =
      req.format === 'png' ? this.config.pngBytesPerPixel : this.config.bytesPerPixel(req.quality);
    const size = Math.max(4, Math.round(pixels * perPixel));
    this.renders.push({
      width: req.width,
      height: req.height,
      quality: req.quality,
      format: req.format,
      size,
      rotate: req.rotate,
    });

    const uri = this.store(makeBytes(size, req.format), req.format);
    return { uri, bytes: size, width: req.width, height: req.height, quality: req.quality };
  }

  async readBytes(uri: string): Promise<Uint8Array> {
    const bytes = this.files.get(uri);
    if (!bytes) throw new Error(`FakeCodec: no such file ${uri}`);
    return bytes;
  }

  async writeBytes(bytes: Uint8Array, format: ImageFormat): Promise<string> {
    this.writes.push(bytes);
    return this.store(bytes, format);
  }

  async dispose(): Promise<void> {
    this.files.clear();
    this.disposed = true;
  }

  private store(bytes: Uint8Array, format: ImageFormat): string {
    this.counter += 1;
    const uri = `fake://out-${this.counter}.${format === 'jpeg' ? 'jpg' : 'png'}`;
    this.files.set(uri, bytes);
    return uri;
  }
}

/** Bytes with a plausible header so JPEG padding can operate on them. */
function makeBytes(size: number, format: ImageFormat): Uint8Array {
  const out = new Uint8Array(size);
  if (format === 'jpeg') {
    out[0] = 0xff;
    out[1] = 0xd8;
    out[size - 2] = 0xff;
    out[size - 1] = 0xd9;
  } else {
    out.set([0x89, 0x50, 0x4e, 0x47], 0);
  }
  return out;
}
