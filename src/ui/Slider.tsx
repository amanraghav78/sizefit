/**
 * A minimal slider built on PanResponder.
 *
 * Deliberately dependency-free: the community slider needs native config and
 * behaves differently under react-native-web, and this control has to work
 * identically in both places for the Preview screen's manual quality override.
 */
import { useCallback, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { radius, type Theme } from './theme';

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 28;

export function Slider({
  value,
  min,
  max,
  onChange,
  onCommit,
  theme,
  disabled = false,
  accessibilityLabel,
}: {
  value: number;
  min: number;
  max: number;
  /** Fires continuously while dragging. */
  onChange: (next: number) => void;
  /** Fires once when the finger lifts — use for expensive work like re-encoding. */
  onCommit?: (next: number) => void;
  theme: Theme;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const latest = useRef(value);

  const positionToValue = useCallback(
    (x: number): number => {
      const usable = Math.max(1, widthRef.current - THUMB_SIZE);
      const ratio = Math.min(1, Math.max(0, (x - THUMB_SIZE / 2) / usable));
      return Math.round(min + ratio * (max - min));
    },
    [min, max],
  );

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (event) => {
        const next = positionToValue(event.nativeEvent.locationX);
        latest.current = next;
        onChange(next);
      },
      onPanResponderMove: (event, gesture) => {
        const next = positionToValue(gesture.moveX - gesture.x0 + event.nativeEvent.locationX);
        latest.current = next;
        onChange(next);
      },
      onPanResponderRelease: () => {
        onCommit?.(latest.current);
      },
    }),
  ).current;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(next);
  };

  const ratio = max === min ? 0 : (value - min) / (max - min);
  const thumbLeft = ratio * Math.max(0, width - THUMB_SIZE);

  return (
    <View
      onLayout={onLayout}
      style={styles.container}
      accessibilityRole="adjustable"
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      accessibilityValue={{ min, max, now: value }}
      {...responder.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: disabled ? theme.borderStrong : theme.accent, width: `${ratio * 100}%` },
          ]}
        />
      </View>
      <View
        style={[
          styles.thumb,
          {
            left: thumbLeft,
            backgroundColor: disabled ? theme.borderStrong : theme.accent,
            borderColor: theme.surface,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: THUMB_SIZE + 12, justifyContent: 'center' },
  track: { height: TRACK_HEIGHT, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: TRACK_HEIGHT, borderRadius: radius.pill },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
  },
});
