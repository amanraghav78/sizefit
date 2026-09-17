/**
 * The brand block at the top of Home.
 *
 * One saturated surface carrying the name, the promise and the primary action,
 * so the first screen has a centre of gravity instead of being an even field of
 * cards. The gradient is the only large use of colour in the app — everything
 * below it stays calm.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, type Theme } from './theme';

export function Hero({
  theme,
  title,
  tagline,
  points,
  children,
}: {
  theme: Theme;
  title: string;
  tagline: string;
  /** Three short proofs, each with an icon. */
  points: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }>;
  /** The primary action, rendered inside the block. */
  children?: React.ReactNode;
}) {
  return (
    <LinearGradient
      colors={theme.accentGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.markRow}>
        <View style={styles.mark}>
          <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
          <Ionicons name="arrow-down" size={14} color="#FFFFFF" style={styles.markArrow} />
        </View>
        <Text style={[typography.label, styles.wordmark]}>{title.toUpperCase()}</Text>
      </View>

      <Text style={[typography.display, styles.tagline]}>{tagline}</Text>

      <View style={styles.points}>
        {points.map((point) => (
          <View key={point.label} style={styles.point}>
            <Ionicons name={point.icon} size={14} color="rgba(255,255,255,0.92)" />
            <Text style={[typography.caption, styles.pointText]} numberOfLines={2}>
              {point.label}
            </Text>
          </View>
        ))}
      </View>

      {children ? <View style={styles.action}>{children}</View> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderBottomLeftRadius: radius.lg + 10,
    borderBottomRightRadius: radius.lg + 10,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markArrow: { position: 'absolute', bottom: 2, right: 3 },
  wordmark: { color: 'rgba(255,255,255,0.9)' },
  tagline: { color: '#FFFFFF', fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  points: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 1, flexShrink: 1 },
  pointText: { color: 'rgba(255,255,255,0.92)' },
  action: { gap: spacing.md },
});
