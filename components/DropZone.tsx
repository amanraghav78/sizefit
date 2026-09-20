'use client';

import { useCallback, useRef, useState } from 'react';
import { Mascot } from '@/components/chrome';

/**
 * The way into every tool: a large dashed target you can drop onto or click.
 *
 * The file input is a transparent overlay rather than a hidden input behind a
 * button, so the whole panel is one click target while keyboard focus still
 * lands on a real <input type="file">.
 */
export function DropZone({
  accept,
  multiple = false,
  label,
  formats,
  onFiles,
}: {
  accept: string;
  multiple?: boolean;
  label: string;
  formats: string;
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
    <div className="paper paper--orange" style={{ padding: 22 }}>
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
        <Mascot />
        <span className="dropzone__title">{label}</span>
        <span className="btn btn--action" aria-hidden="true">
          Choose {multiple ? 'files' : 'a file'}
        </span>
        <span className="dropzone__formats">{formats}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          aria-label={label}
          onChange={(event) => take(event.target.files)}
        />
      </div>
    </div>
  );
}
