/** Web build: hand the file to the browser as a download. */
export type SaveFailure = 'permission_denied' | 'failed';
export type SaveOutcome = { ok: true } | { ok: false; reason: SaveFailure; detail?: string };

export async function saveOutput(uri: string): Promise<SaveOutcome> {
  try {
    const link = document.createElement('a');
    link.href = uri;
    link.download = `sizefit-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', detail: String(error) };
  }
}
