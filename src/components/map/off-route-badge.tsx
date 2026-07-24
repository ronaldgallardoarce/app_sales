import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import type { VisitStatus } from '@/data/mock-clients';
import { useTheme } from '@/hooks/use-theme';

/**
 * Marks a client that is not part of today's planned route. Renders nothing for
 * on-route clients. Once an ad-hoc visit has been started (status is no longer
 * "no-visitado"), the label switches to make the off-route visit explicit.
 */
export function OffRouteBadge({
  visitToday,
  status,
}: {
  visitToday: boolean;
  status: VisitStatus;
}) {
  const theme = useTheme();
  if (visitToday) return null;

  const visitStarted = status !== 'no-visitado';
  const label = visitStarted ? 'Visita fuera de ruta' : 'Fuera de ruta';

  return (
    <View style={[styles.badge, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <Icon name="mappin.slash" size={12} color={theme.textSecondary} />
      <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 11,
  },
});
