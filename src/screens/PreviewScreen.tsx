/**
 * §8.3 Preview — what you started with, what you got, and the controls to
 * change it: rotate (§3 allows crop and rotate) and a manual quality override.
 */
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompressRequest, CompressResult, Rotation } from '../core/types';
import type { Translate } from '../i18n/strings';
import {
  Button,
  Card,
  Chip,
  IconButton,
  Muted,
  Row,
  ScreenHeader,
  SectionLabel,
  type ChipTone,
} from '../ui/components';
import { formatDimensions, formatKB, formatSize } from '../ui/format';
import { Slider } from '../ui/Slider';
import { elevation, radius, spacing, typography, type Theme } from '../ui/theme';

export interface SourceInfo {
  uri: string;
  bytes: number;
  width: number;
  height: number;
}

export interface ManualPreview {
  uri: string;
  bytes: number;
  quality: number;
}

export function PreviewScreen({
  theme,
  t,
  source,
  request,
  result,
  targetLabel,
  manual,
  manualBusy,
  rotation,
  rotating,
  onRotate,
  onQualityCommit,
  onResetManual,
  onSwitchToJpeg,
  switching,
  onBack,
  onSave,
  onShare,
  saving,
  bottomInset,
}: {
  theme: Theme;
  t: Translate;
  source: SourceInfo;
  request: CompressRequest;
  result: CompressResult;
  targetLabel: string;
  manual: ManualPreview | null;
  manualBusy: boolean;
  rotation: Rotation;
  rotating: boolean;
  onRotate: (next: Rotation) => void;
  /** Fires when the finger lifts — re-encoding on every pixel would thrash. */
  onQualityCommit: (quality: number) => void;
  onResetManual: () => void;
  /** PNG has no quality lever; this re-runs the whole search as JPEG. */
  onSwitchToJpeg: () => void;
  switching: boolean;
  onBack: () => void;
  onSave: () => void;
  onShare: () => void;
  saving: boolean;
  bottomInset: number;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [quality, setQuality] = useState(result.finalQuality);

  const shownBytes = manual ? manual.bytes : result.finalBytes;
  const overCeiling = shownBytes > request.maxBytes;
  const underFloor = request.minBytes !== null && shownBytes < request.minBytes;
  const status = describeStatus(result, manual, overCeiling, underFloor, t);
  const busy = rotating || manualBusy;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title={t('preview.title')}
          subtitle={targetLabel}
          theme={theme}
          onBack={onBack}
          backLabel={t('a11y.back')}
        />

        <View
          style={[
            styles.stage,
            elevation(1, theme),
            { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
          ]}
        >
          <Image
            accessible
            accessibilityLabel={
              showOriginal ? t('a11y.originalPreview') : t('a11y.resultPreview')
            }
            source={{ uri: showOriginal ? source.uri : (manual?.uri ?? result.outputUri) }}
            style={styles.image}
            resizeMode="contain"
          />
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: showOriginal }}
            accessibilityLabel={
              showOriginal ? t('preview.showingOriginal') : t('preview.showingResult')
            }
            onPress={() => setShowOriginal((v) => !v)}
            style={({ pressed }) => [
              styles.toggle,
              { backgroundColor: theme.overlay, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[typography.label, styles.toggleText]}>
              {showOriginal ? t('preview.showingOriginal') : t('preview.showingResult')}
            </Text>
          </Pressable>
        </View>

        <Card theme={theme}>
          {/* The before/after is the reason the user opened the app, so it is
              the one place with real visual weight. */}
          <View style={styles.readoutRow}>
            <View style={styles.readoutSide}>
              <Text style={[typography.label, { color: theme.textFaint }]}>
                {t('preview.before')}
              </Text>
              <Text style={[typography.title, { color: theme.textMuted }]}>
                {formatSize(source.bytes)}
              </Text>
            </View>
            <View style={[styles.readoutArrow, { backgroundColor: theme.accentSoft }]}>
              <Text style={[typography.heading, { color: theme.accent }]}>→</Text>
            </View>
            <View style={[styles.readoutSide, styles.readoutAfter]}>
              <Text style={[typography.label, { color: theme.textFaint }]}>
                {t('preview.after')}
              </Text>
              <Text style={[typography.readout, { color: theme.accent }]}>
                {formatKB(shownBytes)}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Muted theme={theme} style={typography.caption}>
            {formatDimensions(source.width, source.height)} →{' '}
            {formatDimensions(result.finalWidth, result.finalHeight)}
          </Muted>
          <Chip
            label={status.label}
            theme={theme}
            tone={status.tone}
            icon={status.tone === 'success' ? 'checkmark-circle' : 'alert-circle'}
          />
          {result.paddingBytes > 0 && !manual ? (
            <Muted theme={theme} style={typography.caption}>
              {t('preview.paddedNote', { size: formatKB(result.paddingBytes) })}
            </Muted>
          ) : null}
          {result.passthrough ? (
            <Muted theme={theme} style={typography.caption}>
              {t('preview.passthroughNote')}
            </Muted>
          ) : null}
        </Card>

        <Card theme={theme}>
          <SectionLabel text={t('preview.adjust')} theme={theme} />
          <Row style={styles.rotateRow}>
            <IconButton
              icon="refresh-outline"
              label={t('preview.rotateLeft')}
              onPress={() => onRotate(turn(rotation, -90))}
              theme={theme}
              tone="text"
              style={[styles.rotateButton, styles.flip, { borderColor: theme.border }]}
            />
            <IconButton
              icon="refresh-outline"
              label={t('preview.rotateRight')}
              onPress={() => onRotate(turn(rotation, 90))}
              theme={theme}
              tone="text"
              style={[styles.rotateButton, { borderColor: theme.border }]}
            />
            {rotating ? (
              <Muted theme={theme} style={typography.caption}>
                {t('preview.rotating')}
              </Muted>
            ) : null}
          </Row>

          <Row>
            <Text style={[typography.heading, { color: theme.text, flex: 1 }]}>
              {t('preview.fineTune')}
            </Text>
            <Text style={[typography.label, { color: theme.textMuted }]}>
              {t('preview.quality', { quality })}
            </Text>
          </Row>
          <Slider
            value={quality}
            min={1}
            max={100}
            theme={theme}
            disabled={request.format === 'png' || busy}
            accessibilityLabel={t('a11y.qualitySlider', { quality })}
            onChange={setQuality}
            onCommit={onQualityCommit}
          />
          {request.format === 'png' ? (
            <Muted theme={theme} style={typography.caption}>
              {t('preview.pngNoQuality')}
            </Muted>
          ) : (
            <Muted theme={theme} style={typography.caption}>
              {manualBusy
                ? t('preview.reencoding')
                : manual
                  ? t('preview.manualSetting', {
                      size: formatKB(manual.bytes),
                      quality: manual.quality,
                    })
                  : t('preview.autoSetting', {
                      quality: result.finalQuality,
                      passes: result.iterations,
                    })}
            </Muted>
          )}
          {manual ? (
            <Button
              label={t('preview.backToAuto')}
              onPress={onResetManual}
              theme={theme}
              variant="ghost"
              icon="arrow-undo-outline"
            />
          ) : null}
        </Card>

        {/* PNG is lossless: there is no quality lever and the JPEG padding
            trick does not apply, so a PNG that misses the band cannot be
            argued into it. Saying only "over the limit" would leave the user
            fiddling with a disabled slider, so the one thing that does work is
            offered directly. */}
        {request.format === 'png' && (overCeiling || underFloor) ? (
          <Card theme={theme} style={{ borderColor: theme.warning }}>
            <Text style={[typography.heading, { color: theme.text }]}>
              {t('preview.pngSteerTitle')}
            </Text>
            <Muted theme={theme}>
              {overCeiling
                ? t('preview.pngSteerOver', { limit: formatKB(request.maxBytes) })
                : t('preview.pngSteerUnder', { min: formatKB(request.minBytes ?? 0) })}
            </Muted>
            {/* Stated every time rather than only for images that have alpha:
                the codec port does not report transparency, and a surprise
                white block is worse than a caveat that sometimes does not
                apply. */}
            <Muted theme={theme} style={typography.caption}>
              {t('preview.pngSteerFlatten')}
            </Muted>
            <Button
              label={switching ? t('preview.pngSwitching') : t('preview.pngSwitch')}
              onPress={onSwitchToJpeg}
              theme={theme}
              icon="swap-horizontal-outline"
              busy={switching}
              disabled={busy}
            />
          </Card>
        ) : null}

        {overCeiling ? (
          <Card theme={theme} style={{ borderColor: theme.danger }}>
            <Row>
              <Text style={[typography.heading, { color: theme.danger, flex: 1 }]}>
                {t('preview.overTitle')}
              </Text>
            </Row>
            <Muted theme={theme}>
              {t('preview.overBody', {
                size: formatKB(shownBytes),
                limit: formatKB(request.maxBytes),
              })}
            </Muted>
          </Card>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            paddingBottom: spacing.xl + bottomInset,
          },
        ]}
      >
        <Button
          label={t('preview.save')}
          onPress={onSave}
          theme={theme}
          icon="download-outline"
          busy={saving}
          disabled={overCeiling || busy}
        />
        <Button
          label={t('preview.share')}
          onPress={onShare}
          theme={theme}
          variant="secondary"
          icon="share-outline"
          disabled={overCeiling || busy}
        />
      </View>
    </View>
  );
}

