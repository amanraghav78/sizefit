/** Web build: the browser owns its own blob lifetime, so these are no-ops. */
export const LOW_DISK_BYTES = 50 * 1024 * 1024;

export function freeDiskBytes(): number | null {
  return null;
}

export function isLowOnDisk(): boolean {
  return false;
}

export async function clearTempFiles(): Promise<number> {
  return 0;
}
