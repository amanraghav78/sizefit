/**
 * The exact-size compression algorithm (design doc §5).
 *
 * Pure: no React Native, no Expo, no file-system access of its own. Everything
 * platform-specific goes through the `ImageCodec` port.
 *
 * The one rule that outranks everything else: the output must never exceed
 * `maxBytes`. A file one byte over is a failed upload.
 */
import {
  MAX_DOWNSCALE_ROUNDS,
  MAX_INPUT_EDGE,
  MAX_UPSCALE_ROUNDS,
  downscaleRound,
  longestEdge,
  predictiveDownscale,
  resolveTargetDimensions,
  sameDimensions,
  upscaleRound,
  type Dimensions,
} from './dimensions';
import { CancelledError, CorruptInputError, InvalidRequestError } from './errors';
import { padJpegToSize, planPaddedSize } from './jpegPadding';
import type {
  CompressOptions,
  CompressRequest,
  CompressResult,
  CompressStatus,
  EncodedImage,
  ImageCodec,
} from './types';

/** §5 Step 2: eight probes converge on the 1-100 range with room to spare. */
export const MAX_QUALITY_ITERATIONS = 8;

/**
 * When the caller gives no lower bound, an early exit would happily return a
 * 20KB file for a 50KB ceiling - technically passing, visibly worse. We keep
 * searching upward against a soft floor instead. It only ever raises quality;
 * the hard ceiling is still the hard ceiling.
 */
export const SOFT_FLOOR_RATIO = 0.85;

const DEFAULT_FLATTEN_BACKGROUND = '#FFFFFF';

interface Candidate {
  image: EncodedImage;
  size: number;
  dims: Dimensions;
  quality: number;
}

interface RoundResult {
  inBand: Candidate | null;
  bestUnder: Candidate | null;
  smallestOver: Candidate | null;
}

