/** Share the finished file via the system share sheet (§8.3). */
export type ShareFailure = 'unavailable' | 'failed';
export type ShareOutcome = { ok: true } | { ok: false; reason: ShareFailure; detail?: string };

export async function shareOutput(uri: string): Promise<ShareOutcome> {
  try {
    const Sharing = await import('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: 'unavailable' };
    }
    await Sharing.shareAsync(uri, { mimeType: 'image/jpeg' });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', detail: String(error) };
  }
}
