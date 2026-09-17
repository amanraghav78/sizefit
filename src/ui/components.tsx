/**
 * Shared UI pieces. Everything takes the theme explicitly rather than reaching
 * for context, so a component can never render with the wrong palette.
 *
 * Two rules the whole app follows and these components enforce:
 * - Nothing interactive is smaller than TOUCH_TARGET (§8: users are rushing).
 * - Every control carries an accessibility role and label, including the
 *   icon-only ones, where the glyph is meaningless to a screen reader.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { TOUCH_TARGET, elevation, radius, spacing, typography, type Theme } from './theme';

export type IconName = keyof typeof Ionicons.glyphMap;

export function Button({
  label,
  onPress,
  theme,
  variant = 'primary',
  icon,
  disabled = false,
  busy = false,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  theme: Theme;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'onAccent' | 'onAccentGhost';
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const palette = {
    primary: { bg: theme.accent, fg: theme.accentText, border: 'transparent', lift: 1 as const },
    secondary: { bg: theme.surface, fg: theme.text, border: theme.borderStrong, lift: 0 as const },
    ghost: { bg: 'transparent', fg: theme.textMuted, border: 'transparent', lift: 0 as const },
    danger: { bg: theme.dangerSoft, fg: theme.danger, border: 'transparent', lift: 0 as const },
    // For use inside the hero, where the ground is already saturated.
    onAccent: { bg: '#FFFFFF', fg: theme.accentGradient[1], border: 'transparent', lift: 1 as const },
    onAccentGhost: {
      bg: 'rgba(255,255,255,0.14)',
      fg: '#FFFFFF',
      border: 'rgba(255,255,255,0.45)',
      lift: 0 as const,
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        elevation(disabled ? 0 : palette.lift, theme),
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'secondary' || variant === 'onAccentGhost' ? 1 : 0,
          opacity: disabled ? 0.4 : pressed ? 0.78 : 1,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={palette.fg} size="small" /> : null}
      {!busy && icon ? <Ionicons name={icon} size={19} color={palette.fg} /> : null}
      <Text style={[typography.heading, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Icon-only control. The label is for screen readers, not the eye. */
