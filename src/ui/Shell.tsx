/**
 * Page shell: centres the app in a phone-width column, and on a wide screen
 * gives that column something to sit in.
 *
 * On a phone the width constraint never binds and this is invisible. The
 * problem it solves is the desktop browser, where a 520px column running flush
 * from the top of the viewport to the bottom reads as a mobile page that
 * failed to adapt — a narrow strip stranded in empty space.
 *
 * So above a breakpoint the column becomes a deliberate object: an elevated
 * card with its own rounded edges and room to breathe, under a masthead and
 * over a footer. The app inside is untouched; only its frame changes.
 */
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Translate } from '../i18n/strings';
import { CONTENT_MAX_WIDTH, elevation, radius, spacing, typography, type Theme } from './theme';

/**
 * Where a viewport stops being a phone.
 *
 * Comfortably above the column itself, so the frame only appears once there is
 * real space around it — at 600px a card with margins would just look cramped.
 */
export const WIDE_BREAKPOINT = 900;

/** Keeps the card app-shaped on a tall monitor instead of a metre-long ribbon. */
const MAX_CARD_HEIGHT = 900;

export function Shell({
  children,
  theme,
  t,
}: {
  children: ReactNode;
  theme: Theme;
  t: Translate;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  // The card treatment suits any wide screen, including a tablet. The masthead
  // and footer are site chrome, so they belong to the website alone — a native
  // tablet app should not grow a web page's header.
  const chrome = wide && Platform.OS === 'web';

  if (!wide) {
    return (
      <View style={[styles.outer, { backgroundColor: theme.backgroundDeep }]}>
        <View
          style={[
            styles.inner,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.outer, styles.outerWide, { backgroundColor: theme.backgroundDeep }]}>
      {chrome ? (
        <View style={styles.masthead}>
          <Text style={[typography.title, { color: theme.text }]}>{t('app.name')}</Text>
          <Text
            style={[typography.body, styles.tagline, { color: theme.textMuted }]}
            numberOfLines={2}
          >
            {t('app.tagline')}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.inner,
          styles.card,
          elevation(2, theme),
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
            // The masthead and footer are auto-height siblings in a column, so
            // `flex: 1` already hands this whatever is left — no arithmetic
            // against the chrome's height, which would only be an estimate and
            // would overflow the moment a tagline wrapped to a third line.
            maxHeight: MAX_CARD_HEIGHT,
          },
        ]}
      >
        {children}
      </View>

      {chrome ? (
        <View style={styles.footer}>
          <Text style={[typography.caption, { color: theme.textFaint }]}>
            {[t('home.pointExact'), t('home.pointOffline'), t('home.pointPrivate')].join('  ·  ')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  outerWide: { justifyContent: 'center', paddingVertical: spacing.xxl },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    // Only visible when the viewport is wider than the column.
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    // The Home hero is a full-bleed dark block; without this it would square
    // off the corners the card just rounded.
    overflow: 'hidden',
  },
  masthead: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xl,
  },
  tagline: { textAlign: 'center' },
  footer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH + spacing.xxl,
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
});
