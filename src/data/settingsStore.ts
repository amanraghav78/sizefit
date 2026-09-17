/**
 * User settings. Local only — nothing here is transmitted anywhere.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LanguagePreference } from '../i18n/strings';

const KEY = 'sizefit.settings.v1';

export interface Settings {
  language: LanguagePreference;
}

export const defaultSettings: Settings = { language: 'system' };

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const language = parsed.language;
    if (language === 'en' || language === 'hi' || language === 'system') {
      return { language };
    }
    return defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // A settings write that fails is not worth interrupting the user for.
  }
}
