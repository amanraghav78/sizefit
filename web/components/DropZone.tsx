'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * The way into every tool: a large target you can drop onto or click.
 *
 * The file input is a transparent overlay rather than a hidden input behind a
 * button, so the whole panel is one click target and keyboard focus still
 * lands on a real <input type="file">.
 */
export function DropZone({
  accept,
  multiple = false,
  label,
  hint,
  onFiles,
}: {
  accept: string;
  multiple?: boolean;
  label: string;
  hint: string;
  onFiles: (files: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const take = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      onFiles(Array.from(list));
      // Clearing lets the same file be picked twice in a row, which otherwise
      // fires no change event and looks like the page has frozen.
      if (inputRef.current) inputRef.current.value = '';
    },
    [onFiles],
  );

  return (
    <div
      className={over ? 'dropzone dropzone--over' : 'dropzone'}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        take(event.dataTransfer.files);
      }}
    >
      <UploadIcon />
      <strong style={{ fontSize: 19 }}>{label}</strong>
      <span className="dropzone__hint">{hint}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        aria-label={label}
        onChange={(event) => take(event.target.files)}
      />
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      width="38"
      height="38"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M12 4v12" />
    </svg>
  );
}
