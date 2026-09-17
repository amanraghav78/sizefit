/**
 * The scale behind the size slider.
 *
 * A linear slider from 4 KB to 5 MB would put every size a form actually asks
 * for in the first 4% of the track — 20 KB and 50 KB would be a pixel apart.
 * So the slider does not move through bytes at all: it steps through a fixed
 * list of sizes, roughly logarithmic, made of the round numbers forms use.
 *
 * That has two benefits over a continuous log scale: every position is a value
 * someone would actually type, and the thumb lands on it exactly rather than
 * on 47.6 KB.
 *
 * Pure and dependency-free, so the mapping can be unit-tested.
 */

/** Selectable sizes in KB, ascending. */
export const SIZE_STOPS_KB: readonly number[] = [
  4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600,
  750, 1024, 1536, 2048, 3072, 5120,
];

/** Index on the minimum track that means "no lower bound". */
export const NO_MINIMUM_INDEX = -1;

export const MIN_INDEX = 0;
export const MAX_INDEX = SIZE_STOPS_KB.length - 1;

export function stopToKB(index: number): number {
  const clamped = Math.min(MAX_INDEX, Math.max(MIN_INDEX, Math.round(index)));
  return SIZE_STOPS_KB[clamped]!;
}

/**
 * The stop nearest a given size, for seeding the slider from a typed value or
 * a remembered target. Ties go to the smaller stop, so a typed 22 KB does not
 * silently become a bigger ceiling than the user asked for.
 */
export function nearestStopIndex(kb: number): number {
  let best = MIN_INDEX;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = MIN_INDEX; i <= MAX_INDEX; i += 1) {
    const distance = Math.abs(SIZE_STOPS_KB[i]! - kb);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/** The index to show for a minimum that may be absent. */
export function minimumToIndex(kb: number | null): number {
  return kb === null ? NO_MINIMUM_INDEX : nearestStopIndex(kb);
}

export function indexToMinimum(index: number): number | null {
  return index <= NO_MINIMUM_INDEX ? null : stopToKB(index);
}

/**
 * Track position (0..1) for an index, including the "no minimum" slot that
 * sits one step to the left of the first real stop.
 */
export function indexToRatio(index: number, includeNoMinimum: boolean): number {
  const lowest = includeNoMinimum ? NO_MINIMUM_INDEX : MIN_INDEX;
  const span = MAX_INDEX - lowest;
  return span === 0 ? 0 : (index - lowest) / span;
}

export function ratioToIndex(ratio: number, includeNoMinimum: boolean): number {
  const lowest = includeNoMinimum ? NO_MINIMUM_INDEX : MIN_INDEX;
  const span = MAX_INDEX - lowest;
  const raw = lowest + ratio * span;
  return Math.min(MAX_INDEX, Math.max(lowest, Math.round(raw)));
}

/** Format a stop for display: KB up to 1 MB, then MB. */
export function formatStop(kb: number): string {
  if (kb >= 1024) {
    const mb = kb / 1024;
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  return `${kb} KB`;
}

/**
 * The highest stop that does not exceed a file's own size.
 *
 * A ceiling above what you already have asks for no compression at all, so the
 * slider stops there. Falls back to the smallest stop for a file tinier than
 * any of them, because a track has to have somewhere to be.
 */
export function highestStopWithin(kb: number): number {
  for (let i = MAX_INDEX; i >= MIN_INDEX; i -= 1) {
    if (SIZE_STOPS_KB[i]! <= kb) return i;
  }
  return MIN_INDEX;
}
