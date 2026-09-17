/**
 * Settings — language, storage housekeeping, and the privacy statement that
 * §10 wants stated in-app as well as in the store listing.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Settings } from '../data/settingsStore';
import { languageChoices, type LanguagePreference, type Translate } from '../i18n/strings';
import { Button, Card, Muted, ScreenHeader, SectionLabel, Segmented } from '../ui/components';
import { spacing, typography, type Theme } from '../ui/theme';

export function SettingsScreen({
  theme,
  t,
  settings,
  version,
  onChangeLanguage,
  onClearCache,
  onClearRecents,
  onBack,
}: {
  theme: Theme;
  t: Translate;
  settings: Settings;
  version: string;
  onChangeLanguage: (language: LanguagePreference) => void;
  onClearCache: () => void;
  onClearRecents: () => void;
  onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title={t('settings.title')} theme={theme} onBack={onBack} />

      <Segmented
        label={t('settings.language')}
        theme={theme}
        value={settings.language}
        onChange={onChangeLanguage}
        options={languageChoices.map((choice) => ({
          value: choice.code,
          // "System" is the only label worth translating; the others are
          // endonyms and should read the same in any language.
          label: choice.code === 'system' ? t('settings.languageSystem') : choice.label,
        }))}
      />

      <View style={styles.section}>
        <SectionLabel text={t('settings.storage')} theme={theme} />
        <Button
          label={t('settings.clearCache')}
          onPress={onClearCache}
          theme={theme}
          variant="secondary"
          icon="trash-outline"
        />
        <Button
          label={t('settings.clearRecents')}
          onPress={onClearRecents}
          theme={theme}
          variant="secondary"
          icon="time-outline"
        />
      </View>

      <View style={styles.section}>
        <SectionLabel text={t('settings.about')} theme={theme} />
        <Card theme={theme}>
          <Muted theme={theme}>{t('settings.privacyBody')}</Muted>
          <Text style={[typography.caption, { color: theme.textFaint }]}>
            {t('settings.version', { version })}
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxl + spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  section: { gap: spacing.md },
});
