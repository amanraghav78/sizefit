/**
 * Core types for the exact-size compressor (design doc §5.1).
 *
 * Nothing in src/core may import React Native, Expo or any UI code. The
 * algorithm talks to the outside world only through the `ImageCodec` port
 * below, which is implemented once for the browser (canvas) and
 * once for the tests (sharp, in Node).
 */

export type ImageFormat = 'jpeg' | 'png';

export type DimensionMode = 'exact' | 'fill' | 'fit' | 'preserve';

export interface CompressRequest {
  sourceUri: string;
  /** null = no lower bound */
  minBytes: number | null;
  /** hard ceiling, never exceed */
  maxBytes: number;
  /** px, null = preserve */
  targetWidth: number | null;
  /** px, null = preserve */
  targetHeight: number | null;
  format: ImageFormat;
  dimensionMode: DimensionMode;
}

export type CompressStatus =
  /** landed inside [minBytes, maxBytes] */
  | 'exact'
  /** under the ceiling, but below the requested floor */
  | 'best_effort_under'
  /** could not get under the ceiling without breaking a hard constraint */
  | 'best_effort_over'
  /** no usable output at all */
  | 'failed';

export interface CompressResult {
  outputUri: string;
  finalBytes: number;
  finalWidth: number;
  finalHeight: number;
  finalQuality: number;
  iterations: number;
  status: CompressStatus;
  /**
   * True when the source already satisfied the request and was handed back
   * untouched (design doc §5.3, "images already inside the target band").
   * The UI uses this to say "no change was needed" instead of claiming work.
   */
  passthrough: boolean;
  /** Bytes of JPEG comment padding added by the §5 Step 4 floor fallback. */
  paddingBytes: number;
}

export interface ProbeResult {
  width: number;
  height: number;
  bytes: number;
  format: ImageFormat | 'heic' | 'pdf' | 'other';
  /**
   * True if the file carries EXIF/XMP/GPS metadata. A source that carries
   * metadata can never be passed through untouched — acceptance test 7
   * requires that no output file contains GPS data.
   */
  hasMetadata: boolean;
}

/** Quarter-turn rotation, applied before resizing. §3 allows crop and rotate. */
export type Rotation = 0 | 90 | 180 | 270;

export interface RenderRequest {
  sourceUri: string;
  width: number;
  height: number;
  format: ImageFormat;
  /** 1..100, ignored for PNG (lossless). */
  quality: number;
  /**
   * Clockwise rotation applied to the decoded source before resizing. The
   * width/height above already describe the rotated image, so a codec must
   * rotate first and resize second.
   */
  rotate: Rotation;
  /**
   * Background used to flatten alpha when encoding to JPEG (§5.3).
   * Ignored for PNG.
   */
  flattenBackground: string;
  /**
   * How to reconcile width/height with a source of a different aspect ratio.
   *
   * - `stretch` — squash the image into the box. Fast, and correct when the
   *   caller has already worked out aspect-correct dimensions.
   * - `cover`   — scale until the box is covered, then centre-crop the
   *   overflow. The output is exactly width×height with nothing distorted,
   *   at the cost of the edges.
   *
   * Required rather than defaulted: a codec that silently ignored it would
   * hand back the wrong shape, which is the bug this exists to fix.
   */
  fit: 'stretch' | 'cover';
}

/**
 * One encoded attempt, living in a temp file.
 *
 * The search only ever needs the SIZE of each attempt, so attempts stay on
 * disk: pulling four megabytes across the bridge eight times per compression
 * would cost more than the encoding itself. Bytes are read exactly once, for
 * the single candidate that wins.
 */
export interface EncodedImage {
  uri: string;
  bytes: number;
  width: number;
  height: number;
  quality: number;
}

/**
 * The port the algorithm needs from the platform.
 *
 * Contract every implementation must honour:
 * - `render` always re-encodes from the ORIGINAL source, never from a previous
 *   render, so repeated search iterations do not accumulate generation loss.
 * - `render` applies EXIF orientation and then strips ALL metadata, including
 *   GPS (§5.3, §10).
 * - `render` decodes HEIC/HEIF transparently; callers only ask for jpeg/png.
 * - `probe` throws `CorruptInputError` for unreadable or zero-byte input.
 * - Every uri handed out by `render` or `writeBytes` is a temp file the codec
 *   owns and cleans up in `dispose`, except the one returned as the result.
 */
export interface ImageCodec {
  probe(sourceUri: string): Promise<ProbeResult>;
  render(req: RenderRequest): Promise<EncodedImage>;
  /** Read an encoded attempt back. Used only by the §5 Step 4 padding path. */
  readBytes(uri: string): Promise<Uint8Array>;
  /** Persist bytes to a temp file and return its uri. Padding path only. */
  writeBytes(bytes: Uint8Array, format: ImageFormat): Promise<string>;
  /** Release temp files (§10: the cache must not grow without bound). */
  dispose(keepUri?: string): Promise<void>;
}

export interface CompressOptions {
  /** Cancels cleanly mid-search (§5.3, app backgrounded). */
  signal?: AbortSignal;
  /** Background for alpha flattening. Defaults to white. */
  flattenBackground?: string;
  /**
   * Quarter-turn rotation to apply before anything else. A 90 or 270 turn
   * swaps the source's width and height, which the dimension step accounts
   * for, so "fit inside 200x230" still means what the user expects.
   */
  rotate?: Rotation;
}
