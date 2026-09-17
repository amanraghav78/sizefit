/**
 * Storage hygiene (§10) and the free-space guard (§5.3).
 *
 * Temp files are deleted by the codec at the end of every run. This sweep is
 * the backstop for the case the codec never got to finish — the app was killed
 * mid-compression — and runs at launch, when the app goes to the background,
 * and on a 24-hour timer.
 */
import { Directory, Paths } from 'expo-file-system';

/** §5.3: warn below this much free space before starting work. */
export const LOW_DISK_BYTES = 50 * 1024 * 1024;

const WORK_DIRS = [
  'sizefit-work', // files this app writes directly (JPEG padding)
  'ImageManipulator', // where expo-image-manipulator drops its renders
];

export function freeDiskBytes(): number | null {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return null;
  }
}

export function isLowOnDisk(): boolean {
  const free = freeDiskBytes();
  return free !== null && free < LOW_DISK_BYTES;
}

/** Delete leftover working files. Returns how many directories were cleared. */
export async function clearTempFiles(): Promise<number> {
  let cleared = 0;
  for (const name of WORK_DIRS) {
    try {
      const dir = new Directory(Paths.cache, name);
      if (dir.exists) {
        dir.delete();
        cleared += 1;
      }
    } catch {
      // A cache file we cannot delete is not an error worth surfacing.
    }
  }
  return cleared;
}
