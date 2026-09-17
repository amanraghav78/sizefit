/**
 * Recently used targets, for the row on Home (§8.1).
 *
 * Stores plain size targets locally. Nothing here leaves the device and
 * nothing identifies the user.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normaliseTarget, type TargetSpec } from './sizeOptions';

const KEY = 'sizefit.recent.v2';
const MAX_RECENTS = 6;

export interface RecentTarget {
  target: TargetSpec;
  usedAt: number;
}

export async function loadRecents(): Promise<RecentTarget[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as RecentTarget[])
      .filter(isUsable)
      // Older entries predate some fields; fill them in rather than dropping
      // the user's history on an upgrade.
      .map((item) => ({ ...item, target: normaliseTarget(item.target) }))
      .slice(0, MAX_RECENTS);
  } catch {
    // A corrupt store is not worth an error screen; start fresh.
    return [];
  }
}

export async function rememberTarget(target: TargetSpec): Promise<RecentTarget[]> {
  const existing = await loadRecents();
  const deduped = existing.filter((item) => !isSameTarget(item.target, target));
  const next = [{ target, usedAt: Date.now() }, ...deduped].slice(0, MAX_RECENTS);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Losing a recent entry is harmless; never block the flow on it.
  }
  return next;
}

export async function clearRecents(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignored
  }
}

function isUsable(item: RecentTarget): boolean {
  return (
    typeof item?.target?.maxKB === 'number' &&
    Number.isFinite(item.target.maxKB) &&
    item.target.maxKB > 0
  );
}

function isSameTarget(a: TargetSpec, b: TargetSpec): boolean {
  return (
    a.minKB === b.minKB &&
    a.maxKB === b.maxKB &&
    a.widthPx === b.widthPx &&
    a.heightPx === b.heightPx &&
    a.dimensionMode === b.dimensionMode &&
    a.format === b.format &&
    a.output === b.output
  );
}
