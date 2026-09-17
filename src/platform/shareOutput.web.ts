/** Web build: browsers cannot open a native share sheet for a blob reliably. */
export type ShareFailure = 'unavailable' | 'failed';
export type ShareOutcome = { ok: true } | { ok: false; reason: ShareFailure; detail?: string };

export async function shareOutput(_uri: string): Promise<ShareOutcome> {
  return { ok: false, reason: 'unavailable' };
}
