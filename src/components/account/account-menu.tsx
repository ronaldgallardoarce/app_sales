import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { AccountSheet } from '@/components/account/account-sheet';

const EDGE_WIDTH = 32;
const OPEN_THRESHOLD = 60;

/**
 * Global entry point to view the seller's profile and switch light/dark theme,
 * available from every screen. Rendered once at the root, as a sibling of the
 * navigation stack — never inside a screen — so no screen has to wire it in.
 *
 * No visible trigger: swipe right from the left edge of the screen to open it,
 * like a native edge-swipe drawer, matching the direction the sheet slides in.
 * Uses react-native-gesture-handler (not the plain PanResponder) because it
 * recognizes the drag natively instead of via JS touch-move polling, which is
 * what makes edge-swipe gestures reliable — plain PanResponder missed the
 * gesture too often to be usable here.
 */
export function AccountMenu() {
  const [visible, setVisible] = useState(false);

  const openSheet = () => setVisible(true);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX(10)
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      if (event.translationX > OPEN_THRESHOLD) {
        runOnJS(openSheet)();
      }
    });

  return (
    <>
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.edgeZone} />
      </GestureDetector>
      <AccountSheet visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  edgeZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: EDGE_WIDTH,
  },
});
