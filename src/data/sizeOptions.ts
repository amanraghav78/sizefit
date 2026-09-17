/**
 * The size and dimension choices offered on the Target screen.
 *
 * Deliberately generic: a user arrives knowing the numbers their form demands
 * ("between 20 and 50 KB", "under 100 KB"), so the app offers those numbers
 * directly instead of naming organisations. The size itself is chosen on a
 * slider (see ui/sizeScale.ts); this module holds the pixel presets and the
 * target shape.
 */
import type { CompressRequest, DimensionMode, ImageFormat } from '../core/types';
import type { Translate } from '../i18n/strings';

const KB = 1024;

/** What a batch produces: one file each, or a single combined document. */
export type OutputMode = 'images' | 'pdf';

/** A complete target: everything the algorithm needs, minus the file itself. */
export interface TargetSpec {
  minKB: number | null;
  maxKB: number;
  widthPx: number | null;
  heightPx: number | null;
  dimensionMode: DimensionMode;
  format: ImageFormat;
  /** Only meaningful with more than one file selected. */
  output: OutputMode;
  /** Page geometry when output is 'pdf'. */
  pdfPageSize: 'image' | 'a4';
}

export interface DimensionOption {
  id: string;
  /** i18n key — the label is translated at render time. */
  labelKey: string;
  /** Pixel counts are the same in every language, so this stays literal. */
  detail: string;
  widthPx: number | null;
  heightPx: number | null;
}

/** Pixel sizes forms commonly ask for, described by what they are for. */
export const dimensionOptions: DimensionOption[] = [
  { id: 'dim-keep', labelKey: 'dim.keep', detail: '', widthPx: null, heightPx: null },
  { id: 'dim-200-230', labelKey: 'dim.photo', detail: '200 × 230', widthPx: 200, heightPx: 230 },
  { id: 'dim-140-60', labelKey: 'dim.signature', detail: '140 × 60', widthPx: 140, heightPx: 60 },
  { id: 'dim-240-240', labelKey: 'dim.thumb', detail: '240 × 240', widthPx: 240, heightPx: 240 },
  { id: 'dim-800-400', labelKey: 'dim.declaration', detail: '800 × 400', widthPx: 800, heightPx: 400 },
  { id: 'dim-350-350', labelKey: 'dim.square', detail: '350 × 350', widthPx: 350, heightPx: 350 },
  { id: 'dim-600-800', labelKey: 'dim.portrait', detail: '600 × 800', widthPx: 600, heightPx: 800 },
];

export const defaultTarget: TargetSpec = {
  minKB: null,
  maxKB: 50,
  widthPx: null,
  heightPx: null,
  dimensionMode: 'preserve',
  format: 'jpeg',
  output: 'images',
  pdfPageSize: 'image',
};

/** Fill in fields added after a stored target was written. */
export function normaliseTarget(stored: Partial<TargetSpec>): TargetSpec {
  return { ...defaultTarget, ...stored };
}

export function targetToRequest(target: TargetSpec, sourceUri: string): CompressRequest {
  return {
    sourceUri,
    minBytes: target.minKB === null ? null : Math.round(target.minKB * KB),
    maxBytes: Math.round(target.maxKB * KB),
    targetWidth: target.widthPx,
    targetHeight: target.heightPx,
    format: target.format,
    dimensionMode: target.dimensionMode,
  };
}

/** "20 – 50 KB" / "Up to 40 KB" — phrased the way forms phrase it. */
export function describeBand(minKB: number | null, maxKB: number, t: Translate): string {
  const max =
    maxKB >= 1024 ? `${(maxKB / 1024).toFixed(maxKB % 1024 === 0 ? 0 : 1)} MB` : `${maxKB} KB`;
  if (minKB === null) return t('band.upTo', { max });
  return t('band.range', { min: minKB, max });
}

export function describeTarget(target: TargetSpec, t: Translate): string {
  const band = describeBand(target.minKB, target.maxKB, t);
  const dims =
    target.widthPx !== null && target.heightPx !== null
      ? ` · ${target.widthPx} × ${target.heightPx} px`
      : '';
  return `${band}${dims}`;
}

export function matchesDimensionOption(target: TargetSpec, option: DimensionOption): boolean {
  return target.widthPx === option.widthPx && target.heightPx === option.heightPx;
}
