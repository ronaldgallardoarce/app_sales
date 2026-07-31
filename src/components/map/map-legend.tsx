import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PulseDot } from '@/components/ui/pulse-dot';
import { FloatingShadow, Radius, Spacing } from '@/constants/theme';
import { useClientVisits } from '@/context/client-visit-context';
import { STATUS_META, STATUS_ORDER, type MapClient, type VisitStatus } from '@/data/mock-clients';
import { useTheme } from '@/hooks/use-theme';

export function MapLegend({ clients }: { clients: MapClient[] }) {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const { openVisits } = useClientVisits();

  const counts = useMemo(() => {
    const acc = {} as Record<VisitStatus, number>;
    STATUS_ORDER.forEach((s) => (acc[s] = 0));
    clients.forEach((c) => (acc[c.status] += 1));
    return acc;
  }, [clients]);

  return (
    <View style={[styles.legend, { backgroundColor: theme.backgroundElement }, FloatingShadow]}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.header}>
        <Icon name="list.bullet" size={13} color={theme.textSecondary} />
        <ThemedText type="smallBold" style={styles.title}>
          Estados
        </ThemedText>
        <Icon name={open ? 'chevron.up' : 'chevron.down'} size={14} color={theme.textSecondary} />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            return (
              <View key={status} style={styles.row}>
                {/* Only "iniciado" beats, and only while a visit is actually running: it is the
                    one row that describes something happening rather than something that
                    happened, and a legend where every dot moved would just be noise. */}
                <PulseDot
                  color={theme[meta.color]}
                  size={9}
                  live={status === 'iniciado' && openVisits.length > 0}
                />
                <ThemedText type="small" style={styles.label} numberOfLines={1}>
                  {meta.label}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.count}>
                  {counts[status]}
                </ThemedText>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    width: 148,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  title: {
    flex: 1,
    fontSize: 12,
  },
  body: {
    gap: 5,
    paddingTop: 4,
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  label: {
    flex: 1,
    fontSize: 12,
  },
  count: {
    fontSize: 12,
  },
});
