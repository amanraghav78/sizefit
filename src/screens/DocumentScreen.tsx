/**
 * The PDF equivalent of §8.3 Preview.
 *
 * Preview shows the compressed image, because with a photo the question is
 * "does this still look acceptable". A document cannot be previewed without a
 * PDF renderer, and that is not actually the question here — what someone
 * wants to know before uploading a scan is whether it fits, how many pages
 * survived, and whether anything in it was left untouched. So this screen
 * answers those three, and says so plainly when the answer is bad.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Translate } from '../i18n/strings';
import { Button, Card, Chip, Muted, Row, ScreenHeader } from '../ui/components';
import { formatKB, formatSize } from '../ui/format';
import { spacing, typography, type Theme } from '../ui/theme';

export interface DocumentOutcome {
  uri: string;
  sourceBytes: number;
  finalBytes: number;
  pageCount: number;
  imagesRecompressed: number;
  imagesSkipped: number;
  /** 'exact' | 'best_effort_under' | 'best_effort_over' from the core. */
  status: string;
}

export function DocumentScreen({
  theme,
  t,
  outcome,
  targetLabel,
  maxBytes,
  saving,
  onBack,
  onSave,
  onChangeSize,
}: {
  theme: Theme;
  t: Translate;
  outcome: DocumentOutcome;
  targetLabel: string;
  maxBytes: number;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  onChangeSize: () => void;
}) {
  const overLimit = outcome.finalBytes > maxBytes;
  const saved = outcome.sourceBytes - outcome.finalBytes;
  const percent =
    outcome.sourceBytes > 0 ? Math.round((saved / outcome.sourceBytes) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ScreenHeader title={t('document.title')} onBack={onBack} theme={theme} backLabel={t('a11y.back')} />

      <View style={styles.hero}>
        <Chip
          label={overLimit ? t('document.overLimit') : t('document.fits')}
          theme={theme}
          tone={overLimit ? 'danger' : 'success'}
          icon={overLimit ? 'alert-circle' : 'checkmark-circle'}
        />
        <Text style={[typography.display, { color: overLimit ? theme.danger : theme.accent }]}>
          {formatKB(outcome.finalBytes)}
        </Text>
        <Muted theme={theme}>{targetLabel}</Muted>
      </View>

      <Card theme={theme}>
        <Row>
          <Text style={[typography.body, { color: theme.textMuted }]}>{t('document.before')}</Text>
          <Text style={[typography.body, { color: theme.text }]}>
            {formatSize(outcome.sourceBytes)}
          </Text>
        </Row>
        <Row>
          <Text style={[typography.body, { color: theme.textMuted }]}>{t('document.after')}</Text>
          <Text style={[typography.body, { color: theme.text }]}>
            {formatSize(outcome.finalBytes)}
          </Text>
        </Row>
        <Row>
          <Text style={[typography.body, { color: theme.textMuted }]}>{t('document.pages')}</Text>
          <Text style={[typography.body, { color: theme.text }]}>{outcome.pageCount}</Text>
        </Row>
        {percent > 0 ? (
          <Text style={[typography.caption, { color: theme.textFaint }]}>
            {t('document.saved', { percent: String(percent) })}
          </Text>
        ) : null}
      </Card>

      {/* Both of these are things the user would otherwise discover only after
          uploading, so they are stated here rather than buried. */}
      {outcome.imagesSkipped > 0 ? (
        <Card theme={theme} style={{ backgroundColor: theme.warningSoft, borderColor: theme.warning }}>
          <Text style={[typography.body, { color: theme.text }]}>
            {t('document.skipped', { count: String(outcome.imagesSkipped) })}
          </Text>
        </Card>
      ) : null}

      {overLimit ? (
        <Card theme={theme} style={{ backgroundColor: theme.warningSoft, borderColor: theme.warning }}>
          <Text style={[typography.body, { color: theme.text }]}>
            {outcome.imagesRecompressed === 0
              ? t('document.noImages')
              : t('document.cannotReach', { size: formatKB(maxBytes) })}
          </Text>
        </Card>
      ) : null}

      <Button
        label={t('document.save')}
        onPress={onSave}
        theme={theme}
        icon="share-outline"
        busy={saving}
      />
      <Button
        label={t('document.changeSize')}
        onPress={onChangeSize}
        theme={theme}
        variant="ghost"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  hero: { gap: spacing.sm },
});
