'use client';

import type { ReactNode } from 'react';

/**
 * The size controls every tool shares: the common presets as chips, and typed
 * fields for anything else.
 *
 * The presets are the bands real Indian government and university portals ask
 * for, which is where the app's own list came from.
 */
export const CEILING_PRESETS: Array<{ label: string; maxKB: number; minKB: number | null }> = [
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

export const PIXEL_PRESETS: Array<{
  label: string;
  detail: string;
  widthPx: number | null;
  heightPx: number | null;
}> = [
  { label: 'Keep as is', detail: '', widthPx: null, heightPx: null },
  { label: 'Photo', detail: '200 × 230', widthPx: 200, heightPx: 230 },
  { label: 'Signature', detail: '140 × 60', widthPx: 140, heightPx: 60 },
  { label: 'Thumb', detail: '240 × 240', widthPx: 240, heightPx: 240 },
  { label: 'Declaration', detail: '800 × 400', widthPx: 800, heightPx: 400 },
  { label: 'Square', detail: '350 × 350', widthPx: 350, heightPx: 350 },
  { label: 'Portrait', detail: '600 × 800', widthPx: 600, heightPx: 800 },
];

export function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2 className="panel__label">{label}</h2>
      {children}
    </section>
  );
}

export function Chip({
  selected,
  onClick,
  children,
  detail,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  detail?: string;
}) {
  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onClick}>
      {children}
      {detail ? <small>{detail}</small> : null}
    </button>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {suffix ? ` (${suffix})` : ''}
      </label>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        placeholder={placeholder ?? ''}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ''))}
      />
    </div>
  );
}
