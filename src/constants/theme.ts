/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#14171B',
    background: '#F6F7F9',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E9ECF0',
    textSecondary: '#6B7280',
    accent: '#4F46E5',
    accentPressed: '#4338CA',
    accentSoft: '#EEEEFD',
    onAccent: '#FFFFFF',
    accentAlt: '#F2762E',
    accentAltSoft: '#FDE8DA',
    onAccentAlt: '#FFFFFF',
    success: '#16A34A',
    successPressed: '#0E8A3E',
    successSoft: '#DCF6EC',
    onSuccess: '#FFFFFF',
    violet: '#7C3AED',
    violetSoft: '#EDE6FC',
    border: '#E6E8EC',
    danger: '#C1443A',
    dangerSoft: '#F9E1DF',
  },
  dark: {
    text: '#F5F6F7',
    background: '#0E0F11',
    backgroundElement: '#1C1D20',
    backgroundSelected: '#25272B',
    textSecondary: '#9AA0A8',
    accent: '#818CF8',
    accentPressed: '#6366F1',
    accentSoft: '#252A4A',
    onAccent: '#0B0E1F',
    accentAlt: '#FF9A52',
    accentAltSoft: '#4A2A12',
    onAccentAlt: '#2A1200',
    success: '#2DD4A0',
    successPressed: '#22B58A',
    successSoft: '#0F3D30',
    onSuccess: '#04140F',
    violet: '#A78BFA',
    violetSoft: '#2E2650',
    border: '#2A2C30',
    danger: '#E07168',
    dangerSoft: '#3A211E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Modal/sheet backdrop scrim — intentionally identical across modes (dims content behind it either way). */
export const Overlay = 'rgba(8,10,14,0.55)';

export const Radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const CardShadow = {
  shadowColor: '#0B1220',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
} as const;

export const FloatingShadow = {
  shadowColor: '#0B1220',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.16,
  shadowRadius: 20,
  elevation: 8,
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Shared control heights so inputs and buttons line up the same across every screen. */
export const ControlHeight = {
  /** Search boxes, text inputs, and full-width action buttons. */
  input: 40,
  /** Segmented toggle buttons (e.g. "Hoy" / "Todos"). */
  segment: 30,
} as const;

/** Shared padding for filter/status pills so they read as one compact, consistent size. */
export const ChipPadding = {
  horizontal: 10,
  vertical: 4,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Toggle for the Android auto-hide nav bar experiment (buttons hidden, swipe
 * to reveal). Off for now so the system back/home/recent buttons stay
 * visible — flip to true to bring immersive mode back.
 */
export const AndroidImmersiveNavBar = false;
