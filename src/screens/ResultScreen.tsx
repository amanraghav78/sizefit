/**
 * §8.4 Result — confirmation, and a big button for the most common next action.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Translate } from '../i18n/strings';
import { Button, Card, Chip, Muted } from '../ui/components';
import { formatKB } from '../ui/format';
import { spacing, typography, type Theme } from '../ui/theme';

export function ResultScreen({
  theme,
  t,
  savedMessage,
  savedPath,
  finalBytes,
  targetLabel,
  onCompressAnother,
  onDone,
}: {
  theme: Theme;
  t: Translate;
  savedMessage: string;
  savedPath: string | null;
  finalBytes: number;
  targetLabel: string;
  onCompressAnother: () => void;
  onDone: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Chip label={t('result.done')} theme={theme} tone="success" icon="checkmark-circle" />
        <Text style={[typography.display, { color: theme.accent }]}>{formatKB(finalBytes)}</Text>
        <Muted theme={theme}>{targetLabel}</Muted>
      </View>

      <Card theme={theme}>
        <Text style={[typography.heading, { color: theme.text }]}>{savedMessage}</Text>
        {savedPath ? (
          <Text style={[typography.caption, { color: theme.textFaint }]} numberOfLines={3}>
            {savedPath}
          </Text>
        ) : null}
      </Card>

      {/* The most common next action, so it gets the most weight (§8.4). */}
      <Button
        label={t('result.compressAnother')}
        onPress={onCompressAnother}
        theme={theme}
        icon="add-circle-outline"
      />
      <Button label={t('result.finish')} onPress={onDone} theme={theme} variant="ghost" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxl + spacing.xl,
    gap: spacing.xl,
  },
  hero: { gap: spacing.sm },
});
