/**
 * Batch results (§12 Phase 5).
 *
 * Shows one row per file with its own before/after and status, so a single bad
 * item is visible rather than hidden behind an aggregate "done". When the
 * output is a PDF, the document's own size is what matters and gets the
 * headline.
 */
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompressResult } from '../core/types';
import type { Translate } from '../i18n/strings';
import {
  Button,
  Card,
  Chip,
  IconButton,
  Muted,
  ProgressBar,
  Row,
  ScreenHeader,
  type ChipTone,
} from '../ui/components';
import { formatKB, formatSize } from '../ui/format';
import { radius, spacing, typography, type Theme } from '../ui/theme';

export interface BatchItem {
  sourceUri: string;
  name: string;
  sourceBytes: number;
  result: CompressResult | null;
  error: string | null;
}

export interface PdfOutcome {
  uri: string;
  bytes: number;
  pages: number;
  overLimit: boolean;
}

export function BatchScreen({
  theme,
  t,
  items,
  maxBytes,
  targetLabel,
  busy,
  progress,
  pdf,
  saving,
  onBack,
  onSaveAll,
  onSavePdf,
  onSharePdf,
  onRemove,
}: {
  theme: Theme;
  t: Translate;
  items: BatchItem[];
  maxBytes: number;
  targetLabel: string;
  busy: boolean;
  progress: { done: number; total: number } | null;
  pdf: PdfOutcome | null;
  saving: boolean;
  onBack: () => void;
  onSaveAll: () => void;
  onSavePdf: () => void;
  onSharePdf: () => void;
  onRemove: (sourceUri: string) => void;
}) {
  const done = items.filter((item) => item.result !== null);
  const totalBefore = items.reduce((sum, item) => sum + item.sourceBytes, 0);
  const totalAfter = done.reduce((sum, item) => sum + (item.result?.finalBytes ?? 0), 0);
  const overCount = done.filter((item) => (item.result?.finalBytes ?? 0) > maxBytes).length;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title={t('batch.title', { count: items.length })}
          subtitle={targetLabel}
          theme={theme}
          onBack={onBack}
        />

        <Card theme={theme}>
          {busy && progress ? (
            <>
              <Text style={[typography.heading, { color: theme.text }]}>
                {t('batch.compressing', { done: progress.done, total: progress.total })}
              </Text>
              <ProgressBar
                value={progress.total === 0 ? 0 : progress.done / progress.total}
                theme={theme}
                label={t('batch.compressing', { done: progress.done, total: progress.total })}
              />
            </>
          ) : (
            <Text style={[typography.readout, { color: theme.text }]}>
              {formatSize(totalBefore)} → {formatSize(totalAfter)}
            </Text>
          )}

          {pdf ? (
            <Chip
              label={t('batch.pdfReady', { pages: pdf.pages, size: formatKB(pdf.bytes) })}
              theme={theme}
              tone={pdf.overLimit ? 'danger' : 'success'}
            />
          ) : null}

          {overCount > 0 && !pdf ? (
            <Chip
              label={overCount === 1 ? t('batch.oneOver') : t('batch.someOver', { count: overCount })}
              theme={theme}
              tone="danger"
            />
          ) : null}

          {pdf?.overLimit ? (
            <Muted theme={theme}>
              {t('batch.pdfOver', { size: formatKB(pdf.bytes), limit: formatKB(maxBytes) })}
            </Muted>
          ) : null}
        </Card>

        {items.map((item) => (
          <ItemRow
            key={item.sourceUri}
            item={item}
            theme={theme}
            t={t}
            maxBytes={maxBytes}
            canRemove={!busy && items.length > 1}
            onRemove={() => onRemove(item.sourceUri)}
          />
        ))}
      </ScrollView>

      <View
        style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}
      >
        {pdf ? (
          <>
            <Button
              label={t('batch.savePdf')}
              onPress={onSavePdf}
              theme={theme}
              icon="download-outline"
              busy={saving}
              disabled={busy || pdf.overLimit}
            />
            <Button
              label={t('batch.sharePdf')}
              onPress={onSharePdf}
              theme={theme}
              variant="secondary"
              icon="share-outline"
              disabled={busy || pdf.overLimit}
            />
          </>
        ) : (
          <Button
            label={t('batch.saveAll')}
            onPress={onSaveAll}
            theme={theme}
            icon="download-outline"
            busy={saving}
            disabled={busy || done.length === 0}
          />
        )}
      </View>
    </View>
  );
}

function ItemRow({
  item,
  theme,
  t,
  maxBytes,
  canRemove,
  onRemove,
}: {
  item: BatchItem;
  theme: Theme;
  t: Translate;
  maxBytes: number;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const status = itemStatus(item, maxBytes, t);

  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Image
        source={{ uri: item.result?.outputUri ?? item.sourceUri }}
        style={[styles.thumb, { backgroundColor: theme.surfaceRaised }]}
        resizeMode="cover"
      />
      <View style={styles.rowText}>
        <Text style={[typography.heading, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[typography.caption, { color: theme.textMuted }]}>
          {formatSize(item.sourceBytes)}
          {item.result ? ` → ${formatKB(item.result.finalBytes)}` : ''}
        </Text>
        {status ? <Chip label={status.label} theme={theme} tone={status.tone} /> : null}
      </View>
      {canRemove ? (
        <IconButton
          icon="close"
          label={t('a11y.removeFile', { name: item.name })}
          onPress={onRemove}
          theme={theme}
          size={18}
        />
      ) : null}
    </View>
  );
}

function itemStatus(
  item: BatchItem,
  maxBytes: number,
  t: Translate,
): { label: string; tone: ChipTone } | null {
  if (item.error) return { label: t('batch.itemFailed'), tone: 'danger' };
  if (!item.result) return null;
  if (item.result.finalBytes > maxBytes) return { label: t('status.overLimit'), tone: 'danger' };
  if (item.result.status === 'best_effort_under') {
    return { label: t('status.underLimitBelowMin'), tone: 'warning' };
  }
  return { label: t('status.inside'), tone: 'success' };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxl + spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  rowText: { flex: 1, gap: 4 },
  footer: { padding: spacing.xl, borderTopWidth: 1, gap: spacing.md },
});
