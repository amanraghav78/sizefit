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
