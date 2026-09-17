import type { DimensionMode } from './types';

/** Design doc §5.3: cap very large input before it enters the search loop. */
export const MAX_INPUT_EDGE = 4000;
/** §5 Step 3: never go below this on the shortest edge. */
export const MIN_SHORT_EDGE = 200;
/** §5 Step 3: scale down by 15% per round, at most 6 rounds. */
export const DOWNSCALE_FACTOR = 0.85;
export const MAX_DOWNSCALE_ROUNDS = 6;
/** §5 Step 4: mirror of the above when the file is under the floor. */
export const UPSCALE_FACTOR = 1.15;
export const MAX_UPSCALE_ROUNDS = 6;

export interface Dimensions {
  width: number;
  height: number;
}

const px = (n: number): number => Math.max(1, Math.round(n));

export function shortestEdge(d: Dimensions): number {
  return Math.min(d.width, d.height);
}

export function longestEdge(d: Dimensions): number {
  return Math.max(d.width, d.height);
}

/** Scale down so that no edge exceeds `maxEdge`. No-op if already inside. */
export function clampToMaxEdge(d: Dimensions, maxEdge = MAX_INPUT_EDGE): Dimensions {
  const longest = longestEdge(d);
  if (longest <= maxEdge) return d;
  const scale = maxEdge / longest;
  return { width: px(d.width * scale), height: px(d.height * scale) };
}

export interface ResolveInput {
  source: Dimensions;
  targetWidth: number | null;
  targetHeight: number | null;
  mode: DimensionMode;
}

/**
 * §5 Step 1: work out the dimensions to encode at, before any quality work.
 *
 * - `exact`   — exactly W×H, aspect distortion allowed. If only one axis is
 *               given the other follows the source aspect ratio.
 * - `fit`     — scale so the image fits inside the W×H box, preserving aspect.
 *               Never upscales here; the §5 Step 4 floor fallback may later
 *               grow the image, but only up to the box.
 * - `preserve`— source dimensions, capped at MAX_INPUT_EDGE.
 */
export function resolveTargetDimensions(input: ResolveInput): Dimensions {
  const { source, targetWidth, targetHeight, mode } = input;
  const capped = clampToMaxEdge(source);

  if (mode === 'preserve' || (targetWidth === null && targetHeight === null)) {
    return capped;
  }

  if (mode === 'exact') {
    if (targetWidth !== null && targetHeight !== null) {
      return { width: px(targetWidth), height: px(targetHeight) };
    }
    const aspect = source.width / source.height;
    if (targetWidth !== null) {
      return { width: px(targetWidth), height: px(targetWidth / aspect) };
    }
    return { width: px(targetHeight! * aspect), height: px(targetHeight!) };
  }

  // fit
  const boxW = targetWidth ?? Number.POSITIVE_INFINITY;
  const boxH = targetHeight ?? Number.POSITIVE_INFINITY;
  const scale = Math.min(boxW / capped.width, boxH / capped.height, 1);
  return { width: px(capped.width * scale), height: px(capped.height * scale) };
}

/**
 * §5 Step 3: one downscale round. Returns null when another round would push
 * the shortest edge below MIN_SHORT_EDGE.
 */
export function downscaleRound(d: Dimensions, factor = DOWNSCALE_FACTOR): Dimensions | null {
  const next = { width: px(d.width * factor), height: px(d.height * factor) };
  if (shortestEdge(next) < MIN_SHORT_EDGE) return null;
  if (next.width === d.width && next.height === d.height) return null;
  return next;
}

/**
 * §5 Step 3, sharpened: pick the next downscale from the measured overshoot
 * rather than always stepping 15%.
 *
 * Encoded size tracks pixel count, so the linear scale that would land on the
 * ceiling is about sqrt(maxBytes / overshootBytes); we take 95% of that for
 * headroom. A flat 15% per round caps out at 0.85^6 = 0.38 linear, which is
 * nowhere near enough to take a 12MP photo down to a 20KB ceiling - the round
 * budget would run out while the file was still over the limit, and the
 * ceiling is the one thing that must never be breached.
 *
 * Never steps less than the spec's 15%, never goes below MIN_SHORT_EDGE, and
 * returns null when it cannot shrink any further.
 */
export function predictiveDownscale(
  d: Dimensions,
  overshootBytes: number,
  maxBytes: number,
): Dimensions | null {
  const predicted = Math.sqrt(maxBytes / overshootBytes) * 0.95;
  const scale = Math.min(predicted, DOWNSCALE_FACTOR);
  let next = { width: px(d.width * scale), height: px(d.height * scale) };

  if (shortestEdge(next) < MIN_SHORT_EDGE) {
    const rescue = MIN_SHORT_EDGE / shortestEdge(d);
    if (rescue >= 1) return null; // already at the floor
    next = { width: px(d.width * rescue), height: px(d.height * rescue) };
  }
  if (next.width >= d.width && next.height >= d.height) return null;
  return next;
}

/**
 * §5 Step 4: one upscale round, optionally bounded by a box (the `fit` target,
 * which the result must still fit inside). Returns null when it cannot grow.
 */
export function upscaleRound(
  d: Dimensions,
  bound: Dimensions | null,
  factor = UPSCALE_FACTOR,
): Dimensions | null {
  let next = { width: px(d.width * factor), height: px(d.height * factor) };
  if (bound) {
    const scale = Math.min(bound.width / next.width, bound.height / next.height, 1);
    next = { width: px(next.width * scale), height: px(next.height * scale) };
  }
  if (next.width <= d.width && next.height <= d.height) return null;
  return next;
}

export function sameDimensions(a: Dimensions, b: Dimensions): boolean {
  return a.width === b.width && a.height === b.height;
}
