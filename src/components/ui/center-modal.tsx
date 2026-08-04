import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { FloatingShadow, Overlay, Radius, Spacing } from '@/constants/theme';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';

/**
 * A card in the middle of the screen, with an optional pinned footer.
 *
 * The counterpart to `BottomSheet`, for content that has to be *read* rather than picked from. A
 * sheet puts everything against the bottom edge, which is right for a list the thumb reaches into and
 * wrong for a figure the seller is watching — that ends up in the least visible part of the screen,
 * often behind the hand holding the phone.
 *
 * Same presentation as `ui/dialog`, deliberately: backdrop, rounded card, and the same fade-and-scale
 * entrance. Two different-looking centred overlays in one app would read as two different kinds of
 * thing happening.
 *
 * The body shrinks and the footer does not, so a child `ScrollView` scrolls while the actions stay
 * put — the same arrangement the bottom sheet makes.
 */
export function CenterModal({
  visible,
  onClose,
  children,
  footer,
  maxWidth = 360,
  dismissible = true,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  /**
   * Whether tapping the backdrop or the Android back button closes it. False makes the card's own
   * buttons the only way out, for content holding something in progress that a stray tap must not be
   * able to walk away from.
   */
  dismissible?: boolean;
}) {
  const theme = useTheme();
  const insets = useContentInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      return;
    }
    Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setMounted(false);
      },
    );
  }, [visible, progress]);

  if (!mounted) return null;

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={dismissible ? onClose : () => {}}
      statusBarTranslucent>
      {/* The insets are padding on the overlay rather than a height on the card, so `maxHeight: 100%`
          below lands on whatever room is actually left between the status bar and the nav bar. */}
      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.three },
        ]}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          {dismissible ? <Pressable style={StyleSheet.absoluteFill} onPress={onClose} /> : null}
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            FloatingShadow,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              maxWidth,
              opacity: progress,
              transform: [{ scale }],
            },
          ]}>
          <View style={styles.body}>{children}</View>

          {footer ? (
            <View style={[styles.footer, { borderTopColor: theme.border }]}>{footer}</View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Overlay,
  },
  card: {
    width: '100%',
    // Never taller than the room it was given; the body inside scrolls when the content asks for more.
    maxHeight: '100%',
    flexShrink: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    // Keeps the footer's top border and the body's own edges inside the rounded corners.
    overflow: 'hidden',
  },
  body: {
    flexShrink: 1,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
});
