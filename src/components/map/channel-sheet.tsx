import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { CHANNEL_META, CHANNEL_ORDER, type SalesChannel } from '@/data/mock-clients';
import { useTheme } from '@/hooks/use-theme';

type ChannelFilter = SalesChannel | 'all';

export function ChannelSheet({
  visible,
  onClose,
  activeChannel,
  onSelect,
  counts,
}: {
  visible: boolean;
  onClose: () => void;
  activeChannel: ChannelFilter;
  onSelect: (channel: ChannelFilter) => void;
  counts: Record<SalesChannel, number>;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const channels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CHANNEL_ORDER.filter((channel) => !q || CHANNEL_META[channel].label.toLowerCase().includes(q));
  }, [query]);

  const select = (channel: ChannelFilter) => {
    onSelect(channel);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={440}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <ThemedText type="smallBold" style={styles.title}>
            Filtrar por canal
          </ThemedText>
          {activeChannel !== 'all' ? (
            <Pressable hitSlop={8} onPress={() => select('all')} style={styles.clearButton}>
              <Icon name="xmark.circle.fill" size={13} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                Quitar filtro
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Icon name="magnifyingglass" size={16} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar canal"
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
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {channels.map((channel) => (
            <Row
              key={channel}
              label={CHANNEL_META[channel].label}
              count={counts[channel] ?? 0}
              active={activeChannel === channel}
              onPress={() => select(channel)}
            />
          ))}
          {channels.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              Sin resultados para “{query}”
            </ThemedText>
          ) : null}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

function Row({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: active ? theme.accentSoft : theme.background }]}>
      <ThemedText
        type="small"
        numberOfLines={1}
        style={[styles.rowLabel, { color: active ? theme.accent : theme.text, fontWeight: active ? '700' : '500' }]}>
        {label}
      </ThemedText>
      <View style={styles.rowRight}>
        <ThemedText themeColor="textSecondary" type="small">
          {count}
        </ThemedText>
        {active ? <Icon name="checkmark" size={14} color={theme.accent} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  list: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
  },
  rowLabel: {
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
