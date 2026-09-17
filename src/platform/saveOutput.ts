/**
 * Save the finished file where the platform expects it.
 * Native: the gallery, via expo-media-library (Metro picks saveOutput.web.ts on web).
 *
 * Returns a reason code rather than a sentence — the UI owns the wording so it
 * can be translated (§8: Hindi and English from day one).
 */
export type SaveFailure = 'permission_denied' | 'failed';
export type SaveOutcome = { ok: true } | { ok: false; reason: SaveFailure; detail?: string };

export async function saveOutput(uri: string): Promise<SaveOutcome> {
  try {
    // Imported lazily: expo-media-library is native-only and throws on import
    // under a web bundle, which would blank the screen before anything renders.
    const MediaLibrary = await import('expo-media-library');

    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      // §13 test 12: denying permission must explain itself, not crash.
      return { ok: false, reason: 'permission_denied' };
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', detail: String(error) };
  }
}
