'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Mascot, Dot, DownloadIcon, Paddle } from '@/components/chrome';
import {
  compressImages,
  downloadBlobUrl,
  formatBytes,
  outputName,
  type ImageOutcome,
} from '@/lib/engine';

/**
 * The home page's squeeze stage: the artboard's central idea, wired to the
 * real engine.
 *
 * The slider and the target card are two views of one number. The card says
 * the size you want; the slider says how hard that is on this particular
 * file, from "gentle" at the left to the pink zone at the right where the
 * quality gives out. Moving either moves the other, and every move actually
 * recompresses — the mascot squints because the file genuinely got smaller, not
 * because a timer told him to.
 */

const KB = 1024;

/**
 * The two ends of the track.
 *
 * The gentle end is not the file's own size: a 4 MB holiday photo would put
 * every number anyone actually asks for into the last centimetre of the
 * track. It is one megabyte, or the file itself when that is smaller, which
 * keeps the useful range — 1 MB down to 10 KB — spread across the whole bar.
 */
const FLOOR_BYTES = 10 * KB;
const CEIL_BYTES = 1024 * KB;
const NOMINAL_SOURCE = Math.round(4.2 * 1024 * KB);

/** Where the track turns pink — the last third, as drawn. */
const HURT_FROM = 0.7;

/** Below this JPEG quality the artefacts start to show on a photograph. */
const SOFT_QUALITY = 55;

type Phase = 'idle' | 'working' | 'done';

