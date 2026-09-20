'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowIcon } from '@/components/chrome';
import { Chip } from '@/components/SizePicker';
import { FORM_PRESETS, type FormPreset } from '@/lib/presets';

type Filter = 'ALL' | FormPreset['tag'];

/**
 * The presets catalogue, filterable and searchable.
 *
 * Choosing one navigates to the right tool with the numbers already in the
 * query string, so the preset is a shortcut into the tool rather than a
 * separate place to configure things.
 */
export function FormPresetGrid() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return FORM_PRESETS.filter((preset) => {
      if (filter !== 'ALL' && preset.tag !== filter) return false;
      if (needle === '') return true;
      return `${preset.name} ${preset.dims} ${preset.size}`.toLowerCase().includes(needle);
    });
  }, [filter, query]);

  const open = (preset: FormPreset) => {
    const params = new URLSearchParams({ max: String(preset.maxKB) });
    if (preset.minKB !== null) params.set('min', String(preset.minKB));
    if (preset.widthPx !== null && preset.heightPx !== null) {
      params.set('w', String(preset.widthPx));
      params.set('h', String(preset.heightPx));
    }
    const slug = preset.tag === 'PDF' ? 'compress-pdf' : 'compress-image';
    router.push(`/${slug}/?${params.toString()}`);
  };

  const filters: Filter[] = ['ALL', 'PHOTO', 'SIGNATURE', 'PDF'];

  return (
    <div className="stack">
      <div
        style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <div className="field field--dark" style={{ flex: '1 1 300px', maxWidth: 380 }}>
          <label htmlFor="preset-search">Search a form or a board</label>
          <input
            id="preset-search"
            type="search"
            value={query}
            placeholder="passport, signature, KYC…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="chips" style={{ flex: '0 1 auto' }}>
          {filters.map((entry) => (
            <button
              key={entry}
              type="button"
              className="chip"
              aria-pressed={filter === entry}
              onClick={() => setFilter(entry)}
              style={{
                borderColor: 'var(--rule-strong)',
                color: filter === entry ? 'var(--ink)' : 'var(--text-muted)',
              }}
            >
              {entry}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="note note--dark">
          Nothing matches &ldquo;{query}&rdquo;. The presets are a shortcut — the compressor
          takes any numbers you type.
        </p>
      ) : (
        <div className="preset-row">
          {shown.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="preset"
              onClick={() => open(preset)}
              style={{ minHeight: 148 }}
            >
              <span className="tag" style={{ fontSize: 10.5, letterSpacing: 1.6 }}>
                {preset.tag}
              </span>
              <span className="preset__name" style={{ fontSize: 20, lineHeight: 1.12 }}>
                {preset.name}
              </span>
              <span className="preset__dims">{preset.dims}</span>
              <span className="preset__size" style={{ fontSize: 13.5 }}>
                {preset.size}
              </span>
              <span
                aria-hidden="true"
                style={{ color: 'var(--lime)', display: 'flex', marginTop: 2 }}
              >
                <ArrowIcon />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
