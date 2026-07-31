import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/**
 * Runs a screen's own "back" when the phone's back button is pressed.
 *
 * Screens here give their header arrow behaviour the navigator knows nothing about — collapsing a
 * step before leaving, warning about unsaved work — and the hardware button skips all of it and
 * pops the screen. That is one gesture with two meanings, and the seller cannot tell which one
 * they are about to get.
 *
 * `onBack` returns whether it handled the press: `true` swallows it, `false` lets the navigator
 * pop as usual, so a screen only has to describe the cases where it differs from the default.
 *
 * Bound to focus rather than to mount: without that, every screen still sitting in the stack
 * underneath would keep answering the button, and the last one registered would win.
 */
export function useHardwareBack(onBack: () => boolean) {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => subscription.remove();
    }, [onBack]),
  );
}
