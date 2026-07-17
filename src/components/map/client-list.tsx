import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClientCard } from '@/components/map/client-card';
import { ClientInfoSheet } from '@/components/map/client-info-sheet';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { mapClients, STATUS_META, STATUS_ORDER, type MapClient, type VisitStatus } from '@/data/mock-clients';
import { useTheme } from '@/hooks/use-theme';

type Filter = 'today' | 'all';
type StatusFilter = VisitStatus | 'all';

export function ClientList() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const todayClients = useMemo(() => mapClients.filter((c) => c.visitToday), []);

  const [filter, setFilter] = useState<Filter>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<MapClient | null>(null);

  const fallbackToAll = filter === 'today' && todayClients.length === 0;
  const baseClients =
    filter === 'today' ? (todayClients.length > 0 ? todayClients : mapClients) : mapClients;

  const listClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseClients
      .filter((c) => statusFilter === 'all' || c.status === statusFilter)
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.code.includes(q) ||
          c.owner.toLowerCase().includes(q)
        );
      });
  }, [baseClients, statusFilter, query]);

  return (
    <View style={styles.root}>
      <View style={styles.controls}>
        <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          <SegmentButton
            label="Por visitar hoy"
            active={filter === 'today'}
            onPress={() => setFilter('today')}
          />
          <SegmentButton label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
        </View>

        {fallbackToAll ? (
          <View style={[styles.hintRow, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="clock.fill" size={14} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.hintText}>
              Sin visitas para hoy · mostrando todos los clientes
            </ThemedText>
          </View>
        ) : null}

        <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Icon name="magnifyingglass" size={16} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nombre, código o propietario"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {query.length > 0 ? (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Icon name="xmark" size={14} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}>
          <StatusChip
            label="Todos"
            active={statusFilter === 'all'}
            color={theme.accent}
            soft={theme.accentSoft}
            onPress={() => setStatusFilter('all')}
          />
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            return (
              <StatusChip
                key={status}
                label={meta.label}
                active={statusFilter === status}
                color={theme[meta.color]}
                soft={theme[meta.soft]}
                onPress={() => setStatusFilter(status)}
              />
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={listClients}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ClientCard client={item} onPress={setSelectedClient} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.four }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSelected }]}>
              <Icon name="person.2.fill" size={22} color={theme.textSecondary} />
            </View>
            <ThemedText type="smallBold" style={styles.emptyText}>
              Sin clientes
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              Probá con otro filtro o búsqueda
            </ThemedText>
          </View>
        }
      />

      <ClientInfoSheet
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
        onViewClient={() => {
          setSelectedClient(null);
          router.push('/catalog' as Href);
        }}
      />
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentButton, active ? { backgroundColor: theme.accent } : null]}>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={[styles.segmentLabel, { color: active ? theme.onAccent : theme.textSecondary }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function StatusChip({
  label,
  active,
  color,
  soft,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  soft: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.statusChip,
        {
          backgroundColor: active ? soft : theme.backgroundElement,
          borderColor: active ? color : theme.border,
        },
      ]}>
      <View style={[styles.statusChipDot, { backgroundColor: color }]} />
      <ThemedText
        type="smallBold"
        style={[styles.statusChipText, { color: active ? color : theme.textSecondary }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontSize: 13,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  hintText: {
    flex: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  chipsScroll: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  statusChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  separator: {
    height: Spacing.two,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: Spacing.six,
    gap: Spacing.one,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyText: {
    textAlign: 'center',
  },
});
