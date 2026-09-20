/**
 * The sizes the tools offer, as plain data.
 *
 * Kept out of the component that renders them so the test suite can import
 * them without pulling in React. That matters: `realImages.test.ts` runs every
 * pixel preset against real photographs and asserts the output is exactly the
 * size the label promises, so these are the presets under test, not a copy of
 * them that could drift.
 *
 * They are shortcuts, nothing more. Every tool also takes a number typed in,
 * because the person at the keyboard is the one who knows what they need.
 */

export interface CeilingPreset {
  label: string;
  maxKB: number;
  minKB: number | null;
}

export const CEILING_PRESETS: CeilingPreset[] = [
  { label: 'Under 20 KB', maxKB: 20, minKB: null },
  { label: 'Under 50 KB', maxKB: 50, minKB: null },
  { label: 'Under 100 KB', maxKB: 100, minKB: null },
  { label: 'Under 200 KB', maxKB: 200, minKB: null },
  { label: 'Under 500 KB', maxKB: 500, minKB: null },
  { label: 'Under 1 MB', maxKB: 1024, minKB: null },
  { label: '10 – 20 KB', maxKB: 20, minKB: 10 },
  { label: '20 – 50 KB', maxKB: 50, minKB: 20 },
  { label: '50 – 100 KB', maxKB: 100, minKB: 50 },
  { label: '100 – 300 KB', maxKB: 300, minKB: 100 },
];

export interface PixelPreset {
  /** The dimensions themselves: nothing is named after what it might be for. */
  label: string;
  widthPx: number | null;
  heightPx: number | null;
}

export const PIXEL_PRESETS: PixelPreset[] = [
  { label: 'Keep as is', widthPx: null, heightPx: null },
  { label: '140 × 60', widthPx: 140, heightPx: 60 },
  { label: '200 × 230', widthPx: 200, heightPx: 230 },
  { label: '240 × 240', widthPx: 240, heightPx: 240 },
  { label: '350 × 350', widthPx: 350, heightPx: 350 },
  { label: '600 × 800', widthPx: 600, heightPx: 800 },
  { label: '800 × 400', widthPx: 800, heightPx: 400 },
];

/**
 * The stops the +/- target-size control moves between.
 *
 * Discrete rather than a free slider: these are round numbers, and a stepper
 * that landed on 47 KB would be answering a question nobody asked. Typing an
 * exact figure is always available beside it.
 */
export const STEPS: number[] = [10, 20, 50, 100, 200, 300, 500, 1024, 2048, 5120];

export function stepUp(current: number): number {
  const next = STEPS.find((step) => step > current);
  return next ?? STEPS[STEPS.length - 1]!;
}

export function stepDown(current: number): number {
  const below = STEPS.filter((step) => step < current);
  return below.length > 0 ? below[below.length - 1]! : STEPS[0]!;
}

/** 1024 reads as "1 MB", not "1024 KB". */
export function stepLabel(kb: number): { value: string; unit: string } {
  if (kb >= 1024) {
    const mb = kb / 1024;
    return { value: Number.isInteger(mb) ? String(mb) : mb.toFixed(1), unit: 'MB' };
  }
  return { value: String(kb), unit: 'KB' };
}
