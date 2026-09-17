/**
 * §8: file sizes are always shown in the unit the portal uses — KB, never
 * "0.05 MB". Only genuinely large sources get MB, because "4102 KB" tells a
 * user nothing about their 4 MB holiday photo.
 */
const KB = 1024;
const MB = 1024 * KB;

export function formatSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / KB))} KB`;
}

/** Always KB, for anything being compared against a portal's KB limit. */
export function formatKB(bytes: number): string {
  return `${Math.round(bytes / KB)} KB`;
}

export function formatDimensions(width: number, height: number): string {
  return `${width} × ${height} px`;
}

export function kbToBytes(kb: number): number {
  return Math.round(kb * KB);
}

/** Parse a user-typed KB field. Empty or nonsense becomes null. */
export function parseKBField(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function parsePxField(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Math.round(Number(trimmed));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
