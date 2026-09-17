/**
 * Language selection. The string table itself lives in ./strings.ts, which is
 * pure so it can be unit-tested; this file adds the platform locale lookup.
 */
import { getLocales } from 'expo-localization';
import { isSupportedLanguage, type LanguageCode, type LanguagePreference } from './strings';

export * from './strings';

/** The device language, when it is one we ship. Otherwise English. */
export function systemLanguage(): LanguageCode {
  try {
    for (const locale of getLocales()) {
      const code = locale.languageCode?.toLowerCase();
      if (isSupportedLanguage(code)) return code;
    }
  } catch {
    // Localization is unavailable on some targets; English is a fine default.
  }
  return 'en';
}

export function resolveLanguage(preference: LanguagePreference): LanguageCode {
  return preference === 'system' ? systemLanguage() : preference;
}