function turn(current: Rotation, by: 90 | -90): Rotation {
  return (((current + by + 360) % 360) as Rotation);
}

function describeStatus(
  result: CompressResult,
  manual: ManualPreview | null,
  overCeiling: boolean,
  underFloor: boolean,
  t: Translate,
): { label: string; tone: ChipTone } {
  if (overCeiling) return { label: t('status.overLimit'), tone: 'danger' };
  if (underFloor) return { label: t('status.underMinimum'), tone: 'warning' };
  if (manual) return { label: t('status.inside'), tone: 'success' };

  switch (result.status) {
    case 'exact':
      return {
        label: result.passthrough ? t('status.alreadyWithin') : t('status.inside'),
        tone: 'success',
      };
    case 'best_effort_under':
      return { label: t('status.underLimitBelowMin'), tone: 'warning' };
    case 'best_effort_over':
      return { label: t('status.couldNotReach'), tone: 'danger' };
    default:
      return { label: t('status.failed'), tone: 'danger' };
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  stage: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    height: 260,
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  toggle: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  toggleText: { color: '#FFFFFF' },
  readoutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  readoutSide: { gap: 2 },
  readoutAfter: { flex: 1 },
  readoutArrow: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: StyleSheet.hairlineWidth },
  rotateRow: { gap: spacing.sm },
  rotateButton: { borderWidth: 1, borderRadius: radius.md },
  flip: { transform: [{ scaleX: -1 }] },
  footer: { padding: spacing.xl, borderTopWidth: 1, gap: spacing.md },
});
