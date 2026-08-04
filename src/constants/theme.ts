/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * The accent ramp is the Deal logo's blue (`assets/deal.jpg`, `#1D80C4`), one step darker.
 *
 * The raw brand blue only reaches 4.25:1 against white and 3.97:1 against the light background,
 * and `accent` is not just a button fill here — it is the color of prices and totals, which are
 * body-sized text. Darkening it to `#1873AF` buys 5.11:1 / 4.77:1 and clears WCAG AA at the same
 * hue, so it still reads as the logo. The navy `#1C2747` and the green `#4AB597` from the same
 * logo are already spoken for. The navy is the splash and icon background in `app.json`. The green
 * became the `success` family — not a new hue on the palette, the one that was already there
 * retuned to the brand's: `#4AB597` itself is only 2.52:1 on white, so light mode darkens it to
 * `#2C8069` (4.77:1), which also happens to fix the old `#16A34A` that never cleared 3.3:1 while
 * being the colour of the order total. Dark mode keeps the raw logo green as the pressed state.
 */
export const Colors = {
  light: {
    text: '#14171B',
    background: '#F6F7F9',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E9ECF0',
    textSecondary: '#6B7280',
    accent: '#1873AF',
    accentPressed: '#145F92',
    accentSoft: '#EAF5FC',
    onAccent: '#FFFFFF',
    accentAlt: '#F2762E',
    accentAltSoft: '#FDE8DA',
    onAccentAlt: '#FFFFFF',
    success: '#2C8069',
    successPressed: '#236B58',
    successSoft: '#E4F4EF',
    onSuccess: '#FFFFFF',
    violet: '#7C3AED',
    violetSoft: '#EDE6FC',
    border: '#E6E8EC',
    danger: '#C1443A',
    dangerSoft: '#F9E1DF',
    onDanger: '#FFFFFF',
  },
  dark: {
    text: '#F5F6F7',
    background: '#0E0F11',
    backgroundElement: '#1C1D20',
    backgroundSelected: '#25272B',
    textSecondary: '#9AA0A8',
    accent: '#4FA8E0',
    accentPressed: '#3593D2',
    accentSoft: '#13324B',
    onAccent: '#071A2B',
    accentAlt: '#FF9A52',
    accentAltSoft: '#4A2A12',
    onAccentAlt: '#2A1200',
    success: '#5CC9AC',
    successPressed: '#4AB597',
    successSoft: '#10352C',
    onSuccess: '#04140F',
    violet: '#A78BFA',
    violetSoft: '#2E2650',
    border: '#2A2C30',
    danger: '#E07168',
    dangerSoft: '#3A211E',
    onDanger: '#1C0E0C',
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
