'use client';

import { useCallback, useState } from 'react';
import { DropZone } from '@/components/DropZone';
import { CEILING_PRESETS, Chip, NumberField, Panel, PIXEL_PRESETS } from '@/components/SizePicker';
import {
  compressImages,
  downloadBlobUrl,
  formatBytes,
  outputName,
  type ImageFormat,
  type ImageOutcome,
  type SizeTarget,
} from '@/lib/engine';

/**
 * The compress-image tool.
 *
 * `mode` decides which controls lead: 'size' puts the KB band first and leaves
 * pixels in the advanced row, 'pixels' does the reverse. Both run the same
 * engine, so the two pages differ only in what they put in front of you.
 */
export function CompressImageTool({ mode = 'size' }: { mode?: 'size' | 'pixels' }) {
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState<SizeTarget>({
    minKB: null,
    maxKB: mode === 'pixels' ? 200 : 50,
    widthPx: null,
    heightPx: null,
    dimensionMode: 'preserve',
    format: 'jpeg',
  });
  const [maxText, setMaxText] = useState(mode === 'pixels' ? '200' : '50');
  const [minText, setMinText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcomes, setOutcomes] = useState<ImageOutcome[] | null>(null);

  const reset = useCallback(() => {
    // Object URLs are the page's to release; leaking them holds the whole
    // compressed file in memory for as long as the tab is open.
    outcomes?.forEach((outcome) => outcome.url && URL.revokeObjectURL(outcome.url));
    setOutcomes(null);
    setFiles([]);
    setProgress(null);
  }, [outcomes]);

  const run = useCallback(async () => {
    if (files.length === 0) return;
    setBusy(true);
    setProgress({ done: 0, total: files.length });
    try {
      const results = await compressImages(files, target, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setOutcomes(results);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [files, target]);

  const applyCeiling = (maxKB: number, minKB: number | null) => {
    setTarget((current) => ({ ...current, maxKB, minKB }));
    setMaxText(String(maxKB));
    setMinText(minKB === null ? '' : String(minKB));
  };

  if (outcomes) {
    return <Results outcomes={outcomes} target={target} onReset={reset} />;
  }

  if (files.length === 0) {
    return (
      <DropZone
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        label="Choose images"
        hint="or drop them here — JPG, PNG, HEIC. They never leave your device."
        onFiles={setFiles}
      />
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel__label">
          {files.length === 1 ? 'Your file' : `${files.length} files`}
        </div>
        {files.map((file) => (
          <div className="file-row" key={`${file.name}-${file.size}`}>
            <span className="file-row__name">{file.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>{formatBytes(file.size)}</span>
          </div>
        ))}
        <button type="button" className="btn btn--ghost" onClick={reset} style={{ marginTop: 10 }}>
          Choose different files
        </button>
      </section>

      {mode === 'size' ? (
        <>
          <Panel label="Target size">
            <div className="chips">
              {CEILING_PRESETS.map((preset) => (
                <Chip
                  key={preset.label}
                  selected={target.maxKB === preset.maxKB && target.minKB === preset.minKB}
                  onClick={() => applyCeiling(preset.maxKB, preset.minKB)}
                >
                  {preset.label}
                </Chip>
              ))}
            </div>
            <div className="field-row" style={{ marginTop: 18 }}>
              <NumberField
                label="Minimum"
                suffix="KB"
                value={minText}
                placeholder="none"
                onChange={(next) => {
                  setMinText(next);
                  setTarget((current) => ({
                    ...current,
                    minKB: next === '' ? null : Number(next),
                  }));
                }}
              />
              <NumberField
                label="Maximum"
                suffix="KB"
                value={maxText}
                placeholder="50"
                onChange={(next) => {
                  setMaxText(next);
                  if (next !== '') setTarget((current) => ({ ...current, maxKB: Number(next) }));
                }}
              />
            </div>
          </Panel>
          <PixelPanel target={target} setTarget={setTarget} />
        </>
      ) : (
        <>
          <PixelPanel target={target} setTarget={setTarget} />
          <Panel label="Size ceiling">
            <div className="chips">
              {CEILING_PRESETS.slice(0, 6).map((preset) => (
                <Chip
                  key={preset.label}
                  selected={target.maxKB === preset.maxKB && target.minKB === preset.minKB}
                  onClick={() => applyCeiling(preset.maxKB, preset.minKB)}
                >
                  {preset.label}
                </Chip>
              ))}
            </div>
          </Panel>
        </>
      )}

      <Panel label="Output format">
        <div className="chips">
          {(['jpeg', 'png'] as ImageFormat[]).map((format) => (
            <Chip
              key={format}
              selected={target.format === format}
              onClick={() => setTarget((current) => ({ ...current, format }))}
            >
              {format.toUpperCase()}
            </Chip>
          ))}
        </div>
        {target.format === 'png' ? (
          <p className="note note--warn" style={{ marginTop: 14 }}>
            PNG is lossless, so it has no quality setting to turn down. It can usually meet a
            ceiling by scaling, but it cannot be tuned upward to reach a minimum — choose JPEG
            if your form sets a lower bound.
          </p>
        ) : null}
      </Panel>

      <button type="button" className="btn btn--primary btn--lg" onClick={run} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" />
            {progress ? `Compressing ${progress.done} of ${progress.total}…` : 'Compressing…'}
          </>
        ) : (
          `Compress ${files.length === 1 ? 'image' : `${files.length} images`}`
        )}
      </button>
    </div>
  );
}

function PixelPanel({
  target,
  setTarget,
}: {
  target: SizeTarget;
  setTarget: (update: (current: SizeTarget) => SizeTarget) => void;
}) {
  return (
    <Panel label="Pixel size">
      <div className="chips">
        {PIXEL_PRESETS.map((preset) => (
          <Chip
            key={preset.label}
            detail={preset.detail || undefined}
            selected={target.widthPx === preset.widthPx && target.heightPx === preset.heightPx}
            onClick={() =>
              setTarget((current) => ({
                ...current,
                widthPx: preset.widthPx,
                heightPx: preset.heightPx,
                // A named size means that size. 'fill' covers the box and crops
                // the overflow, so a 4:3 photo asked for 350×350 comes back
                // square rather than letterboxed to 350×263.
                dimensionMode: preset.widthPx === null ? 'preserve' : 'fill',
              }))
            }
          >
            {preset.label}
          </Chip>
        ))}
      </div>
      {target.widthPx !== null ? (
        <p style={{ marginTop: 14, fontSize: 14.5, color: 'var(--text-muted)' }}>
          Cropped to fill {target.widthPx} × {target.heightPx}, centred — the picture keeps its
          proportions and the overflow is trimmed.
        </p>
      ) : null}
    </Panel>
  );
}

function Results({
  outcomes,
  target,
  onReset,
}: {
  outcomes: ImageOutcome[];
  target: SizeTarget;
  onReset: () => void;
}) {
  const ok = outcomes.filter((outcome) => outcome.url !== null);
  const single = outcomes.length === 1 ? outcomes[0] : null;

  return (
    <div className="stack">
      {single && single.url && single.result ? (
        <div className="result">
          <div className="preview-stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={single.url} alt="The compressed result" />
          </div>
          <div className="panel">
            <Verdict outcome={single} target={target} />
            <div className="readout" style={{ marginTop: 14 }}>
              <span className="readout__before">{formatBytes(single.sourceBytes)}</span>
              <span className="readout__after">{formatBytes(single.result.finalBytes)}</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14.5, marginTop: 6 }}>
              {single.result.finalWidth} × {single.result.finalHeight} px
              {single.result.paddingBytes > 0
                ? ` · padded by ${formatBytes(single.result.paddingBytes)} to clear the minimum`
                : ''}
            </p>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              style={{ marginTop: 18, width: '100%' }}
              onClick={() =>
                downloadBlobUrl(single.url!, outputName(single.name, target.format))
              }
            >
              Download
            </button>
          </div>
        </div>
      ) : (
        <section className="panel">
          <div className="panel__label">
            {ok.length} of {outcomes.length} compressed
          </div>
          {outcomes.map((outcome) => (
            <div className="file-row" key={outcome.name}>
              <span className="file-row__name">{outcome.name}</span>
              {outcome.error ? (
                <span className="badge badge--bad">Failed</span>
              ) : (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {formatBytes(outcome.sourceBytes)} → {formatBytes(outcome.result!.finalBytes)}
                  </span>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    style={{ minHeight: 38, padding: '0 14px' }}
                    onClick={() =>
                      downloadBlobUrl(outcome.url!, outputName(outcome.name, target.format))
                    }
                  >
                    Download
                  </button>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {outcomes.some((outcome) => outcome.error) ? (
        <p className="note note--bad">
          {outcomes.find((outcome) => outcome.error)?.error}
        </p>
      ) : null}

      <button type="button" className="btn btn--secondary" onClick={onReset}>
        Compress another
      </button>
    </div>
  );
}

function Verdict({ outcome, target }: { outcome: ImageOutcome; target: SizeTarget }) {
  const result = outcome.result;
  if (!result) return <span className="badge badge--bad">Failed</span>;

  const overCeiling = result.finalBytes > target.maxKB * 1024;
  if (overCeiling) {
    return (
      <>
        <span className="badge badge--bad">Over the limit</span>
        <p className="note note--bad" style={{ marginTop: 12 }}>
          This could not be brought under {target.maxKB} KB without making the image
          unusable. Allow a larger size, or choose smaller pixel dimensions.
        </p>
      </>
    );
  }
  if (result.status === 'best_effort_under') {
    return (
      <>
        <span className="badge badge--warn">Under the minimum</span>
        <p className="note note--warn" style={{ marginTop: 12 }}>
          It is comfortably inside the ceiling but below the minimum you asked for.
          {target.format === 'png'
            ? ' PNG has no quality lever to raise — switching to JPEG would let it land inside the band.'
            : ''}
        </p>
      </>
    );
  }
  if (result.passthrough) {
    return <span className="badge badge--ok">Already the right size</span>;
  }
  return <span className="badge badge--ok">Inside the limit</span>;
}
