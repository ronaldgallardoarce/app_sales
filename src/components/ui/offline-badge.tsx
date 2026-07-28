import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useConnectivity } from '@/context/connectivity-context';
import { useTheme } from '@/hooks/use-theme';

/**
 * Header marker for working without connection. It reads the flag itself and renders
 * nothing while online, so a header can drop it in unconditionally instead of repeating
 * the same check on every screen.
 *
 * Glyph only, no "Sin conexión" label: these headers already carry a title, a visit timer
 * and a status chip, and a fourth worded pill crowded the title out of its own row. The
 * home screen's switch is where the mode is named — this is only the reminder.
 *
 * Carries the warning tone, never `danger`: working offline is a supported mode the seller
 * chose, not a failure.
 */
export function OfflineBadge() {
  const theme = useTheme();
  const { offline } = useConnectivity();

  if (!offline) return null;

  return (
    <View style={[styles.chip, { backgroundColor: theme.accentAltSoft }]}>
      <Icon name="wifi.slash" size={13} color={theme.accentAlt} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    // Never squashed by a long client name sharing the header row.
    flexShrink: 0,
    borderRadius: Radius.pill,
  },
});
