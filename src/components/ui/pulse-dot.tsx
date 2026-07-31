import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';

/**
 * A status dot that breathes a ring out of itself while something is live.
 *
 * The same mark in both states on purpose: it is a legend dot, a filter dot and the marker on the
 * visit card, and those have to stay the same size and colour whether or not anything is running.
 * Only the ring appears — the layout never moves, so the motion reads as news rather than as a
 * different control.
 *
 * The ring is absolutely positioned and scales past the dot's own box, which it can only do while
 * no ancestor clips it — keep `overflow: 'hidden'` off whatever this sits inside.
 */
export function PulseDot({
  color,
  size = 7,
  /** Whether there is something to announce. False renders the plain dot and starts no animation. */
  live = false,
}: {
  color: string;
  size?: number;
  live?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!live) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // Snaps back rather than easing back: a ring that shrank into the dot would read as two
        // pulses per cycle, one of them going the wrong way.
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [live, pulse]);

  const round = { width: size, height: size, borderRadius: Radius.pill, backgroundColor: color };

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {live ? (
        <Animated.View
          style={[
            styles.ring,
            round,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
            },
          ]}
        />
      ) : null}
      <View style={round} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    // Never squeezed by a long label sharing its row.
    flexShrink: 0,
  },
  ring: {
    position: 'absolute',
  },
});