export async function compress(
  request: CompressRequest,
  codec: ImageCodec,
  options: CompressOptions = {},
): Promise<CompressResult> {
  validate(request);

  const signal = options.signal;
  const flattenBackground = options.flattenBackground ?? DEFAULT_FLATTEN_BACKGROUND;
  const rotate = options.rotate ?? 0;
  throwIfAborted(signal);

  const probe = await codec.probe(request.sourceUri);
  if (probe.bytes <= 0 || probe.width <= 0 || probe.height <= 0) {
    throw new CorruptInputError('Source file is empty or unreadable');
  }

  // A quarter turn swaps the axes, so every downstream decision — target
  // dimensions, fit box, downscale rounds — works from the rotated shape.
  const quarterTurned = rotate === 90 || rotate === 270;
  const source: Dimensions = quarterTurned
    ? { width: probe.height, height: probe.width }
    : { width: probe.width, height: probe.height };
  const baseDims = resolveTargetDimensions({
    source,
    targetWidth: request.targetWidth,
    targetHeight: request.targetHeight,
    mode: request.dimensionMode,
  });

  // §5.3: already inside the band, right dimensions, right format, and no
  // metadata to strip - hand the original back and say nothing was needed.
  if (
    rotate === 0 &&
    request.format === probe.format &&
    !probe.hasMetadata &&
    sameDimensions(source, baseDims) &&
    withinBand(probe.bytes, request)
  ) {
    return {
      outputUri: request.sourceUri,
      finalBytes: probe.bytes,
      finalWidth: source.width,
      finalHeight: source.height,
      finalQuality: 100,
      iterations: 0,
      status: 'exact',
      passthrough: true,
      paddingBytes: 0,
    };
  }

  let iterations = 0;
  const encode = async (dims: Dimensions, quality: number): Promise<Candidate> => {
    throwIfAborted(signal);
    const image = await codec.render({
      sourceUri: request.sourceUri,
      width: dims.width,
      height: dims.height,
      format: request.format,
      quality,
      flattenBackground,
      rotate,
      // 'fill' is the only mode that asks the codec to crop; every other mode
      // has already resolved to aspect-correct dimensions, so stretching is a
      // no-op for them.
      fit: request.dimensionMode === 'fill' ? 'cover' : 'stretch',
    });
    iterations += 1;
    return { image, size: image.bytes, dims, quality };
  };

  // Held in an object rather than two `let`s: they are written from inside
  // runRound, which would otherwise confuse control-flow narrowing.
  const best: { under: Candidate | null; over: Candidate | null } = { under: null, over: null };

  const runRound = async (dims: Dimensions): Promise<RoundResult> => {
    const round =
      request.format === 'png'
        ? await losslessRound(dims, request, encode)
        : await qualitySearch(dims, request, encode);
    best.under = pickLarger(best.under, round.bestUnder);
    best.over = pickSmaller(best.over, round.smallestOver);
    return round;
  };

  // §5 Steps 2 and 3: quality search, then downscale rounds if even the lowest
  // quality cannot fit under the ceiling.
  let dims = baseDims;
  let downscales = 0;
  for (;;) {
    const round = await runRound(dims);
    if (round.inBand) {
      return result(round.inBand, round.inBand.image.uri, round.inBand.size, 'exact', iterations, 0);
    }
    if (round.bestUnder !== null) break; // under the ceiling but below the floor

    // 'exact' and 'fill' both promise a specific pixel size, so the downscale
    // fallback is not available to them — shrinking would break the promise the
    // user selected.
    if (request.dimensionMode === 'exact' || request.dimensionMode === 'fill') break;
    if (downscales >= MAX_DOWNSCALE_ROUNDS) break;
    const overshoot = round.smallestOver;
    const next =
      overshoot === null
        ? downscaleRound(dims)
        : predictiveDownscale(dims, overshoot.size, request.maxBytes);
    if (next === null) break;
    dims = next;
    downscales += 1;
  }

  // §5 Step 4: below the floor. Try growing the image, then pad.
  const under = best.under;
  if (under !== null && request.minBytes !== null && under.size < request.minBytes) {
    if (request.dimensionMode !== 'exact' && request.dimensionMode !== 'fill') {
      const bound = fitBound(request);
      let current = under.dims;
      for (let i = 0; i < MAX_UPSCALE_ROUNDS; i += 1) {
        const next = upscaleRound(current, bound);
        if (next === null || longestEdge(next) > MAX_INPUT_EDGE) break;
        const round = await runRound(next);
        if (round.inBand) {
          return result(round.inBand, round.inBand.image.uri, round.inBand.size, 'exact', iterations, 0);
        }
        current = next;
      }
    }

    const candidate = best.under;
    if (candidate !== null && candidate.size < request.minBytes && request.format === 'jpeg') {
      const paddedSize = planPaddedSize(candidate.size, request.minBytes);
      if (paddedSize !== null && paddedSize <= request.maxBytes) {
        // The only point in the whole run where encoded bytes enter JS.
        const raw = await codec.readBytes(candidate.image.uri);
        const padded = padJpegToSize(raw, paddedSize);
        const outputUri = await codec.writeBytes(padded, request.format);
        return result(candidate, outputUri, padded.length, 'exact', iterations, padded.length - candidate.size);
      }
    }
  }

  const finalUnder = best.under;
  if (finalUnder !== null) {
    const status: CompressStatus = withinBand(finalUnder.size, request)
      ? 'exact'
      : 'best_effort_under';
    return result(finalUnder, finalUnder.image.uri, finalUnder.size, status, iterations, 0);
  }

  const finalOver = best.over;
  if (finalOver !== null) {
    // Nothing fit under the ceiling. We return the closest attempt, clearly
    // flagged - §5 Step 5: never silently hand back an over-limit file.
    return result(finalOver, finalOver.image.uri, finalOver.size, 'best_effort_over', iterations, 0);
  }

  return {
    outputUri: '',
    finalBytes: 0,
    finalWidth: 0,
    finalHeight: 0,
    finalQuality: 0,
    iterations,
    status: 'failed',
    passthrough: false,
    paddingBytes: 0,
  };
}

