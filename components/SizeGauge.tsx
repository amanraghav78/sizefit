'use client';

import { formatBytes } from '@/lib/engine';

/**
 * The size gauge: where the result landed, between its original size and the
 * ceiling it had to clear.
 *
 * The scale is logarithmic because the interesting cases span three orders of
 * magnitude — a 4MB photo squeezed to 40KB is the normal job, and on a linear
 * axis the whole result would sit invisibly against the left edge. The label
 * on the artboard says so out loud, and so does this.
 */
export function SizeGauge({
  sourceBytes,
  finalBytes,
  targetBytes,
}: {
  sourceBytes: number;
  finalBytes: number;
  targetBytes: number;
}) {
  const lo = Math.max(1024, Math.min(finalBytes, targetBytes) / 8);
  const hi = Math.max(sourceBytes, targetBytes, lo * 4);

  const at = (value: number) => {
    const span = Math.log10(hi) - Math.log10(lo);
    if (span <= 0) return 0;
    const ratio = (Math.log10(Math.max(value, lo)) - Math.log10(lo)) / span;
    return Math.min(100, Math.max(0, ratio * 100));
  };

  const finalAt = at(finalBytes);
  const targetAt = at(targetBytes);
  const sourceAt = at(sourceBytes);

  return (
    <div className="gauge" role="img" aria-label={`${formatBytes(finalBytes)}, against a ceiling of ${formatBytes(targetBytes)}, from ${formatBytes(sourceBytes)}`}>
      <span className="tag gauge__label">Size gauge · log scale</span>

      <div className="gauge__track" />
      {/* The distance travelled: from where it landed to where it started. */}
      <div
        className="gauge__fill"
        style={{ left: `calc(44px + ${finalAt}%)`, width: `${Math.max(0, sourceAt - finalAt)}%` }}
      />

      <div className="gauge__target" style={{ left: `calc(44px + ${targetAt}%)` }} />
      <span className="gauge__targetLabel" style={{ left: `calc(44px + ${targetAt}%)` }}>
        TARGET {formatBytes(targetBytes)}
      </span>

      <div className="gauge__pin" style={{ left: `calc(44px + ${finalAt}%)` }} />
      <span className="gauge__pinLabel" style={{ left: `calc(44px + ${finalAt}%)` }}>
        {formatBytes(finalBytes)}
      </span>

      <div className="gauge__end" style={{ left: `calc(44px + ${sourceAt}%)` }} />
      <span className="gauge__endLabel" style={{ left: `calc(44px + ${sourceAt}%)` }}>
        {formatBytes(sourceBytes)}
      </span>
    </div>
  );
}
