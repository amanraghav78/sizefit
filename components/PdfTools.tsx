'use client';

import { useCallback, useState } from 'react';
import { DownloadIcon } from '@/components/chrome';
import { DropZone } from '@/components/DropZone';
import { SizeGauge } from '@/components/SizeGauge';
import { CEILING_PRESETS, Chip, Panel, Stepper } from '@/components/SizePicker';
import { downloadBlobUrl, explain, formatBytes } from '@/lib/engine';
import type { PdfOutcome } from '@/lib/pdfEngine';
import { STEPS, stepDown, stepLabel, stepUp } from '@/lib/presets';

/** Shrink an existing PDF under a ceiling. */
export function CompressPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [maxKB, setMaxKB] = useState(500);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<PdfOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    if (outcome) URL.revokeObjectURL(outcome.url);
    setOutcome(null);
    setFile(null);
    setError(null);
  };

  const run = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // pdf-lib loads here, not on page load, so it never costs a visitor
      // who only came to read the page.
      const { compressExistingPdf } = await import('@/lib/pdfEngine');
      setOutcome(await compressExistingPdf(file, maxKB, null));
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }, [file, maxKB]);

  if (outcome && file) {
    return (
      <div className="stack">
        <p className={outcome.overLimit ? 'verdict verdict--over' : 'verdict verdict--landed'}>
          {outcome.overLimit ? 'OVER THE LIMIT' : 'LANDED'}
        </p>
        <h2>
          {formatBytes(outcome.bytes)} — and the form wanted {stepLabel(maxKB).value}
          {stepLabel(maxKB).unit}.
        </h2>

        <SizeGauge
          sourceBytes={file.size}
          finalBytes={outcome.bytes}
          targetBytes={maxKB * 1024}
        />

        <div className="receipt" style={{ maxWidth: 520 }}>
          <div className="receipt__head">
            <span className="receipt__title">SIZEFIT RECEIPT</span>
            <span className="receipt__sub">KEEP FOR YOUR RECORDS</span>
          </div>
          <div className="receipt__tear" />
          <dl className="receipt__lines">
            <div className="receipt__line">
              <dt>ORIGINAL</dt>
              <dd>{formatBytes(file.size)}</dd>
            </div>
            <div className="receipt__line">
              <dt>FINAL</dt>
              <dd>{formatBytes(outcome.bytes)}</dd>
            </div>
            <div className="receipt__line">
              <dt>PAGES</dt>
              <dd>{outcome.pageCount}</dd>
            </div>
            <div className="receipt__line">
              <dt>IMAGES REDONE</dt>
              <dd>{outcome.imagesRecompressed}</dd>
            </div>
          </dl>
          <div className="receipt__tear" />
          <div
            className="receipt__line"
            style={{ fontFamily: 'var(--font-mono-stack)', fontSize: 14, fontWeight: 700 }}
          >
            <span>UPLOADED</span>
            <span>0 BYTES</span>
          </div>

          {outcome.imagesSkipped > 0 ? (
            <p className="note note--warn">
              {outcome.imagesSkipped}{' '}
              {outcome.imagesSkipped === 1 ? 'image was' : 'images were'} in a format that
              cannot be recompressed here, so they are unchanged. The pages still look the
              same.
            </p>
          ) : null}
          {outcome.overLimit ? (
            <p className="note note--bad">
              {outcome.imagesRecompressed === 0
                ? 'This PDF is text or line art rather than scanned pictures, so there is nothing to compress. It is already as small as this tool can make it.'
                : `This could not be brought under ${maxKB} KB without making the pages unreadable. Choose a larger size, or compress fewer pages at a time.`}
            </p>
          ) : null}

          <a
            className="btn btn--go btn--block"
            href={outcome.url}
            download
            onClick={(event) => {
              event.preventDefault();
              downloadBlobUrl(
                outcome.url,
                `${file.name.replace(/\.pdf$/i, '')}-sizefit.pdf`,
              );
            }}
          >
            <DownloadIcon />
            Download {formatBytes(outcome.bytes)}
          </a>
          <button type="button" className="btn btn--plain btn--block" onClick={reset}>
            Compress another
          </button>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <>
        <DropZone
          accept="application/pdf"
          label="Drop the PDF here"
          formats="PDF · your document never leaves this device"
          onFiles={(files) => setFile(files[0] ?? null)}
        />
        {error ? (
          <p className="note note--dark" style={{ marginTop: 18 }}>
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div className="stack">
      <section className="paper paper--flat">
        <h2 className="tag tag--ink" style={{ marginBottom: 6 }}>
          Your file
        </h2>
        <div className="file-row">
          <span className="file-row__name">{file.name}</span>
          <span className="file-row__meta">{formatBytes(file.size)}</span>
        </div>
        <button type="button" className="btn btn--plain" onClick={reset} style={{ marginTop: 14 }}>
          Choose a different file
        </button>
      </section>

      <Panel label="Target size">
        <Stepper
          value={stepLabel(maxKB).value}
          unit={stepLabel(maxKB).unit}
          atMin={maxKB <= STEPS[0]!}
          atMax={maxKB >= STEPS[STEPS.length - 1]!}
          onDown={() => setMaxKB(stepDown)}
          onUp={() => setMaxKB(stepUp)}
        />
        <div className="chips" style={{ marginTop: 16 }}>
          {CEILING_PRESETS.filter((preset) => preset.minKB === null).map((preset) => (
            <Chip
              key={preset.label}
              selected={maxKB === preset.maxKB}
              onClick={() => setMaxKB(preset.maxKB)}
            >
              {preset.label.replace('Under ', '')}
            </Chip>
          ))}
        </div>
      </Panel>

      {error ? <p className="note note--dark">{error}</p> : null}

      <button type="button" className="btn btn--action" onClick={run} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Squeezing the document…
          </>
        ) : (
          'Compress PDF'
        )}
      </button>
    </div>
  );
}

