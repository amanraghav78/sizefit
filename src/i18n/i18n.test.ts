import { describe, expect, it } from 'vitest';
import { createTranslate, englishKeys, keysFor } from './strings';

describe('translations', () => {
  it('covers every English key in Hindi', () => {
    const missing = englishKeys().filter((key) => !keysFor('hi').includes(key));
    expect(missing, `Hindi is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no Hindi keys that English does not define', () => {
    const extra = keysFor('hi').filter((key) => !englishKeys().includes(key));
    expect(extra, `Hindi has orphans: ${extra.join(', ')}`).toEqual([]);
  });

  it('keeps the same placeholders in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort();
    const en = createTranslate('en');
    const hi = createTranslate('hi');
    for (const key of englishKeys()) {
      expect(placeholders(hi(key)), `${key} placeholders differ`).toEqual(placeholders(en(key)));
    }
  });

  it('substitutes values', () => {
    const t = createTranslate('en');
    expect(t('settings.version', { version: '0.1.0' })).toBe('Version 0.1.0');
  });

  it('leaves unknown placeholders alone rather than printing undefined', () => {
    const t = createTranslate('en');
    expect(t('settings.version')).toBe('Version {version}');
  });

  it('falls back to English for an untranslated key', () => {
    const t = createTranslate('hi');
    expect(t('app.name')).toBe('SizeFit');
  });

  it('returns the key itself when nothing defines it', () => {
    const t = createTranslate('en');
    expect(t('nope.not.a.key')).toBe('nope.not.a.key');
  });
});
