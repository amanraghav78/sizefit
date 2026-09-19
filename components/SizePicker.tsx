'use client';

import type { ReactNode } from 'react';

export { CEILING_PRESETS, PIXEL_PRESETS } from '@/lib/presets';

/**
 * The size controls every tool shares. The preset data itself lives in
 * lib/presets.ts, where the test suite can reach it without React.
 */

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
