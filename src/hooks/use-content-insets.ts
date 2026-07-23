import { Platform } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { AndroidImmersiveNavBar } from '@/constants/theme';

/**
 * Safe-area insets adjusted for our own immersive nav bar setup (see
 * `NavigationBar.setVisibilityAsync` in the root layout): while immersive mode
 * is on, the Android nav bar is always hidden and only overlays content
 * transiently on an edge swipe, so reserving `insets.bottom` for it would just
 * waste screen space. While it's off, the buttons are visible and the real
 * inset must be respected.
 */
export function useContentInsets(): EdgeInsets {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'android' && AndroidImmersiveNavBar ? { ...insets, bottom: 0 } : insets;
}
