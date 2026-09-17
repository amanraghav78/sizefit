/**
 * A two-thumb range slider, for picking a minimum and maximum size on one
 * track.
 *
 * Dependency-free for the same reason as the single slider: the community
 * control needs native config and behaves differently under react-native-web,
 * and this has to work identically in the app and on the website.
 *
 * It works in *indices*, not bytes — the caller maps those to sizes through
 * sizeScale, so the thumb always lands on a round number.
 */
import { useCallback, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { radius, typography, type Theme } from './theme';

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 30;

export function RangeSlider({
  lowIndex,
  highIndex,
  lowest,
  highest,
  onChange,
  onCommit,
  theme,
  lowLabel,
  highLabel,
  accessibilityLowLabel,
  accessibilityHighLabel,
}: {
  lowIndex: number;
  highIndex: number;
  /** Lowest selectable index; may be negative for a "none" slot. */
  lowest: number;
  highest: number;
  onChange: (low: number, high: number) => void;
  onCommit?: () => void;
  theme: Theme;
  /** Rendered above each thumb. */
  lowLabel: string;
  highLabel: string;
  accessibilityLowLabel: string;
  accessibilityHighLabel: string;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  // The thumb grabbed on touch-down stays the one being dragged, even if the
  // finger crosses the other thumb.
  const active = useRef<'low' | 'high' | null>(null);
  const latest = useRef({ low: lowIndex, high: highIndex });
  latest.current = { low: lowIndex, high: highIndex };

  const span = Math.max(1, highest - lowest);

  const ratioFor = useCallback(
    (index: number) => (index - lowest) / span,
    [lowest, span],
  );

  const indexAt = useCallback(
    (x: number): number => {
      const usable = Math.max(1, widthRef.current - THUMB_SIZE);
      const ratio = Math.min(1, Math.max(0, (x - THUMB_SIZE / 2) / usable));
      return Math.round(lowest + ratio * span);
    },
    [lowest, span],
  );

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const touched = indexAt(event.nativeEvent.locationX);
        const { low, high } = latest.current;
        // Pick whichever thumb is nearer; on a tie, move the one that leaves
        // the range valid.
        active.current =
          Math.abs(touched - low) <= Math.abs(touched - high) ? 'low' : 'high';
        applyDrag(touched);
      },
      onPanResponderMove: (event) => {
        applyDrag(indexAt(event.nativeEvent.locationX));
      },
      onPanResponderRelease: () => {
        active.current = null;
        onCommit?.();
      },
      onPanResponderTerminate: () => {
        active.current = null;
        onCommit?.();
      },
    }),
  ).current;

  function applyDrag(touched: number) {
    const { low, high } = latest.current;
    if (active.current === 'low') {
      // Always leave at least one stop between the two, so the band can never
      // collapse to nothing.
      const next = Math.min(touched, high - 1);
      onChange(Math.max(lowest, next), high);
    } else if (active.current === 'high') {
      const next = Math.max(touched, low + 1);
      onChange(low, Math.min(highest, next));
    }
  }

  const onLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
  };

  const usable = Math.max(0, width - THUMB_SIZE);
  const lowX = ratioFor(lowIndex) * usable;
  const highX = ratioFor(highIndex) * usable;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labels}>
        <Text style={[typography.label, { color: theme.textMuted }]}>{lowLabel}</Text>
        <Text style={[typography.label, { color: theme.accent }]}>{highLabel}</Text>
      </View>

      <View onLayout={onLayout} style={styles.container} {...responder.panHandlers}>
        <View style={[styles.track, { backgroundColor: theme.border }]} />
        {/* The selected band. */}
        <View
          style={[
            styles.selected,
            {
              backgroundColor: theme.accent,
              left: lowX + THUMB_SIZE / 2,
              width: Math.max(0, highX - lowX),
            },
          ]}
        />
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLowLabel}
          accessibilityValue={{ min: lowest, max: highest, now: lowIndex }}
          style={[
            styles.thumb,
            {
              left: lowX,
              backgroundColor: theme.surface,
              borderColor: theme.accent,
            },
          ]}
        />
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityHighLabel}
          accessibilityValue={{ min: lowest, max: highest, now: highIndex }}
          style={[
            styles.thumb,
            {
              left: highX,
              backgroundColor: theme.accent,
              borderColor: theme.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  container: { height: THUMB_SIZE + 14, justifyContent: 'center' },
  track: { height: TRACK_HEIGHT, borderRadius: radius.pill },
  selected: { position: 'absolute', height: TRACK_HEIGHT, borderRadius: radius.pill },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
  },
});
