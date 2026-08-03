import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';

/**
 * The expanding ring on its own, for marks that are not dots — a count badge, say.
 *
 * Fills whatever it is placed in and scales out of it, so the parent has to be the shape being
 * echoed: give it the mark's own box and its own corner radius. Nothing above it may clip, so keep
 * `overflow: 'hidden'` off the ancestors. Drawn first and behind, never over the mark it announces.
 */
export function PulseRing({
  color,
  /** Match the mark's own corners. Pill by default, which is what both callers are. */
  borderRadius = Radius.pill,
  /** How far out the ring travels. A small mark needs more of it than a wide one. */
  scale = 2.6,
  /** Whether there is something to announce. False renders nothing and starts no animation. */
  live = true,
}: {
  color: string;
  borderRadius?: number;
  scale?: number;
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
        // Snaps back rather than easing back: a ring that shrank into the mark would read as two
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

  if (!live) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: color,
          borderRadius,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) }],
        },
      ]}
    />
  );
}

/**
 * A status dot that breathes a ring out of itself while something is live.
 *
 * The same mark in both states on purpose: it is a legend dot, a filter dot and the marker on the
 * visit card, and those have to stay the same size and colour whether or not anything is running.
 * Only the ring appears — the layout never moves, so the motion reads as news rather than as a
 * different control.
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
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <PulseRing color={color} live={live} />
      <View style={{ width: size, height: size, borderRadius: Radius.pill, backgroundColor: color }} />
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
});
