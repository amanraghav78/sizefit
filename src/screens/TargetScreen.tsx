/**
 * §8.2 Target — pick the size the form asks for.
 *
 * Three ways in, in the order people actually need them: a maximum ("under
 * 50 KB"), a range ("between 20 and 50 KB"), or exact numbers typed in. Every
 * tap keeps the same underlying target, so switching between them never loses
 * what was already set.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DimensionMode, ImageFormat } from '../core/types';
import {
  describeBand,
  dimensionOptions,
  matchesDimensionOption,
  type DimensionOption,
  type OutputMode,
  type TargetSpec,
} from '../data/sizeOptions';
import type { Translate } from '../i18n/strings';
import { Button, Card, Chip, Field, Muted, Row, ScreenHeader, Segmented } from '../ui/components';
import { parseKBField, parsePxField } from '../ui/format';
import { RangeSlider } from '../ui/RangeSlider';
import {
  NO_MINIMUM_INDEX,
  highestStopWithin,
  formatStop,
  indexToMinimum,
  minimumToIndex,
  nearestStopIndex,
  stopToKB,
} from '../ui/sizeScale';
import { radius, spacing, typography, type Theme } from '../ui/theme';

export function TargetScreen({
  theme,
  t,
  sourceLabel,
  initialTarget,
  fileCount,
  documentMode = false,
  sourceKB,
  onBack,
  onConfirm,
}: {
  theme: Theme;
  t: Translate;
  sourceLabel: string;
  initialTarget: TargetSpec;
  /** More than one file unlocks the output section. */
  fileCount: number;
  /**
   * The source is a PDF. Pixel size, resize mode and image format are all
   * meaningless for a document — only the byte ceiling applies — so those
   * controls are hidden rather than shown doing nothing.
   */
  documentMode?: boolean;
  /**
   * Size of what is being compressed, in KB. For a batch this is the largest
   * single file, or the total when the output is one PDF, because that is what
   * the ceiling is measured against.
   */
  sourceKB: number;
  onBack: () => void;
  onConfirm: (target: TargetSpec) => void;
}) {
  // A ceiling above the file's own size asks for no compression at all, so
  // that is where the slider ends.
  const capIndex = useMemo(() => highestStopWithin(sourceKB), [sourceKB]);
  const capKB = stopToKB(capIndex);

  const [target, setTarget] = useState<TargetSpec>(() => clampToCap(initialTarget, capKB));
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // A remembered target, or one carried over from a bigger file, can exceed
  // the cap for the file now in hand.
  useEffect(() => {
    setTarget((current) => clampToCap(current, capKB));
    setMaxText((current) => {
      const parsed = parseKBField(current);
      return parsed !== null && parsed > capKB ? String(capKB) : current;
    });
  }, [capKB]);

  // Typed fields keep their own text so a half-typed "1" is not clobbered.
  const [minText, setMinText] = useState(initialTarget.minKB?.toString() ?? '');
  const [maxText, setMaxText] = useState(initialTarget.maxKB.toString());
  const [widthText, setWidthText] = useState(initialTarget.widthPx?.toString() ?? '');
  const [heightText, setHeightText] = useState(initialTarget.heightPx?.toString() ?? '');

  // The slider works in stop indices; the target keeps real KB values, and the
  // typed fields stay in step with both.
  const lowIndex = minimumToIndex(target.minKB);
  const highIndex = nearestStopIndex(target.maxKB);

  const applyRange = (low: number, high: number) => {
    const minKB = indexToMinimum(low);
    const maxKB = stopToKB(high);
    setTarget((current) => ({ ...current, minKB, maxKB }));
    setMinText(minKB === null ? '' : String(minKB));
    setMaxText(String(maxKB));
  };

  const applyDimensions = (option: DimensionOption) => {
    setTarget((current) => ({
      ...current,
      widthPx: option.widthPx,
      heightPx: option.heightPx,
      // Picking a named pixel size means you want that size — so deliver it.
      // 'fit' was the old behaviour and it only ever produced the selected size
      // when the source aspect ratio already matched: a 4:3 photo asked for
      // 350x350 came back 350x263. 'fill' covers the box and crops the
      // overflow, so the label is the truth.
      dimensionMode: option.widthPx === null ? 'preserve' : 'fill',
    }));
    setWidthText(option.widthPx?.toString() ?? '');
    setHeightText(option.heightPx?.toString() ?? '');
  };

  const onMinText = (text: string) => {
    setMinText(text);
    setTarget((current) => ({ ...current, minKB: parseKBField(text) }));
  };

  const onMaxText = (text: string) => {
    setMaxText(text);
    const parsed = parseKBField(text);
    // A typed value is kept verbatim — the slider snaps to the nearest stop for
    // display, but the exact number the user typed is what gets compressed to.
    // It is still capped: the file cannot be asked to grow.
    if (parsed !== null) {
      setTarget((current) => ({ ...current, maxKB: Math.min(parsed, capKB) }));
    }
  };

  const onWidthText = (text: string) => {
    setWidthText(text);
    setTarget((current) => ({ ...current, widthPx: parsePxField(text) }));
  };

  const onHeightText = (text: string) => {
    setHeightText(text);
    setTarget((current) => ({ ...current, heightPx: parsePxField(text) }));
  };

  const maxValid = parseKBField(maxText) !== null;
  const rangeValid = target.minKB === null || target.minKB <= target.maxKB;
  const canConfirm = maxValid && rangeValid;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title={t('target.title')}
          subtitle={sourceLabel}
          theme={theme}
          onBack={onBack}
          backLabel={t('a11y.back')}
        />

        <Card theme={theme} style={styles.sizeCard}>
          <Text style={[typography.label, { color: theme.textMuted }]}>{t('target.sizeRange')}</Text>

          <Text style={[typography.readout, { color: theme.accent }]}>
            {describeBand(target.minKB, target.maxKB, t)}
          </Text>

          <RangeSlider
            lowIndex={lowIndex}
            highIndex={highIndex}
            lowest={NO_MINIMUM_INDEX}
            highest={capIndex}
            onChange={applyRange}
            theme={theme}
            lowLabel={
              target.minKB === null
                ? t('target.noMinimum')
                : `${t('target.min')} ${formatStop(target.minKB)}`
            }
            highLabel={`${t('target.max')} ${formatStop(target.maxKB)}`}
            accessibilityLowLabel={t('a11y.minimumThumb')}
            accessibilityHighLabel={t('a11y.maximumThumb')}
          />

          <Muted theme={theme} style={typography.caption}>
            {target.minKB === null ? t('target.sliderHelpNoMin') : t('target.sliderHelpRange')}
          </Muted>

          <Muted theme={theme} style={typography.caption}>
            {t('target.capNote', { size: formatStop(capKB) })}
          </Muted>
        </Card>

        {documentMode ? (
          <Muted theme={theme} style={typography.caption}>
            {t('target.documentNote')}
          </Muted>
        ) : (
        <View style={styles.group}>
          <Text style={[typography.label, { color: theme.textMuted }]}>{t('target.pixelSize')}</Text>
          <View style={styles.chipGrid}>
            {dimensionOptions.map((option) => (
              <OptionChip
                key={option.id}
                label={t(option.labelKey)}
                sublabel={option.detail || undefined}
                theme={theme}
                selected={matchesDimensionOption(target, option)}
                onPress={() => applyDimensions(option)}
              />
            ))}
          </View>
        </View>
        )}

        {fileCount > 1 ? (
          <View style={styles.group}>
            <Segmented
              label={t('target.outputMode')}
              theme={theme}
              value={target.output}
              onChange={(output: OutputMode) => setTarget((current) => ({ ...current, output }))}
              options={[
                { value: 'images', label: t('target.outputSeparate') },
                { value: 'pdf', label: t('target.outputPdf') },
              ]}
            />
            <Muted theme={theme} style={typography.caption}>
              {target.output === 'pdf' ? t('target.outputPdfHelp') : t('target.outputHelp')}
            </Muted>

            {target.output === 'pdf' ? (
              <Segmented
                label={t('target.pdfPageSize')}
                theme={theme}
                value={target.pdfPageSize}
                onChange={(pdfPageSize: 'image' | 'a4') =>
                  setTarget((current) => ({ ...current, pdfPageSize }))
                }
                options={[
                  { value: 'image', label: t('target.pdfPageImage') },
                  { value: 'a4', label: t('target.pdfPageA4') },
                ]}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.group}>
          <Pressable accessibilityRole="button" onPress={() => setAdvancedOpen((open) => !open)}>
            <Row>
              <Text style={[typography.label, { color: theme.textMuted, flex: 1 }]}>
                {t('target.exactNumbers')}
              </Text>
              <Text style={[typography.label, { color: theme.accent }]}>
                {advancedOpen ? t('target.hide') : t('target.show')}
              </Text>
            </Row>
          </Pressable>

          {advancedOpen ? (
            <Card theme={theme} style={styles.card}>
              <Row style={styles.fieldRow}>
                <Field
                  label={t('target.minimum')}
                  value={minText}
                  onChangeText={onMinText}
                  theme={theme}
                  placeholder={t('target.none')}
                  suffix="KB"
                  style={styles.flex}
                  invalid={maxValid && !rangeValid}
                />
                <Field
                  label={t('target.maximum')}
                  value={maxText}
                  onChangeText={onMaxText}
                  theme={theme}
                  placeholder="50"
                  suffix="KB"
                  style={styles.flex}
                  invalid={!maxValid}
                />
              </Row>

              {documentMode ? null : (
              <>
              <Row style={styles.fieldRow}>
                <Field
                  label={t('target.width')}
                  value={widthText}
                  onChangeText={onWidthText}
                  theme={theme}
                  placeholder={t('target.auto')}
                  suffix="px"
                  style={styles.flex}
                />
                <Field
                  label={t('target.height')}
                  value={heightText}
                  onChangeText={onHeightText}
                  theme={theme}
                  placeholder={t('target.auto')}
                  suffix="px"
                  style={styles.flex}
                />
              </Row>

              <Segmented
                label={t('target.howToResize')}
                theme={theme}
                value={target.dimensionMode}
                onChange={(mode: DimensionMode) =>
                  setTarget((current) => ({ ...current, dimensionMode: mode }))
                }
                options={[
                  { value: 'preserve', label: t('mode.keep') },
                  { value: 'fill', label: t('mode.fill') },
                  { value: 'fit', label: t('mode.fit') },
                  { value: 'exact', label: t('mode.exact') },
                ]}
              />
              <Muted theme={theme} style={typography.caption}>
                {modeHelp(target.dimensionMode, t)}
              </Muted>

              <Segmented
                label={t('target.format')}
                theme={theme}
                value={target.format}
                onChange={(format: ImageFormat) =>
                  setTarget((current) => ({ ...current, format }))
                }
                options={[
                  { value: 'jpeg', label: 'JPEG' },
                  { value: 'png', label: 'PNG' },
                ]}
              />
              {target.format === 'png' ? (
                <Muted theme={theme} style={typography.caption}>
                  {t('target.pngHelp')}
                </Muted>
              ) : null}
              </>
              )}

              {!maxValid ? (
                <Chip label={t('target.errorNeedMax')} theme={theme} tone="danger" />
              ) : null}
              {maxValid && !rangeValid ? (
                <Chip label={t('target.errorMinAboveMax')} theme={theme} tone="danger" />
              ) : null}
            </Card>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <Row>
          <View style={styles.flex}>
            <Text style={[typography.heading, { color: theme.text }]}>
              {describeBand(target.minKB, target.maxKB, t)}
            </Text>
            <Text style={[typography.caption, { color: theme.textMuted }]}>
              {documentMode
                ? 'PDF'
                : target.widthPx !== null && target.heightPx !== null
                  ? `${target.widthPx} × ${target.heightPx} px · ${target.format.toUpperCase()}`
                  : `${t('target.originalPixelSize')} · ${target.format.toUpperCase()}`}
            </Text>
          </View>
        </Row>
        <Button
          label={t('target.compress')}
          onPress={() => onConfirm(target)}
          theme={theme}
          icon="sparkles-outline"
          disabled={!canConfirm}
        />
      </View>
    </View>
  );
}

function OptionChip({
  label,
  sublabel,
  theme,
  selected,
  onPress,
}: {
  label: string;
  sublabel?: string | undefined;
  theme: Theme;
  selected: boolean;
  onPress: () => void;
}) {
  // Hover is what tells a mouse user these chips are choices rather than
  // labels. No-op where there is no pointer.
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.optionChip,
        {
          backgroundColor: selected ? theme.accent : hovered ? theme.surfaceRaised : theme.surface,
          borderColor: selected ? theme.accent : hovered ? theme.borderStrong : theme.border,
          opacity: pressed ? 0.8 : 1,
          cursor: 'pointer',
        },
      ]}
    >
      <Text
        style={[typography.heading, { color: selected ? theme.accentText : theme.text }]}
      >
        {label}
      </Text>
      {sublabel ? (
        <Text
          style={[
            typography.caption,
            { color: selected ? theme.accentText : theme.textMuted },
          ]}
        >
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Keep a target inside what the file itself can justify. */
function clampToCap(target: TargetSpec, capKB: number): TargetSpec {
  if (target.maxKB <= capKB) return target;
  const maxKB = capKB;
  // A floor that no longer fits under the lowered ceiling has to give way too.
  const minKB = target.minKB !== null && target.minKB >= maxKB ? null : target.minKB;
  return { ...target, maxKB, minKB };
}

function modeHelp(mode: DimensionMode, t: Translate): string {
  switch (mode) {
    case 'exact':
      return t('mode.exactHelp');
    case 'fill':
      return t('mode.fillHelp');
    case 'fit':
      return t('mode.fitHelp');
    default:
      return t('mode.keepHelp');
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxl + spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  group: { gap: spacing.md },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionChip: {
    minHeight: 52,
    minWidth: 92,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { gap: spacing.lg },
  sizeCard: { gap: spacing.md },
  fieldRow: { gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1 },
  footer: { padding: spacing.xl, borderTopWidth: 1, gap: spacing.md },
});
