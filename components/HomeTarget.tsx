'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowIcon } from '@/components/chrome';
import { Chip, PresetCard, Stepper } from '@/components/SizePicker';
import { CEILING_PRESETS, FORM_PRESETS, STEPS, stepDown, stepLabel, stepUp } from '@/lib/presets';

/**
 * The target-size control on the landing page.
 *
 * It is a real control rather than a picture of one: whatever is set here
 * travels to the tool as a query string, so someone who has already told us
 * "50 KB" is not asked again on the next page.
 */
export function HomeTarget() {
  const [kb, setKb] = useState(50);
  const [preset, setPreset] = useState<string | null>(null);
  const label = stepLabel(kb);

  const href = (slug: string) => {
    const chosen = preset ? FORM_PRESETS.find((entry) => entry.name === preset) : null;
    const params = new URLSearchParams({ max: String(kb) });
    if (chosen?.minKB) params.set('min', String(chosen.minKB));
    if (chosen?.widthPx && chosen.heightPx) {
      params.set('w', String(chosen.widthPx));
      params.set('h', String(chosen.heightPx));
    }
    return `/${slug}/?${params.toString()}`;
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="paper">
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 14,
          }}
        >
          <h2 className="tag tag--ink">Target size</h2>
          <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>not a quality %</span>
        </div>

        <Stepper
          value={label.value}
          unit={label.unit}
          atMin={kb <= STEPS[0]!}
          atMax={kb >= STEPS[STEPS.length - 1]!}
          onDown={() => {
            setKb(stepDown);
            setPreset(null);
          }}
          onUp={() => {
            setKb(stepUp);
            setPreset(null);
          }}
        />

        <div className="chips" style={{ marginTop: 16 }}>
          {CEILING_PRESETS.filter((entry) => entry.minKB === null).map((entry) => (
            <Chip
              key={entry.label}
              selected={kb === entry.maxKB && preset === null}
              onClick={() => {
                setKb(entry.maxKB);
                setPreset(null);
              }}
            >
              {entry.label.replace('Under ', '')}
            </Chip>
          ))}
        </div>
      </section>

      <div>
        <h2 className="tag tag--lime" style={{ marginBottom: 10 }}>
          Or start from a form preset
        </h2>
        <div className="preset-row">
          {FORM_PRESETS.slice(0, 3).map((entry) => (
            <PresetCard
              key={entry.name}
              name={entry.name}
              dims={entry.dims}
              size={entry.size}
              selected={preset === entry.name}
              onClick={() => {
                setPreset(entry.name);
                setKb(entry.maxKB);
              }}
            />
          ))}
        </div>
      </div>

      <Link
        className="btn btn--action"
        href={href(preset && FORM_PRESETS.find((e) => e.name === preset)?.tag === 'PDF' ? 'compress-pdf' : 'compress-image')}
      >
        Continue at {label.value} {label.unit}
        <ArrowIcon />
      </Link>
    </div>
  );
}
