import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AccountSheet } from '@/components/account/account-sheet';
import { Icon } from '@/components/ui/icon';
import { FloatingShadow, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Global entry point to view the seller's profile and switch light/dark theme,
 * available from every screen. Rendered once at the root, as a sibling of the
 * navigation stack — never inside a screen — so no screen has to wire it in.
 *
 * Anchored to the vertical middle of the right edge: every screen's own header
 * lives in the top band and (on catalog) a summary bar lives in the bottom band,
 * so this is the one spot that stays clear across the whole app.
 */
export function AccountMenu() {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        hitSlop={8}
        onPress={() => setVisible(true)}
        style={[styles.button, FloatingShadow, { backgroundColor: theme.backgroundElement }]}>
        <Icon name="person.crop.circle" size={20} color={theme.accent} />
      </Pressable>

      <AccountSheet visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 6,
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
    zIndex: 999,
  },
});
