/**
 * Page shell: centres the app in a phone-width column.
 *
 * On a phone the width constraint never binds. In a desktop browser it is the
 * difference between "an app" and "a web page that stretched" — without it the
 * same layout spreads across the whole monitor and reads as unfinished.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CONTENT_MAX_WIDTH, type Theme } from './theme';

export function Shell({ children, theme }: { children: ReactNode; theme: Theme }) {
  return (
    <View style={[styles.outer, { backgroundColor: theme.backgroundDeep }]}>
      <View
        style={[
          styles.inner,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    // Only visible when the viewport is wider than the column.
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
});
