/**
 * Hand a finished PDF to the user.
 *
 * Native goes through the share sheet rather than the media library on
 * purpose: expo-media-library stores photos and videos, not documents. The
 * share sheet is what lets someone drop the file into Files, Drive, WhatsApp or
 * straight into the form they are filling in.
 */
export type PdfOutcomeResult = { ok: true } | { ok: false; reason: 'unavailable' | 'failed'; detail?: string };

export async function savePdf(uri: string): Promise<PdfOutcomeResult> {
  try {
    const Sharing = await import('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: 'unavailable' };
    }
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', detail: String(error) };
  }
}
