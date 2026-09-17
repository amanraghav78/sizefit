/**
 * The string table and the translator (§8: Hindi and English from day one,
 * structured for more later).
 *
 * Pure — no Expo, no React Native — so translation coverage can be tested in
 * Node. Platform locale detection lives in ./index.ts.
 *
 * The table is flat `"screen.key"` JSON, so a new language is one file plus one
 * entry in `bundles`. English is the fallback for any key a translation has not
 * caught up with, so a missing string degrades to readable rather than blank.
 */
import en from './en.json';
import hi from './hi.json';

export type LanguageCode = 'en' | 'hi';
export type LanguagePreference = LanguageCode | 'system';

const bundles: Record<LanguageCode, Record<string, string>> = { en, hi };

export interface LanguageChoice {
  code: LanguagePreference;
  /** Shown in its own language — a Hindi speaker should recognise it. */
  label: string;
}

export const languageChoices: LanguageChoice[] = [
  { code: 'system', label: 'System' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
];

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Build a translator for one language.
 *
 * `{name}` placeholders are replaced from `values`. An unknown key returns the
 * key itself, which makes a missing string obvious in testing rather than
 * silently rendering an empty box.
 */
export function createTranslate(language: LanguageCode): Translate {
  const table = bundles[language];
  const fallback = bundles.en;

  return (key, values) => {
    const template = table[key] ?? fallback[key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = values[name];
      return value === undefined ? match : String(value);
    });
  };
}

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return code === 'en' || code === 'hi';
}

/** Every key English defines — used by the test that keeps translations honest. */
export function englishKeys(): string[] {
  return Object.keys(en);
}

export function keysFor(language: LanguageCode): string[] {
  return Object.keys(bundles[language]);
}