/** §5 Step 2 - binary search on JPEG quality at fixed dimensions. */
async function qualitySearch(
  dims: Dimensions,
  request: CompressRequest,
  encode: (dims: Dimensions, quality: number) => Promise<Candidate>,
): Promise<RoundResult> {
  const floor = effectiveFloor(request);
  let lo = 1;
  let hi = 100;
  let bestUnder: Candidate | null = null;
  let smallestOver: Candidate | null = null;

  for (let i = 0; i < MAX_QUALITY_ITERATIONS && lo <= hi; i += 1) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = await encode(dims, mid);

    if (candidate.size > request.maxBytes) {
      smallestOver = pickSmaller(smallestOver, candidate);
      hi = mid - 1;
      continue;
    }

    bestUnder = pickLarger(bestUnder, candidate);
    if (candidate.size < floor) {
      lo = mid + 1; // too small, push quality up
    } else {
      return { inBand: candidate, bestUnder, smallestOver };
    }
  }

  // The search may have ended on a candidate that satisfies the *requested*
  // floor even though it missed the soft floor. That still counts as a hit.
  if (bestUnder !== null && withinBand(bestUnder.size, request)) {
    return { inBand: bestUnder, bestUnder, smallestOver };
  }
  return { inBand: null, bestUnder, smallestOver };
}

/**
 * PNG is lossless, so quality is not a lever: there is exactly one size per
 * set of dimensions. Size is steered by the dimension fallback instead.
 */
async function losslessRound(
  dims: Dimensions,
  request: CompressRequest,
  encode: (dims: Dimensions, quality: number) => Promise<Candidate>,
): Promise<RoundResult> {
  const candidate = await encode(dims, 100);
  if (candidate.size > request.maxBytes) {
    return { inBand: null, bestUnder: null, smallestOver: candidate };
  }
  if (withinBand(candidate.size, request)) {
    return { inBand: candidate, bestUnder: candidate, smallestOver: null };
  }
  return { inBand: null, bestUnder: candidate, smallestOver: null };
}

function result(
  candidate: Candidate,
  outputUri: string,
  finalBytes: number,
  status: CompressStatus,
  iterations: number,
  paddingBytes: number,
): CompressResult {
  return {
    outputUri,
    finalBytes,
    finalWidth: candidate.dims.width,
    finalHeight: candidate.dims.height,
    finalQuality: candidate.quality,
    iterations,
    status,
    passthrough: false,
    paddingBytes,
  };
}

function withinBand(size: number, request: CompressRequest): boolean {
  if (size > request.maxBytes) return false;
  if (request.minBytes !== null && size < request.minBytes) return false;
  return true;
}

/** The floor the search aims at: the requested one, or a soft quality floor. */
function effectiveFloor(request: CompressRequest): number {
  if (request.minBytes !== null) return request.minBytes;
  return Math.floor(request.maxBytes * SOFT_FLOOR_RATIO);
}

/** In `fit` mode an upscale must still fit inside the requested box. */
function fitBound(request: CompressRequest): Dimensions | null {
  if (request.dimensionMode !== 'fit') return null;
  if (request.targetWidth === null && request.targetHeight === null) return null;
  return {
    width: request.targetWidth ?? Number.POSITIVE_INFINITY,
    height: request.targetHeight ?? Number.POSITIVE_INFINITY,
  };
}

function pickLarger(a: Candidate | null, b: Candidate | null): Candidate | null {
  if (a === null) return b;
  if (b === null) return a;
  return b.size > a.size ? b : a;
}

function pickSmaller(a: Candidate | null, b: Candidate | null): Candidate | null {
  if (a === null) return b;
  if (b === null) return a;
  return b.size < a.size ? b : a;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new CancelledError();
}

function validate(request: CompressRequest): void {
  if (!request.sourceUri) {
    throw new InvalidRequestError('sourceUri is required');
  }
  if (!Number.isFinite(request.maxBytes) || request.maxBytes <= 0) {
    throw new InvalidRequestError('maxBytes must be a positive number of bytes');
  }
  if (request.minBytes !== null) {
    if (!Number.isFinite(request.minBytes) || request.minBytes <= 0) {
      throw new InvalidRequestError('minBytes must be null or a positive number of bytes');
    }
    if (request.minBytes > request.maxBytes) {
      throw new InvalidRequestError('minBytes cannot exceed maxBytes');
    }
  }
  const axes: ReadonlyArray<readonly [string, number | null]> = [
    ['targetWidth', request.targetWidth],
    ['targetHeight', request.targetHeight],
  ];
  for (const [name, value] of axes) {
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      throw new InvalidRequestError(`${name} must be null or a positive pixel count`);
    }
  }
}
