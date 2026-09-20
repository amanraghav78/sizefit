/**
 * The sizes the tools offer, as plain data.
 *
 * Kept out of the component that renders them so the test suite can import
 * them without pulling in React. That matters: `realImages.test.ts` runs every
 * pixel preset against real photographs and asserts the output is exactly the
 * size the label promises, so these are the presets under test, not a copy of
 * them that could drift.
 *
 * The bands are the ones Indian government and university portals actually
 * ask for, which is where the numbers came from.
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
  label: string;
  detail: string;
  widthPx: number | null;
  heightPx: number | null;
}

export const PIXEL_PRESETS: PixelPreset[] = [
  { label: 'Keep as is', detail: '', widthPx: null, heightPx: null },
  { label: 'Photo', detail: '200 × 230', widthPx: 200, heightPx: 230 },
  { label: 'Signature', detail: '140 × 60', widthPx: 140, heightPx: 60 },
  { label: 'Thumb', detail: '240 × 240', widthPx: 240, heightPx: 240 },
  { label: 'Declaration', detail: '800 × 400', widthPx: 800, heightPx: 400 },
  { label: 'Square', detail: '350 × 350', widthPx: 350, heightPx: 350 },
  { label: 'Portrait', detail: '600 × 800', widthPx: 600, heightPx: 800 },
];

/**
 * The stops the +/- target-size control moves between.
 *
 * Discrete rather than a free slider: the numbers forms ask for are these
 * numbers, and a stepper that lands on 47 KB would be answering a question
 * nobody asked.
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

/**
 * The presets page's catalogue: what real forms demand, grouped by the kind of
 * thing they ask for.
 */
export interface FormPreset {
  tag: 'PHOTO' | 'SIGNATURE' | 'PDF';
  name: string;
  dims: string;
  size: string;
  maxKB: number;
  minKB: number | null;
  widthPx: number | null;
  heightPx: number | null;
}

export const FORM_PRESETS: FormPreset[] = [
  { tag: 'PHOTO', name: 'Exam form photo', dims: '3.5 × 4.5 cm · JPG', size: '20 – 50 KB', maxKB: 50, minKB: 20, widthPx: 413, heightPx: 531 },
  { tag: 'SIGNATURE', name: 'Signature scan', dims: '3.5 × 1.5 cm · JPG', size: '10 – 20 KB', maxKB: 20, minKB: 10, widthPx: 413, heightPx: 177 },
  { tag: 'PHOTO', name: 'Passport photo', dims: '2 × 2 in · JPG', size: '≤ 100 KB', maxKB: 100, minKB: null, widthPx: 600, heightPx: 600 },
  { tag: 'PDF', name: 'Bank KYC packet', dims: 'A4 · PDF', size: '≤ 300 KB', maxKB: 300, minKB: null, widthPx: null, heightPx: null },
  { tag: 'PHOTO', name: 'College admission', dims: '200 × 230 px · JPG', size: '≤ 100 KB', maxKB: 100, minKB: null, widthPx: 200, heightPx: 230 },
  { tag: 'PDF', name: 'Job portal résumé', dims: 'A4 · PDF', size: '≤ 2 MB', maxKB: 2048, minKB: null, widthPx: null, heightPx: null },
  { tag: 'PHOTO', name: 'Visa application', dims: '51 × 51 mm · JPG', size: '≤ 240 KB', maxKB: 240, minKB: null, widthPx: 602, heightPx: 602 },
  { tag: 'PDF', name: 'ID card, both sides', dims: 'A4 · PDF', size: '≤ 500 KB', maxKB: 500, minKB: null, widthPx: null, heightPx: null },
];
