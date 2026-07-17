import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';

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
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <CartProvider>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} />
      </CartProvider>
    </ThemeProvider>
  );
}
