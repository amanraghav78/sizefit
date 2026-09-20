'use client';

import type { ReactNode } from 'react';

export { CEILING_PRESETS, PIXEL_PRESETS } from '@/lib/presets';

/**
 * The size controls every tool shares. The preset data itself lives in
 * lib/presets.ts, where the test suite can reach it without React.
 */

/** A cream panel with a mono label — the design's primary grouping. */
export function Panel({
  label,
  children,
  tone = 'lime',
}: {
  label: string;
  children: ReactNode;
  tone?: 'lime' | 'orange';
}) {
  return (
    <section className={tone === 'orange' ? 'paper paper--orange' : 'paper'}>
      <h2 className="tag tag--ink" style={{ marginBottom: 14 }}>
        {label}
      </h2>
      {children}
    </section>
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

/** The +/- target-size control from the artboards. */
export function Stepper({
  value,
  unit,
  onDown,
  onUp,
  atMin,
  atMax,
}: {
  value: string;
  unit: string;
  onDown: () => void;
  onUp: () => void;
  atMin: boolean;
  atMax: boolean;
}) {
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        aria-label="Smaller target size"
        onClick={onDown}
        disabled={atMin}
      >
        &minus;
      </button>
      <p className="stepper__readout">
        <span className="stepper__num">{value}</span>
        <span className="stepper__unit">{unit}</span>
      </p>
      <button
        type="button"
        className="stepper__btn"
        aria-label="Larger target size"
        onClick={onUp}
        disabled={atMax}
      >
        +
      </button>
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  dark = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  suffix?: string;
  dark?: boolean;
}) {
  const id = `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className={dark ? 'field field--dark' : 'field'}>
      <label htmlFor={id}>
        {label}
        {suffix ? ` (${suffix})` : ''}
      </label>
      <input
        id={id}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        placeholder={placeholder ?? ''}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ''))}
      />
    </div>
  );
}

/** The dark preset card used on the home strip and the presets page. */
export function PresetCard({
  name,
  dims,
  size,
  selected,
  onClick,
}: {
  name: string;
  dims: string;
  size: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="preset__name">{name}</span>
      <span className="preset__dims">{dims}</span>
      <span className="preset__size">{size}</span>
    </>
  );
  if (!onClick) {
    return <div className="preset">{inner}</div>;
  }
  return (
    <button type="button" className="preset" aria-pressed={!!selected} onClick={onClick}>
      {inner}
    </button>
  );
}
