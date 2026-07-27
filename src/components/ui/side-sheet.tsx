import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { useContentInsets } from '@/hooks/use-content-insets';
import { Overlay, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function SideSheet({
  visible,
  onClose,
  children,
  width,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const theme = useTheme();
  const insets = useContentInsets();
  const sheetWidth = width ?? Math.min(340, SCREEN_WIDTH * 0.86);
  // The sheet lives off-screen to the left and slides right into view, so every
  // offset that hides it is negative.
  const hiddenOffset = -sheetWidth;
  const translateX = useRef(new Animated.Value(hiddenOffset)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateX.setValue(hiddenOffset);
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: hiddenOffset, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, translateX, backdropOpacity, hiddenOffset]);

  // Dismiss by dragging back out the way it came in: leftwards.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dx < -4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -sheetWidth * 0.3 || gesture.vx < -0.8) {
          onClose();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
        }
      },
    }),
  ).current;

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.sheet,
            {
              width: sheetWidth,
              backgroundColor: theme.backgroundElement,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              transform: [{ translateX }],
            },
          ]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Overlay,
  },
  sheet: {
    height: '100%',
    borderTopRightRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    overflow: 'hidden',
  },
});