export function IconButton({
  icon,
  label,
  onPress,
  theme,
  size = 22,
  tone = 'muted',
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  theme: Theme;
  size?: number;
  tone?: 'muted' | 'text' | 'accent' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const color = {
    muted: theme.textMuted,
    text: theme.text,
    accent: theme.accent,
    danger: theme.danger,
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Card({
  children,
  theme,
  style,
  lifted = true,
}: {
  children: ReactNode;
  theme: Theme;
  style?: StyleProp<ViewStyle>;
  lifted?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        lifted ? elevation(1, theme) : null,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

export function Chip({
  label,
  theme,
  tone = 'neutral',
  icon,
  style,
}: {
  label: string;
  theme: Theme;
  tone?: ChipTone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const tones: Record<ChipTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.surfaceRaised, fg: theme.textMuted },
    success: { bg: theme.successSoft, fg: theme.success },
    warning: { bg: theme.warningSoft, fg: theme.warning },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
    accent: { bg: theme.accentSoft, fg: theme.accent },
  };
  const palette = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: palette.bg }, style]}>
      {icon ? <Ionicons name={icon} size={13} color={palette.fg} /> : null}
      <Text style={[typography.label, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  theme,
  placeholder,
  suffix,
  keyboardType = 'number-pad',
  style,
  invalid = false,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  theme: Theme;
  placeholder?: string;
  suffix?: string;
  keyboardType?: 'number-pad' | 'default';
  style?: StyleProp<ViewStyle>;
  invalid?: boolean;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={[typography.label, { color: theme.textMuted }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.surface,
            borderColor: invalid ? theme.danger : theme.border,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textFaint}
          keyboardType={keyboardType}
          selectionColor={theme.accent}
          style={[styles.input, typography.body, { color: theme.text }]}
        />
        {suffix ? (
          <Text style={[typography.body, { color: theme.textFaint }]}>{suffix}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** A segmented control. Used for dimension mode, format, output and language. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  theme,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  theme: Theme;
  label?: string;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={[typography.label, { color: theme.textMuted }]}>{label}</Text> : null}
      <View
        style={[
          styles.segmented,
          { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
        ]}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.segment,
                selected && { backgroundColor: theme.accent },
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text
                style={[
                  typography.label,
                  { color: selected ? theme.accentText : theme.textMuted },
                ]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Determinate progress, for batch runs. */
export function ProgressBar({
  value,
  theme,
  label,
}: {
  /** 0..1 */
  value: number;
  theme: Theme;
  label?: string;
}) {
  const width = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.min(1, Math.max(0, value)),
      duration: 260,
      easing: Easing.out(Easing.quad),
      // width cannot be driven natively; the bar is small so it stays cheap.
      useNativeDriver: false,
    }).start();
  }, [value, width]);

  return (
    <View
      accessibilityRole="progressbar"
      {...(label ? { accessibilityLabel: label } : {})}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[styles.progressTrack, { backgroundColor: theme.border }]}
    >
      <Animated.View
        style={[
          styles.progressFill,
          {
            backgroundColor: theme.accent,
            width: width.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

/**
 * A transient message anchored to the bottom of the screen.
 *
 * Replaces the modal dialog the design doc rules out in the happy path (§8):
 * it reports without blocking, and it can be dismissed.
 */
export function Toast({
  message,
  tone,
  theme,
  actionLabel,
  onAction,
  onDismiss,
  style,
}: {
  message: string;
  tone: 'info' | 'error';
  theme: Theme;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slide, message]);

  const isError = tone === 'error';

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        elevation(2, theme),
        {
          backgroundColor: isError ? theme.dangerSoft : theme.surfaceRaised,
          borderColor: isError ? theme.danger : theme.border,
          opacity: slide,
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
        style,
      ]}
    >
      <Ionicons
        name={isError ? 'alert-circle' : 'checkmark-circle'}
        size={20}
        color={isError ? theme.danger : theme.success}
      />
      <Text style={[typography.body, styles.toastText, { color: theme.text }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={[typography.label, { color: theme.accent }]}>
            {actionLabel.toUpperCase()}
          </Text>
        </Pressable>
      ) : null}
      <IconButton icon="close" label="Dismiss" onPress={onDismiss} theme={theme} size={18} />
    </Animated.View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  theme,
}: {
  icon: IconName;
  title: string;
  body: string;
  theme: Theme;
}) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceRaised }]}>
        <Ionicons name={icon} size={26} color={theme.textFaint} />
      </View>
      <Text style={[typography.heading, { color: theme.text }]}>{title}</Text>
      <Text style={[typography.body, styles.emptyBody, { color: theme.textMuted }]}>{body}</Text>
    </View>
  );
}

export function Row({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function SectionLabel({ text, theme }: { text: string; theme: Theme }) {
  return (
    <Text accessibilityRole="header" style={[typography.label, { color: theme.textMuted }]}>
      {text}
    </Text>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  theme,
  onBack,
  backLabel = 'Back',
  right,
}: {
  title: string;
  subtitle?: string;
  theme: Theme;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton icon="chevron-back" label={backLabel} onPress={onBack} theme={theme} />
      ) : null}
      <View style={styles.headerText}>
        <Text accessibilityRole="header" style={[typography.title, { color: theme.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.body, { color: theme.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Muted({
  children,
  theme,
  style,
}: {
  children: ReactNode;
  theme: Theme;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[typography.body, { color: theme.textMuted }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  iconButton: {
    width: TOUCH_TARGET - 8,
    height: TOUCH_TARGET - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  field: { gap: spacing.xs + 2 },
  inputRow: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  input: { flex: 1, paddingVertical: spacing.md },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: TOUCH_TARGET - 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  progressTrack: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: radius.pill },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  toastText: { flex: 1 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyBody: { textAlign: 'center', maxWidth: 280 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  headerText: { flex: 1, gap: 2 },
});
