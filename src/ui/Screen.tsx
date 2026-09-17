/**
 * Screen container: safe-area padding plus a short fade/slide on entry.
 *
 * The animation is deliberately quick (180ms). This app is used by people in a
 * hurry against a deadline; motion should confirm that something happened, not
 * make them wait for it.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export function Screen({ children, screenKey }: { children: ReactNode; screenKey: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenKey, anim]);

  return (
    <Animated.View
      style={[
        styles.fill,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      <View style={styles.fill}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