/** Combine images into one PDF that lands under a ceiling. */
export function ImageToPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [maxKB, setMaxKB] = useState(500);
  const [pageSize, setPageSize] = useState<'image' | 'a4'>('a4');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<PdfOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalIn = files.reduce((sum, file) => sum + file.size, 0);

  const reset = () => {
    if (outcome) URL.revokeObjectURL(outcome.url);
    setOutcome(null);
    setFiles([]);
    setError(null);
  };

  const run = useCallback(async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { imagesToPdf } = await import('@/lib/pdfEngine');
      setOutcome(await imagesToPdf(files, maxKB, pageSize));
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }, [files, maxKB, pageSize]);

  if (outcome) {
    return (
      <div className="stack">
        <p className={outcome.overLimit ? 'verdict verdict--over' : 'verdict verdict--landed'}>
          {outcome.overLimit ? 'OVER THE LIMIT' : 'LANDED'}
        </p>
        <h2>
          {formatBytes(outcome.bytes)} across {outcome.pageCount}{' '}
          {outcome.pageCount === 1 ? 'page' : 'pages'}.
        </h2>

        <SizeGauge
          sourceBytes={Math.max(totalIn, outcome.bytes)}
          finalBytes={outcome.bytes}
          targetBytes={maxKB * 1024}
        />

        <div className="receipt" style={{ maxWidth: 520 }}>
          <div className="receipt__head">
            <span className="receipt__title">SIZEFIT RECEIPT</span>
            <span className="receipt__sub">KEEP FOR YOUR RECORDS</span>
          </div>
          <div className="receipt__tear" />
          <dl className="receipt__lines">
            <div className="receipt__line">
              <dt>IMAGES IN</dt>
              <dd>{formatBytes(totalIn)}</dd>
            </div>
            <div className="receipt__line">
              <dt>PDF OUT</dt>
              <dd>{formatBytes(outcome.bytes)}</dd>
            </div>
            <div className="receipt__line">
              <dt>PAGES</dt>
              <dd>{outcome.pageCount}</dd>
            </div>
            <div className="receipt__line">
              <dt>PAGE SIZE</dt>
              <dd>{pageSize === 'a4' ? 'A4' : 'FIT IMAGE'}</dd>
            </div>
          </dl>
          <div className="receipt__tear" />
          <div
            className="receipt__line"
            style={{ fontFamily: 'var(--font-mono-stack)', fontSize: 14, fontWeight: 700 }}
          >
            <span>UPLOADED</span>
            <span>0 BYTES</span>
          </div>

          {outcome.overLimit ? (
            <p className="note note--bad">
              The finished PDF could not be brought under {maxKB} KB. Allow a larger size, or
              use fewer images.
            </p>
          ) : null}

          <a
            className="btn btn--go btn--block"
            href={outcome.url}
            download="sizefit.pdf"
            onClick={(event) => {
              event.preventDefault();
              downloadBlobUrl(outcome.url, 'sizefit.pdf');
            }}
          >
            <DownloadIcon />
            Download {formatBytes(outcome.bytes)}
          </a>
          <button type="button" className="btn btn--plain btn--block" onClick={reset}>
            Make another
          </button>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <>
        <DropZone
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          label="Drop the pages here"
          formats="JPG · PNG · HEIC · in the order you pick them"
          onFiles={setFiles}
        />
        {error ? (
          <p className="note note--dark" style={{ marginTop: 18 }}>
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div className="stack">
      <section className="paper paper--flat">
        <h2 className="tag tag--ink" style={{ marginBottom: 6 }}>
          {files.length} pages
        </h2>
        {files.map((file, index) => (
          <div className="file-row" key={`${file.name}-${index}`}>
            <span className="file-row__meta" style={{ width: 22 }}>
              {index + 1}
            </span>
            <span className="file-row__name">{file.name}</span>
            <span className="file-row__meta">{formatBytes(file.size)}</span>
          </div>
        ))}
        <button type="button" className="btn btn--plain" onClick={reset} style={{ marginTop: 14 }}>
          Choose different images
        </button>
      </section>

      <Panel label="Page size">
        <div className="chips">
          <Chip selected={pageSize === 'a4'} onClick={() => setPageSize('a4')}>
            A4 — centred on a portrait page
          </Chip>
          <Chip selected={pageSize === 'image'} onClick={() => setPageSize('image')}>
            Fit the image
          </Chip>
        </div>
      </Panel>

      <Panel label="Maximum size of the finished PDF" tone="orange">
        <Stepper
          value={stepLabel(maxKB).value}
          unit={stepLabel(maxKB).unit}
          atMin={maxKB <= STEPS[0]!}
          atMax={maxKB >= STEPS[STEPS.length - 1]!}
          onDown={() => setMaxKB(stepDown)}
          onUp={() => setMaxKB(stepUp)}
        />
        <p style={{ marginTop: 14, fontSize: 14, color: 'var(--ink-soft)' }}>
          The budget is shared between the pages, so more pages means a tighter budget for
          each.
        </p>
      </Panel>

      {error ? <p className="note note--dark">{error}</p> : null}

      <button type="button" className="btn btn--action" onClick={run} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Building the PDF…
          </>
        ) : (
          'Create PDF'
        )}
      </button>
    </div>
  );
}
