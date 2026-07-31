import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ChannelSheet } from '@/components/map/channel-sheet';
import { ClientCard } from '@/components/map/client-card';
import { StatusChip } from '@/components/map/status-chip';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import {
  CHANNEL_META,
  CHANNEL_ORDER,
  STATUS_META,
  STATUS_ORDER,
  type SalesChannel,
  type VisitStatus,
} from '@/data/mock-clients';
import { useClientVisits } from '@/context/client-visit-context';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';

type Filter = 'today' | 'all';
type StatusFilter = VisitStatus | 'all';
type ChannelFilter = SalesChannel | 'all';

export function ClientList() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useContentInsets();
  const { clients, openVisits } = useClientVisits();

  const todayClients = useMemo(() => clients.filter((c) => c.visitToday), [clients]);

  const [filter, setFilter] = useState<Filter>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('no-visitado');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [channelSheetVisible, setChannelSheetVisible] = useState(false);
  const [query, setQuery] = useState('');

  const fallbackToAll = filter === 'today' && todayClients.length === 0;
  const baseClients =
    filter === 'today' ? (todayClients.length > 0 ? todayClients : clients) : clients;

  const channelCounts = useMemo(() => {
    const counts = {} as Record<SalesChannel, number>;
    CHANNEL_ORDER.forEach((channel) => (counts[channel] = 0));
    baseClients.forEach((c) => (counts[c.channel] += 1));
    return counts;
  }, [baseClients]);

  const statusCounts = useMemo(() => {
    const counts = {} as Record<VisitStatus, number>;
    STATUS_ORDER.forEach((status) => (counts[status] = 0));
    baseClients.forEach((c) => (counts[c.status] += 1));
    return counts;
  }, [baseClients]);

  const listClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseClients
      .filter((c) => statusFilter === 'all' || c.status === statusFilter)
      .filter((c) => channelFilter === 'all' || c.channel === channelFilter)
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.code.includes(q) ||
          c.owner.toLowerCase().includes(q)
        );
      });
  }, [baseClients, statusFilter, channelFilter, query]);

  return (
    <View style={styles.root}>
      <View style={styles.controls}>
        <View style={styles.topRow}>
          <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
            <SegmentButton
              label="Por visitar hoy"
              active={filter === 'today'}
              onPress={() => setFilter('today')}
            />
            <SegmentButton label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
          </View>

          <Pressable
            onPress={() => setChannelSheetVisible(true)}
            style={[
              styles.channelButton,
              { backgroundColor: channelFilter === 'all' ? theme.backgroundElement : theme.accent },
            ]}>
            <Icon name="tag.fill" size={12} color={channelFilter === 'all' ? theme.textSecondary : theme.onAccent} />
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              style={[
                styles.channelButtonLabel,
                { color: channelFilter === 'all' ? theme.textSecondary : theme.onAccent },
              ]}>
              {channelFilter === 'all' ? 'Canal' : CHANNEL_META[channelFilter].label}
            </ThemedText>
            <Icon
              name="chevron.down"
              size={10}
              color={channelFilter === 'all' ? theme.textSecondary : theme.onAccent}
            />
          </Pressable>
        </View>

        {fallbackToAll ? (
          <View style={[styles.hintRow, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="clock.fill" size={14} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.hintText}>
              Sin visitas para hoy · mostrando todos los clientes
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.searchRow}>
          <View
            style={[styles.searchBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
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

          <View style={[styles.countPill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Icon name="person.2.fill" size={14} color={theme.accent} />
            <ThemedText type="smallBold" style={styles.countPillText}>
              {listClients.length}
            </ThemedText>
          </View>
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
                count={statusCounts[status]}
                // Only "iniciado" carries the pulse: it is the status that means the seller is
                // inside someone, and a chip that beat for every state would say nothing.
                live={status === 'iniciado' && openVisits.length > 0}
                onPress={() => setStatusFilter(status)}
              />
            );
          })}
        </ScrollView>
      </View>

      <ChannelSheet
        visible={channelSheetVisible}
        onClose={() => setChannelSheetVisible(false)}
        activeChannel={channelFilter}
        onSelect={setChannelFilter}
        counts={channelCounts}
      />

      <FlatList
        data={listClients}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ClientCard client={item} onPress={(c) => router.push(`/client/${c.id}` as Href)} />
        )}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    height: ControlHeight.segment,
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: ControlHeight.input,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  countPillText: {
    fontSize: 14,
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
  channelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    gap: 4,
    height: ControlHeight.segment,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
  },
  channelButtonLabel: {
    fontSize: 11,
    maxWidth: 90,
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
