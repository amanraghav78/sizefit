/**
 * §8.1 Home — cold launch to file picker in one tap.
 *
 * The hero carries the name, the promise and the primary action; everything
 * below it stays quiet, so the eye lands on the one thing to do first instead
 * of scanning an even field of cards.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RecentTarget } from '../data/recentStore';
import { describeBand } from '../data/sizeOptions';
import type { Translate } from '../i18n/strings';
import { Button, Card, IconButton, Muted, SectionLabel } from '../ui/components';
import { Hero } from '../ui/Hero';
import { elevation, radius, spacing, typography, type Theme } from '../ui/theme';

export function HomeScreen({
  theme,
  t,
  recents,
  busy,
  onPickPhoto,
  onPickFile,
  onPickRecent,
  onOpenSettings,
}: {
  theme: Theme;
  t: Translate;
  recents: RecentTarget[];
  busy: boolean;
  onPickPhoto: () => void;
  onPickFile: () => void;
  onPickRecent: (recent: RecentTarget) => void;
  onOpenSettings: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Hero
        theme={theme}
        title={t('app.name')}
        tagline={t('app.tagline')}
        points={[
          { icon: 'resize-outline', label: t('home.pointExact') },
          { icon: 'cloud-offline-outline', label: t('home.pointOffline') },
          { icon: 'lock-closed-outline', label: t('home.pointPrivate') },
        ]}
      >
        <Button
          label={t('home.selectPhotos')}
          onPress={onPickPhoto}
          theme={theme}
          busy={busy}
          icon="images-outline"
          variant="onAccent"
        />
        <Button
          label={t('home.selectFile')}
          onPress={onPickFile}
          theme={theme}
          disabled={busy}
          icon="document-outline"
          variant="onAccentGhost"
        />
      </Hero>

      <View style={styles.body}>
        {recents.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel text={t('home.useAgain')} theme={theme} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentRow}
            >
              {recents.map((recent) => (
                <RecentCard
                  key={recent.usedAt}
                  recent={recent}
                  theme={theme}
                  t={t}
                  onPress={() => onPickRecent(recent)}
                />
              ))}
            </ScrollView>
          </View>
        ) : (
          <Card theme={theme} style={styles.howCard}>
            <SectionLabel text={t('home.howTitle')} theme={theme} />
            {[t('home.howStep1'), t('home.howStep2'), t('home.howStep3')].map((step, index) => (
              <View key={step} style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: theme.accentSoft }]}>
                  <Text style={[typography.label, { color: theme.accent }]}>{index + 1}</Text>
                </View>
                <Text style={[typography.body, styles.stepText, { color: theme.text }]}>
                  {step}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <View style={styles.footerRow}>
          <Muted theme={theme} style={[typography.caption, styles.footerText]}>
            {t('home.privacyBody')}
          </Muted>
          <IconButton
            icon="settings-outline"
            label={t('home.settings')}
            onPress={onOpenSettings}
            theme={theme}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function RecentCard({
  recent,
  theme,
  t,
  onPress,
}: {
  recent: RecentTarget;
  theme: Theme;
  t: Translate;
  onPress: () => void;
}) {
  const { target } = recent;
  const dims =
    target.widthPx !== null && target.heightPx !== null
      ? `${target.widthPx} × ${target.heightPx} px`
      : t('target.originalPixelSize');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={describeBand(target.minKB, target.maxKB, t)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.recentCard,
        elevation(1, theme),
        {
          backgroundColor: theme.surface,
          borderColor: pressed ? theme.accent : theme.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Text style={[typography.heading, { color: theme.accent }]} numberOfLines={1}>
        {describeBand(target.minKB, target.maxKB, t)}
      </Text>
      <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={1}>
        {dims}
      </Text>
      <Text style={[typography.caption, { color: theme.textFaint }]}>
        {target.format.toUpperCase()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  body: { padding: spacing.xl, gap: spacing.xl },
  section: { gap: spacing.md },
  recentRow: { gap: spacing.md, paddingRight: spacing.xl, paddingVertical: spacing.xs },
  recentCard: {
    minWidth: 150,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: 2,
    justifyContent: 'center',
  },
  howCard: { gap: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footerText: { flex: 1 },
});
