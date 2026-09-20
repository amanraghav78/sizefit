'use client';

import { useCallback, useEffect, useState } from 'react';
import { DownloadIcon } from '@/components/chrome';
import { DropZone } from '@/components/DropZone';
import { SizeGauge } from '@/components/SizeGauge';
import {
  CEILING_PRESETS,
  Chip,
  NumberField,
  Panel,
  PIXEL_PRESETS,
  PresetCard,
  Stepper,
} from '@/components/SizePicker';
import {
  compressImages,
  downloadBlobUrl,
  formatBytes,
  outputName,
  type ImageFormat,
  type ImageOutcome,
  type SizeTarget,
} from '@/lib/engine';
import { STEPS, stepDown, stepLabel, stepUp } from '@/lib/presets';

/**
 * The compress-image tool.
 *
 * `mode` decides which controls lead: 'size' puts the KB target first and
 * leaves pixels below, 'pixels' does the reverse. Both run the same engine, so
 * the two pages differ only in what they put in front of you.
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
  const [minText, setMinText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcomes, setOutcomes] = useState<ImageOutcome[] | null>(null);

  // A size chosen on the landing page travels here in the query string, so
  // someone who already said "50 KB" is not asked twice. Read from
  // window.location rather than useSearchParams: this is a static export, and
  // useSearchParams would force the whole page behind a Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const num = (key: string) => {
      const raw = params.get(key);
      if (raw === null) return null;
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    };
    const max = num("max");
    const min = num("min");
    const w = num("w");
    const h = num("h");
    if (max === null && min === null && w === null) return;
    if (min !== null) setMinText(String(min));
    setTarget((current) => ({
      ...current,
      maxKB: max ?? current.maxKB,
      minKB: min,
      widthPx: w ?? current.widthPx,
      heightPx: h ?? current.heightPx,
      dimensionMode: w !== null && h !== null ? "fill" : current.dimensionMode,
    }));
  }, []);

  const reset = useCallback(() => {
    // Object URLs are the page's to release; leaking them holds every
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

  if (outcomes) {
    return <Results outcomes={outcomes} target={target} onReset={reset} />;
  }

  if (files.length === 0) {
    return (
      <DropZone
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        label="Drop it in here"
        formats="JPG · PNG · WEBP · HEIC"
        onFiles={setFiles}
      />
    );
  }

  const sizePanel = (
    <Panel label="Target size">
      <Stepper
        value={stepLabel(target.maxKB).value}
        unit={stepLabel(target.maxKB).unit}
        atMin={target.maxKB <= STEPS[0]!}
        atMax={target.maxKB >= STEPS[STEPS.length - 1]!}
        onDown={() => setTarget((c) => ({ ...c, maxKB: stepDown(c.maxKB) }))}
        onUp={() => setTarget((c) => ({ ...c, maxKB: stepUp(c.maxKB) }))}
      />
      <div className="chips" style={{ marginTop: 16 }}>
        {CEILING_PRESETS.filter((p) => p.minKB === null).map((preset) => (
          <Chip
            key={preset.label}
            selected={target.maxKB === preset.maxKB && target.minKB === null}
            onClick={() => {
              setTarget((c) => ({ ...c, maxKB: preset.maxKB, minKB: null }));
              setMinText('');
            }}
          >
            {preset.label.replace('Under ', '')}
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
            setTarget((c) => ({ ...c, minKB: next === '' ? null : Number(next) }));
          }}
        />
      </div>
      <p style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-soft)' }}>
        A minimum is only needed when the form sets one. The maximum is a hard ceiling either
        way.
      </p>
    </Panel>
  );

  const pixelPanel = (
    <Panel label="Pixel size" tone="orange">
      <div className="preset-row">
        {PIXEL_PRESETS.map((preset) => (
          <PresetCard
            key={preset.label}
            name={preset.label}
            dims={preset.detail || 'whatever it already is'}
            size={preset.widthPx === null ? 'no resize' : 'cropped to fill'}
            selected={target.widthPx === preset.widthPx && target.heightPx === preset.heightPx}
            onClick={() =>
              setTarget((c) => ({
                ...c,
                widthPx: preset.widthPx,
                heightPx: preset.heightPx,
                // A named size means that size. 'fill' covers the box and
                // crops the overflow, so a 4:3 photo asked for 350×350 comes
                // back square rather than letterboxed to 350×263.
                dimensionMode: preset.widthPx === null ? 'preserve' : 'fill',
              }))
            }
          />
        ))}
      </div>
    </Panel>
  );

  return (
    <div className="stack">
      <section className="paper paper--flat">
        <h2 className="tag tag--ink" style={{ marginBottom: 6 }}>
          {files.length === 1 ? 'Your file' : `${files.length} files`}
        </h2>
        {files.map((file) => (
          <div className="file-row" key={`${file.name}-${file.size}`}>
            <span className="file-row__name">{file.name}</span>
            <span className="file-row__meta">{formatBytes(file.size)}</span>
          </div>
        ))}
        <button type="button" className="btn btn--plain" onClick={reset} style={{ marginTop: 14 }}>
          Choose different files
        </button>
      </section>

      {mode === 'size' ? sizePanel : pixelPanel}
      {mode === 'size' ? pixelPanel : sizePanel}

      <Panel label="Output format">
        <div className="chips">
          {(['jpeg', 'png'] as ImageFormat[]).map((format) => (
            <Chip
              key={format}
              selected={target.format === format}
              onClick={() => setTarget((c) => ({ ...c, format }))}
            >
              {format.toUpperCase()}
            </Chip>
          ))}
        </div>
        {target.format === 'png' ? (
          <p className="note note--warn" style={{ marginTop: 14 }}>
            PNG is lossless, so it has no quality setting to turn down. It can usually meet a
            ceiling by scaling, but it cannot be tuned upward to reach a minimum — choose JPG
            if your form sets a lower bound.
          </p>
        ) : null}
      </Panel>

      <button type="button" className="btn btn--action" onClick={run} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" />
            {progress ? `Squeezing ${progress.done} of ${progress.total}…` : 'Squeezing…'}
          </>
        ) : (
          `Compress ${files.length === 1 ? 'the image' : `${files.length} images`}`
        )}
      </button>
    </div>
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
  const single = outcomes.length === 1 ? outcomes[0] : null;
  const maxBytes = target.maxKB * 1024;

  if (single && single.url && single.result) {
    const result = single.result;
    const over = result.finalBytes > maxBytes;
    const under = !over && result.status === 'best_effort_under';
    const shrunk =
      single.sourceBytes > 0
        ? (100 - (result.finalBytes / single.sourceBytes) * 100).toFixed(1)
        : '0';

    return (
      <div className="stack">
        <Verdict over={over} under={under} passthrough={result.passthrough} />
        <h2>
          {formatBytes(result.finalBytes)} — and the form wanted{' '}
          {stepLabel(target.maxKB).value}
          {stepLabel(target.maxKB).unit}.
        </h2>

        <SizeGauge
          sourceBytes={single.sourceBytes}
          finalBytes={result.finalBytes}
          targetBytes={maxBytes}
        />

        <div className="split" style={{ padding: 0 }}>
          <div className="stage">
            <span className="stage__flag stage__flag--after">
              AFTER · {formatBytes(result.finalBytes)}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={single.url} alt="The compressed result" />
          </div>

          <div className="receipt">
            <div className="receipt__head">
              <span className="receipt__title">SIZEFIT RECEIPT</span>
              <span className="receipt__sub">KEEP FOR YOUR RECORDS</span>
            </div>
            <div className="receipt__tear" />
            <dl className="receipt__lines">
              <div className="receipt__line">
                <dt>ORIGINAL</dt>
                <dd>{formatBytes(single.sourceBytes)}</dd>
              </div>
              <div className="receipt__line">
                <dt>TARGET</dt>
                <dd>
                  &le; {stepLabel(target.maxKB).value} {stepLabel(target.maxKB).unit}
                </dd>
              </div>
              <div className="receipt__line">
                <dt>FINAL</dt>
                <dd>{formatBytes(result.finalBytes)}</dd>
              </div>
              <div className="receipt__line">
                <dt>SHRUNK BY</dt>
                <dd>{shrunk}%</dd>
              </div>
              <div className="receipt__line">
                <dt>DIMENSIONS</dt>
                <dd>
                  {result.finalWidth} × {result.finalHeight}
                </dd>
              </div>
              <div className="receipt__line">
                <dt>FORMAT</dt>
                <dd>
                  {target.format.toUpperCase()} · q{result.finalQuality}
                </dd>
              </div>
            </dl>
            <div className="receipt__tear" />
            <div className="receipt__line" style={{ fontFamily: 'var(--font-mono-stack)', fontSize: 14, fontWeight: 700 }}>
              <span>UPLOADED</span>
              <span>0 BYTES</span>
            </div>

            {over ? (
              <p className="note note--bad">
                This could not be brought under {target.maxKB} KB without making the image
                unusable. Allow a larger size, or choose smaller pixel dimensions.
              </p>
            ) : null}
            {under ? (
              <p className="note note--warn">
                Comfortably inside the ceiling, but below the minimum you asked for.
                {target.format === 'png'
                  ? ' PNG has no quality lever to raise — JPG would land inside the band.'
                  : ''}
              </p>
            ) : null}

            <a
              className="btn btn--go btn--block"
              href={single.url}
              download={outputName(single.name, target.format)}
              onClick={(event) => {
                event.preventDefault();
                downloadBlobUrl(single.url!, outputName(single.name, target.format));
              }}
            >
              <DownloadIcon />
              Download {formatBytes(result.finalBytes)}
            </a>
            <button type="button" className="btn btn--plain btn--block" onClick={onReset}>
              Compress another
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ok = outcomes.filter((outcome) => outcome.url !== null);
  return (
    <div className="stack">
      <Verdict over={ok.length < outcomes.length} under={false} passthrough={false} />
      <h2>
        {ok.length} of {outcomes.length} compressed.
      </h2>
      <section className="paper">
        {outcomes.map((outcome) => (
          <div className="file-row" key={outcome.name}>
            <span className="file-row__name">{outcome.name}</span>
            {outcome.error ? (
              <span className="file-row__meta">failed</span>
            ) : (
              <>
                <span className="file-row__meta">
                  {formatBytes(outcome.sourceBytes)} → {formatBytes(outcome.result!.finalBytes)}
                </span>
                <button
                  type="button"
                  className="chip"
                  style={{ flex: '0 0 auto' }}
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
      {outcomes.find((outcome) => outcome.error) ? (
        <p className="note note--dark">{outcomes.find((outcome) => outcome.error)?.error}</p>
      ) : null}
      <button type="button" className="btn btn--plain" onClick={onReset}>
        Compress another
      </button>
    </div>
  );
}

function Verdict({
  over,
  under,
  passthrough,
}: {
  over: boolean;
  under: boolean;
  passthrough: boolean;
}) {
  if (over) {
    return (
      <p className="verdict verdict--over">
        <BangIcon />
        OVER THE LIMIT
      </p>
    );
  }
  if (under) {
    return (
      <p className="verdict verdict--under">
        <BangIcon />
        UNDER THE MINIMUM
      </p>
    );
  }
  return (
    <p className="verdict verdict--landed">
      <TickIcon />
      {passthrough ? 'ALREADY THE RIGHT SIZE' : 'LANDED'}
    </p>
  );
}

function TickIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 13l5 5L20 6" />
    </svg>
  );
}

function BangIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v9" />
      <path d="M12 19h.01" />
    </svg>
  );
}
