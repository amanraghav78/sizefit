'use client';

import { useCallback, useState } from 'react';
import { DropZone } from '@/components/DropZone';
import { CEILING_PRESETS, Chip, NumberField, Panel } from '@/components/SizePicker';
import { downloadBlobUrl, explain, formatBytes } from '@/lib/engine';
import type { PdfOutcome } from '@/lib/pdfEngine';

/** Shrink an existing PDF under a ceiling. */
export function CompressPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [maxKB, setMaxKB] = useState(500);
  const [maxText, setMaxText] = useState('500');
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

  if (outcome) {
    return (
      <div className="stack">
        <section className="panel">
          <span className={outcome.overLimit ? 'badge badge--bad' : 'badge badge--ok'}>
            {outcome.overLimit ? 'Over the limit' : 'Inside the limit'}
          </span>
          <div className="readout" style={{ marginTop: 14 }}>
            <span className="readout__before">{formatBytes(file?.size ?? 0)}</span>
            <span className="readout__after">{formatBytes(outcome.bytes)}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14.5, marginTop: 6 }}>
            {outcome.pageCount} {outcome.pageCount === 1 ? 'page' : 'pages'}
          </p>

          {outcome.imagesSkipped > 0 ? (
            <p className="note note--warn" style={{ marginTop: 14 }}>
              {outcome.imagesSkipped}{' '}
              {outcome.imagesSkipped === 1 ? 'image was' : 'images were'} in a format that
              cannot be recompressed here, so they are unchanged. The pages still look the
              same.
            </p>
          ) : null}

          {outcome.overLimit ? (
            <p className="note note--bad" style={{ marginTop: 14 }}>
              {outcome.imagesRecompressed === 0
                ? 'This PDF is text or line art rather than scanned pictures, so there is nothing to compress. It is already as small as this tool can make it.'
                : `This could not be brought under ${maxKB} KB without making the pages unreadable. Choose a larger size, or compress fewer pages at a time.`}
            </p>
          ) : null}

          <button
            type="button"
            className="btn btn--primary btn--lg"
            style={{ marginTop: 18, width: '100%' }}
            onClick={() =>
              downloadBlobUrl(
                outcome.url,
                `${(file?.name ?? 'document').replace(/\.pdf$/i, '')}-sizefit.pdf`,
              )
            }
          >
            Download PDF
          </button>
        </section>
        <button type="button" className="btn btn--secondary" onClick={reset}>
          Compress another
        </button>
      </div>
    );
  }

  if (!file) {
    return (
      <>
        <DropZone
          accept="application/pdf"
          label="Choose a PDF"
          hint="or drop it here. Your document never leaves your device."
          onFiles={(files) => setFile(files[0] ?? null)}
        />
        {error ? (
          <p className="note note--bad" style={{ marginTop: 16 }}>
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel__label">Your file</div>
        <div className="file-row">
          <span className="file-row__name">{file.name}</span>
          <span style={{ color: 'var(--text-muted)' }}>{formatBytes(file.size)}</span>
        </div>
        <button type="button" className="btn btn--ghost" onClick={reset} style={{ marginTop: 10 }}>
          Choose a different file
        </button>
      </section>

      <Panel label="Target size">
        <div className="chips">
          {CEILING_PRESETS.filter((preset) => preset.minKB === null).map((preset) => (
            <Chip
              key={preset.label}
              selected={maxKB === preset.maxKB}
              onClick={() => {
                setMaxKB(preset.maxKB);
                setMaxText(String(preset.maxKB));
              }}
            >
              {preset.label}
            </Chip>
          ))}
        </div>
        <div className="field-row" style={{ marginTop: 18 }}>
          <NumberField
            label="Maximum"
            suffix="KB"
            value={maxText}
            onChange={(next) => {
              setMaxText(next);
              if (next !== '') setMaxKB(Number(next));
            }}
          />
        </div>
      </Panel>

      {error ? <p className="note note--bad">{error}</p> : null}

      <button type="button" className="btn btn--primary btn--lg" onClick={run} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Compressing the document…
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
        <section className="panel">
          <span className={outcome.overLimit ? 'badge badge--bad' : 'badge badge--ok'}>
            {outcome.overLimit ? 'Over the limit' : 'Inside the limit'}
          </span>
          <div className="readout" style={{ marginTop: 14 }}>
            <span className="readout__after">{formatBytes(outcome.bytes)}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14.5, marginTop: 6 }}>
            {outcome.pageCount} {outcome.pageCount === 1 ? 'page' : 'pages'}
          </p>
          {outcome.overLimit ? (
            <p className="note note--bad" style={{ marginTop: 14 }}>
              The finished PDF could not be brought under {maxKB} KB. Allow a larger size, or
              use fewer images.
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn--primary btn--lg"
            style={{ marginTop: 18, width: '100%' }}
            onClick={() => downloadBlobUrl(outcome.url, 'sizefit.pdf')}
          >
            Download PDF
          </button>
        </section>
        <button type="button" className="btn btn--secondary" onClick={reset}>
          Make another
        </button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <>
        <DropZone
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          label="Choose images"
          hint="or drop them here. They become pages, in the order you pick them."
          onFiles={setFiles}
        />
        {error ? (
          <p className="note note--bad" style={{ marginTop: 16 }}>
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel__label">{files.length} pages</div>
        {files.map((file, index) => (
          <div className="file-row" key={`${file.name}-${index}`}>
            <span style={{ color: 'var(--text-faint)', width: 22 }}>{index + 1}</span>
            <span className="file-row__name">{file.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>{formatBytes(file.size)}</span>
          </div>
        ))}
        <button type="button" className="btn btn--ghost" onClick={reset} style={{ marginTop: 10 }}>
          Choose different images
        </button>
      </section>

      <Panel label="Page size">
        <div className="chips">
          <Chip selected={pageSize === 'a4'} onClick={() => setPageSize('a4')}>
            A4
            <small>Centred on a portrait page</small>
          </Chip>
          <Chip selected={pageSize === 'image'} onClick={() => setPageSize('image')}>
            Fit the image
            <small>Each page matches its photo</small>
          </Chip>
        </div>
      </Panel>

      <Panel label="Maximum size of the finished PDF">
        <div className="chips">
          {CEILING_PRESETS.filter((preset) => preset.minKB === null).map((preset) => (
            <Chip
              key={preset.label}
              selected={maxKB === preset.maxKB}
              onClick={() => setMaxKB(preset.maxKB)}
            >
              {preset.label}
            </Chip>
          ))}
        </div>
      </Panel>

      {error ? <p className="note note--bad">{error}</p> : null}

      <button type="button" className="btn btn--primary btn--lg" onClick={run} disabled={busy}>
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
