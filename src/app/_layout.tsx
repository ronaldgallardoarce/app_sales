import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AccountMenu } from '@/components/account/account-menu';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { CartProvider } from '@/context/cart-context';
import { ThemeSchemeProvider, useThemeSchemeContext } from '@/context/theme-scheme-context';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return (
    <ThemeSchemeProvider>
      <RootNavigation />
    </ThemeSchemeProvider>
  );
}

function RootNavigation() {
  const { scheme } = useThemeSchemeContext();

  // Immersive mode (Android only — iOS has no supported API to control the home
  // indicator or intercept its swipe gesture). Hides the system nav bar; swiping
  // from the edge briefly overlays it back without shifting app content, then it
  // hides itself again.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setVisibilityAsync('hidden');
    NavigationBar.setBehaviorAsync('overlay-swipe');
  }, []);

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <CartProvider>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} />
        <AccountMenu />
      </CartProvider>
    </ThemeProvider>
  );
}
