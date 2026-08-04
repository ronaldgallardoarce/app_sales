import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountMenu } from '@/components/account/account-menu';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PendingInvoiceSync } from '@/components/orders/pending-invoice-sync';
import { DialogProvider } from '@/components/ui/dialog';
import { CartProvider } from '@/context/cart-context';
import { ClientVisitProvider } from '@/context/client-visit-context';
import { ConnectivityProvider } from '@/context/connectivity-context';
import { OrderIncentivesProvider } from '@/context/order-incentives-context';
import { OrderSummaryProvider } from '@/context/order-summary-context';
import { OrdersProvider } from '@/context/orders-context';
import { PromptPaymentProvider } from '@/context/prompt-payment-context';
import { ThemeSchemeProvider, useThemeSchemeContext } from '@/context/theme-scheme-context';
import { AndroidImmersiveNavBar, Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeSchemeProvider>
        <RootNavigation />
      </ThemeSchemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigation() {
  const { scheme } = useThemeSchemeContext();
  const insets = useSafeAreaInsets();

  // Immersive mode (Android only — iOS has no supported API to control the home
  // indicator or intercept its swipe gesture). Hides the system nav bar; swiping
  // from the edge briefly overlays it back without shifting app content, then it
  // hides itself again. Currently off (see AndroidImmersiveNavBar) — keep the
  // buttons visible until this is revisited.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // Edge-to-edge means the nav bar itself is always transparent, so its
    // background can't be set directly (setBackgroundColorAsync is a no-op
    // under edge-to-edge) — the dark backdrop below stands in for it. Button
    // icons *can* still be restyled, so keep them light to read on that backdrop.
    NavigationBar.setButtonStyleAsync('light');
    if (AndroidImmersiveNavBar) {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    } else {
      NavigationBar.setVisibilityAsync('visible');
    }
  }, []);

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Connectivity is ambient — it depends on neither the cart nor the visit. */}
      <ConnectivityProvider>
      <CartProvider>
        {/* Inside the cart: what the pricing service replied describes the cart's lines, so
            it can never outlive them. */}
        <OrderIncentivesProvider>
        {/* Inside the incentives reply, because a reservation is held against a priced order: empty
            the cart or reprice it and what was being collected is no longer what was agreed. */}
        <PromptPaymentProvider>
        {/* Placed orders outlive any one cart, so this sits outside the incentives reply. */}
        <OrdersProvider>
        <ClientVisitProvider>
        {/* Above the dialog because the summary screen raises one when an export fails, and
            below the orders it is built from. Holds nothing but the document currently being
            shown, so its place in the tree only has to outlive a navigation. */}
        <OrderSummaryProvider>
        <DialogProvider>
        <AnimatedSplashOverlay />
        {/* Renders nothing. Above the navigator on purpose: it finishes off orders whose factura
            arrived after the seller had already moved on, so it must not be tied to any one screen. */}
        <PendingInvoiceSync />
        <Stack screenOptions={{ headerShown: false }} />
        <AccountMenu />
        {/* Android draws edge-to-edge (status bar is transparent), so screens'
            own light/dark background would otherwise show through it. This
            keeps the status bar strip itself always dark, independent of
            the app's light/dark theme toggle. */}
        <StatusBar style="light" />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: Colors.dark.background,
          }}
        />
        {/* Same idea for the bottom: the nav bar is transparent (edge-to-edge),
            so paint a dark backdrop behind it — keeps it always dark regardless
            of the app's light/dark theme, matching the status bar above. */}
        {Platform.OS === 'android' ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: insets.bottom,
              backgroundColor: Colors.dark.background,
            }}
          />
        ) : null}
        </DialogProvider>
        </OrderSummaryProvider>
        </ClientVisitProvider>
        </OrdersProvider>
        </PromptPaymentProvider>
        </OrderIncentivesProvider>
      </CartProvider>
      </ConnectivityProvider>
    </ThemeProvider>
  );
}
