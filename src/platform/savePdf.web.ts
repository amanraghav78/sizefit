/** Web build: download the PDF. */
export type PdfOutcomeResult = { ok: true } | { ok: false; reason: 'unavailable' | 'failed'; detail?: string };

export async function savePdf(uri: string): Promise<PdfOutcomeResult> {
  try {
    const link = document.createElement('a');
    link.href = uri;
    link.download = `sizefit-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', detail: String(error) };
  }
}