export function Squeezer({ copy, aside }: { copy: React.ReactNode; aside?: React.ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [targetKB, setTargetKB] = useState(50);
  const [custom, setCustom] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [outcome, setOutcome] = useState<ImageOutcome | null>(null);
  const [saved, setSaved] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sourceBytes = file?.size ?? NOMINAL_SOURCE;
  const position = positionFor(targetKB * KB, sourceBytes);

  // Recompress whenever the file or the target moves, but not on every pixel
  // of a drag: a pass over a 4 MB photo is a few hundred milliseconds, and
  // queueing one per frame would make the slider feel like treacle.
  useEffect(() => {
    if (!file) return;
    let live = true;
    const timer = setTimeout(async () => {
      setPhase('working');
      setError(null);
      const results = await compressImages([file], {
        minKB: null,
        maxKB: targetKB,
        widthPx: null,
        heightPx: null,
        dimensionMode: 'preserve',
        format: 'jpeg',
      });
      if (!live) {
        results.forEach((entry) => entry.url && URL.revokeObjectURL(entry.url));
        return;
      }
      const next = results[0]!;
      setOutcome((previous) => {
        if (previous?.url) URL.revokeObjectURL(previous.url);
        return next;
      });
      setError(next.error);
      setPhase('done');
    }, 220);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [file, targetKB]);

  const take = useCallback((chosen: File | null) => {
    if (!chosen) return;
    setOutcome((previous) => {
      if (previous?.url) URL.revokeObjectURL(previous.url);
      return null;
    });
    setSourceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(chosen);
    });
    setFile(chosen);
    setSaved(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const reset = () => {
    if (outcome?.url) URL.revokeObjectURL(outcome.url);
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setOutcome(null);
    setSourceUrl(null);
    setFile(null);
    setSaved(false);
    setPhase('idle');
  };

  const result = outcome?.result ?? null;
  const landed = result ? result.finalBytes <= targetKB * KB : false;
  // Before a file arrives the pink zone is all we have to go on; once one is
  // here, the encoder's own quality setting is the honest answer.
  const soft = result ? result.finalQuality < SOFT_QUALITY : position >= HURT_FROM;

  if (saved && file && outcome && result) {
    return (
      <Squeezed
        file={file}
        outcome={outcome}
        sourceUrl={sourceUrl}
        targetKB={targetKB}
        onAnother={reset}
      />
    );
  }

  return (
    <div className="split">
      <div className="stack" style={{ gap: 26 }}>
        {copy}

        {/* The target card: the size you are aiming for. */}
        <div className="target-card">
          <dl className="target-card__head">
            <dt>squeeze it to</dt>
            <dd>
              <button
                type="button"
                className="link-button"
                aria-expanded={custom}
                onClick={() => setCustom((open) => !open)}
              >
                {custom ? 'done' : 'change'}
              </button>
            </dd>
          </dl>

          <p className="target-card__num">
            {targetKB >= 1024 ? `${(targetKB / 1024).toFixed(targetKB % 1024 ? 1 : 0)} MB` : `${targetKB} KB`}
          </p>

          {custom ? (
            <div className="field">
              <label htmlFor="own-size">your own number, in KB</label>
              <input
                id="own-size"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(targetKB)}
                onChange={(event) => {
                  const digits = event.target.value.replace(/[^0-9]/g, '');
                  setTargetKB(digits === '' ? 0 : Math.min(Number(digits), 20480));
                }}
                onBlur={() => setTargetKB((kb) => (kb < 5 ? 5 : kb))}
              />
            </div>
          ) : (
            <div className="chips">
              {[20, 50, 100, 1024].map((kb) => (
                <button
                  key={kb}
                  type="button"
                  className="chip"
                  aria-pressed={targetKB === kb}
                  onClick={() => setTargetKB(kb)}
                >
                  {kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`}
                </button>
              ))}
            </div>
          )}
        </div>

        {aside}
      </div>

      {/* The stage. */}
      <div
        className="stage-card"
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        {/* Before a file there is one thing to do, so there is one thing on
            the card: the whole cream panel is the file picker. */}
        {!file ? (
          <>
            <div className={over ? 'dropzone dropzone--over' : 'dropzone'}>
              <Mascot />
              <span className="dropzone__title">Drop a photo here</span>
              <span className="btn btn--action" aria-hidden="true">
                Choose a photo
              </span>
              <span className="dropzone__formats">JPG · PNG · WEBP · HEIC</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                aria-label="Choose a photo"
                onChange={(event) => take(event.target.files?.[0] ?? null)}
              />
            </div>
            <p style={{ textAlign: 'center', fontSize: 15, color: 'var(--ink-soft)' }}>
              Got a PDF? <Link href="/compress-pdf/">Squeeze a PDF</Link>.
            </p>
          </>
        ) : null}

        {file ? (
          <>
        <div className="stage-card__head">
          <p className="badge badge--cream">
            <Dot tone="pink" />
            {file.name} · {formatBytes(file.size)}
          </p>
          <button type="button" className="link-button" onClick={() => inputRef.current?.click()}>
            swap
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            hidden
            aria-label="Choose another photo"
            onChange={(event) => take(event.target.files?.[0] ?? null)}
          />
        </div>

        <div className="squeeze-area">
          <Paddle side="left" />
          <Mascot squeeze={position} />
          <Paddle side="right" />
        </div>

        <div className="squeeze-slider">
          <div className="squeeze-slider__rail">
            <div className="squeeze-slider__hurt" />
            <div className="squeeze-slider__fill" style={{ width: `${position * 100}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(position * 1000)}
            aria-label="How hard to squeeze"
            onChange={(event) => {
              setTargetKB(targetFor(Number(event.target.value) / 1000, sourceBytes));
              setCustom(false);
            }}
          />
          <p className="squeeze-slider__ends">
            <span>gentle</span>
            <span>quality starts to hurt</span>
          </p>
        </div>

        <div className="readout">
          <div>
            <p className="readout__label">right now</p>
            <div className="readout__row">
              <p className="readout__num">
                {result && phase !== 'working' ? formatBytes(result.finalBytes) : '…'}
              </p>
              {result && phase !== 'working' ? (
                <p className={soft || !landed ? 'badge badge--blush' : 'badge'}>
                  {soft || !landed ? null : <Dot />}
                  {!landed
                    ? 'cannot get smaller'
                    : soft
                      ? 'quality starts to hurt'
                      : 'still looks crisp'}
                </p>
              ) : null}
              {phase === 'working' ? (
                <p className="readout__label">
                  <span className="spinner" aria-hidden="true" style={{ display: 'inline-block' }} />
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="btn btn--go"
            disabled={!result || phase === 'working'}
            onClick={() => {
              if (!outcome?.url) return;
              downloadBlobUrl(outcome.url, outputName(file.name, 'jpeg'));
              setSaved(true);
            }}
          >
            Save it
          </button>
        </div>
          </>
        ) : null}

        {error ? <p className="note note--bad">{error}</p> : null}
      </div>
    </div>
  );
}

/**
 * The result: it fits.
 *
 * The same numbers as the receipt the old design printed, laid out the way the
 * artboard does — the claim first, the mascot flattened underneath it, the
 * arithmetic beside it for anyone who wants to check the work.
 */
function Squeezed({
  file,
  outcome,
  sourceUrl,
  targetKB,
  onAnother,
}: {
  file: File;
  outcome: ImageOutcome;
  sourceUrl: string | null;
  targetKB: number;
  onAnother: () => void;
}) {
  const result = outcome.result!;
  const shrunk =
    file.size > 0 ? (100 - (result.finalBytes / file.size) * 100).toFixed(1) : '0';
  return (
    <div className="split split--result">
      <div className="paper paper--orange" style={{ padding: '36px 40px 40px' }}>
        <div className="stage-card__head">
          <p className="badge">
            <Dot />
            squeezed
          </p>
        </div>

        <h1 style={{ marginTop: 26, fontSize: 'clamp(34px, 4.6vw, 54px)' }}>It fits.</h1>
        <p className="hero__lede" style={{ marginTop: 6 }}>
          {formatBytes(file.size)} went in. {formatBytes(result.finalBytes)} came out
          {result.finalBytes <= targetKB * KB ? ` — just under the ${targetKB} KB you asked for.` : '.'}
        </p>

        <div className="squeeze-area" style={{ marginTop: 26, minHeight: 280 }}>
          <Paddle side="left" />
          <Mascot variant="squished" />
          <Paddle side="right" />
        </div>

        <div className="ba" style={{ marginTop: 20 }}>
          <div className="ba__panel">
            <p className="ba__label">
              <span>before</span>
              <span>{formatBytes(file.size)}</span>
            </p>
            <div className="stage">
              {sourceUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sourceUrl} alt="The file you started with" />
              ) : null}
            </div>
          </div>
          <div className="ba__panel ba__panel--after">
            <p className="ba__label">
              <span>after</span>
              <span>{formatBytes(result.finalBytes)}</span>
            </p>
            <div className="stage">
              {outcome.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={outcome.url} alt="The squeezed result" />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="numbers">
          <h2 className="receipt__title">The numbers</h2>
          <dl className="receipt__lines">
            <div className="receipt__line">
              <dt>started at</dt>
              <dd>{formatBytes(file.size)}</dd>
            </div>
            <div className="receipt__line">
              <dt>you asked for</dt>
              <dd>under {targetKB} KB</dd>
            </div>
            <div className="receipt__line">
              <dt>landed at</dt>
              <dd>{formatBytes(result.finalBytes)}</dd>
            </div>
            <div className="receipt__line">
              <dt>shrunk by</dt>
              <dd>{shrunk}%</dd>
            </div>
            <div className="receipt__line">
              <dt>now measures</dt>
              <dd>
                {result.finalWidth} × {result.finalHeight}
              </dd>
            </div>
          </dl>
        </div>

        <a
          className="btn btn--action btn--block"
          href={outcome.url ?? '#'}
          download={outputName(file.name, 'jpeg')}
          onClick={(event) => {
            event.preventDefault();
            if (outcome.url) downloadBlobUrl(outcome.url, outputName(file.name, 'jpeg'));
          }}
        >
          <DownloadIcon />
          Download {formatBytes(result.finalBytes)}
        </a>

        <button type="button" className="btn btn--plain btn--block" onClick={onAnother}>
          Squeeze another
        </button>

        <div className="tip">
          <Mascot variant="mini" />
          <p>
            Want it smaller still? Squeeze another and drag further — you will see the moment
            the quality starts to go.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Slider position and target size are the same fact in two units.
 *
 * The mapping is logarithmic: a photo goes from megabytes to tens of kilobytes,
 * and on a linear track every useful size would be crushed against the right
 * edge.
 */
function gentleEnd(sourceBytes: number): number {
  return Math.max(FLOOR_BYTES * 4, Math.min(sourceBytes, CEIL_BYTES));
}

function targetFor(position: number, sourceBytes: number): number {
  const hi = gentleEnd(sourceBytes);
  const bytes = hi * Math.exp(Math.log(FLOOR_BYTES / hi) * position);
  return Math.max(5, Math.round(bytes / KB));
}

function positionFor(targetBytes: number, sourceBytes: number): number {
  const hi = gentleEnd(sourceBytes);
  const span = Math.log(FLOOR_BYTES / hi);
  if (span === 0) return 0;
  return Math.min(1, Math.max(0, Math.log(targetBytes / hi) / span));
}
