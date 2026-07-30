import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { FloatingShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatBs } from '@/utils/currency';

export type OrderSheetSnap = 'collapsed' | 'half' | 'full';

/** Header height, safe-area inset excluded — the sheet's own shortest stop. */
const ORDER_SHEET_HEADER_HEIGHT = 60;

/** Fraction of the list area the sheet takes at its middle stop. */
const HALF_RATIO = 0.5;

/**
 * How far ahead a fling is projected when picking the stop to land on, in
 * seconds of travel at release velocity. Without it, a fast flick that barely
 * moved the sheet would snap back to where it started.
 */
const VELOCITY_PROJECTION = 0.12;

const SPRING = { damping: 22, stiffness: 220, mass: 0.7 } as const;

/**
 * The height the sheet rests at for each stop. The catalog needs these too — it
 * pads the product list so the last row clears the sheet — so they are derived
 * here once instead of being recomputed, and drifting, in two places.
 */
export function orderSheetHeights(
  availableHeight: number,
  bottomInset: number,
  /**
   * How far past the top of the list area the tallest stop is allowed to climb.
   *
   * The sheet is anchored to the bottom of the screen, so this is the caller's way of saying how
   * much of what sits *above* the list — search box, filter chip, counts — the order may cover on
   * its way up. Measured by the catalog and passed in rather than assumed here, because what is
   * above the list is the catalog's business and it changes with the screen: the filter chip row
   * only exists while a category is applied.
   */
  reachAboveList: number = 0,
) {
  const collapsed = ORDER_SHEET_HEADER_HEIGHT + bottomInset;
  // No peek of the product list is kept at the tallest stop any more. It used to leave a third of
  // a row showing as proof the catalog was still behind — but the category tabs now stay uncovered
  // above the sheet at every stop, and they say the same thing without spending list height on it.
  const full = Math.max(collapsed, availableHeight + reachAboveList);
  const half = Math.min(Math.max(Math.round(availableHeight * HALF_RATIO), collapsed), full);
  return { collapsed, half, full };
}

/**
 * The order, as a curtain over the product list rather than a screen that
 * replaces it.
 *
 * The point of the three stops is that the seller picks the ratio: the whole
 * list while hunting for products, half and half while comparing, the whole
 * order while reviewing it before closing. What never changes is the header —
 * same element, same place, at every stop — because it is the only thing tying
 * the two halves together into one screen. Drag it, or tap it to advance.
 *
 * Deliberately NOT built on `ui/bottom-sheet.tsx`: that one is a `Modal` with a
 * backdrop, which blocks touches on whatever is behind it. Here the list behind
 * has to stay tappable, so this is a plain absolutely-positioned sibling.
 *
 * Height is animated rather than the sheet being translated down, so the panel
 * inside always gets its real visible height. Translating it would leave the
 * scroll view full-height at every stop, and its lower half — payment terms and
 * the continue button — unreachable at anything but the tallest stop.
 */
export function OrderSheet({
  snap,
  onSnapChange,
  availableHeight,
  bottomInset,
  productCount,
  totalAmount,
  children,
}: {
  snap: OrderSheetSnap;
  onSnapChange: (snap: OrderSheetSnap) => void;
  /** Height of the area the sheet slides within — the product list's own height. */
  availableHeight: number;
  bottomInset: number;
  productCount: number;
  totalAmount: number;
  children: ReactNode;
}) {
  const theme = useTheme();

  const {
    collapsed: collapsedHeight,
    half: halfHeight,
    full: fullHeight,
  } = orderSheetHeights(availableHeight, bottomInset);

  const height = useSharedValue(collapsedHeight);
  const startHeight = useSharedValue(collapsedHeight);

  const heightForSnap = (point: OrderSheetSnap) =>
    point === 'full' ? fullHeight : point === 'half' ? halfHeight : collapsedHeight;

  // Drives the sheet for every change that does not come from the drag itself:
  // tapping the header, and switching product list (which collapses it). Also
  // re-settles the sheet once the list area has been measured, and on rotation.
  useEffect(() => {
    height.value = withSpring(heightForSnap(snap), SPRING);
    // heightForSnap is derived from the three heights already listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, collapsedHeight, halfHeight, fullHeight]);

  const advanceSnap = () => {
    onSnapChange(snap === 'collapsed' ? 'half' : snap === 'half' ? 'full' : 'collapsed');
  };

  const pan = Gesture.Pan()
    // Lets a plain tap through to the tap gesture instead of being swallowed as a
    // zero-distance drag.
    .activeOffsetY([-6, 6])
    .onStart(() => {
      startHeight.value = height.value;
    })
    .onUpdate((event) => {
      // Dragging down (positive translation) shrinks the sheet.
      const next = startHeight.value - event.translationY;
      height.value = next < collapsedHeight ? collapsedHeight : next > fullHeight ? fullHeight : next;
    })
    .onEnd((event) => {
      const projected = height.value - event.velocityY * VELOCITY_PROJECTION;
      const stops = [collapsedHeight, halfHeight, fullHeight];
      const keys: OrderSheetSnap[] = ['collapsed', 'half', 'full'];

      let best = 0;
      for (let i = 1; i < stops.length; i += 1) {
        if (Math.abs(stops[i] - projected) < Math.abs(stops[best] - projected)) best = i;
      }

      // Settles here as well as reporting upwards: when the gesture lands on the
      // stop the screen is already on, the state does not change and the effect
      // above would never fire to finish the animation.
      height.value = withSpring(stops[best], SPRING);
      runOnJS(onSnapChange)(keys[best]);
    });

  const tap = Gesture.Tap().onEnd((_event, success) => {
    if (success) runOnJS(advanceSnap)();
  });

  const sheetStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[
        styles.sheet,
        FloatingShadow,
        { backgroundColor: theme.backgroundElement, borderTopColor: theme.border },
        sheetStyle,
      ]}>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View style={styles.header}>
          <View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.summaryRow}>
            <Icon name="cart" size={16} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" type="small" numberOfLines={1} style={styles.summaryLabel}>
              {productCount === 0
                ? 'Sin productos en la lista'
                : `${productCount} ${productCount === 1 ? 'producto' : 'productos'} en la lista`}
            </ThemedText>
            <ThemedText style={[styles.total, { color: theme.accent }]}>{formatBs(totalAmount)}</ThemedText>
            {/* Points at what a tap does next. Carries a filled circle, matching the
                app's round-button idiom, because as a bare glyph next to the amount
                it read as decoration and got lost against the total. */}
            <View style={[styles.snapButton, { backgroundColor: theme.backgroundSelected }]}>
              <Icon
                name={snap === 'full' ? 'chevron.down' : 'chevron.up'}
                size={14}
                color={theme.text}
              />
            </View>
          </View>
        </View>
      </GestureDetector>

      <View style={[styles.body, { paddingBottom: bottomInset }]}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    // Keeps the panel clipped to the sheet while it is shorter than its content,
    // instead of it spilling over the product list below.
    overflow: 'hidden',
  },
  header: {
    height: ORDER_SHEET_HEADER_HEIGHT,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 41,
    paddingHorizontal: Spacing.three,
  },
  summaryLabel: {
    flex: 1,
  },
  total: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  snapButton: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
});
