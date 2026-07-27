import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { deliveryPointLabel, type DeliveryPoint } from '@/data/mock-order-details';
import { useTheme } from '@/hooks/use-theme';

/**
 * Picker for the client's delivery points. A sheet rather than an inline list: a
 * client can have many points, and rendering them all would push the rest of the
 * order form off screen. The search matches code, name and address, since the
 * address is what actually tells two points of the same client apart.
 */
export function DeliveryPointSheet({
  visible,
  onClose,
  points,
  selectedId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  points: DeliveryPoint[];
  selectedId: string | null;
  onSelect: (point: DeliveryPoint) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return points;
    return points.filter((point) =>
      `${point.code} ${point.name} ${point.address}`.toLowerCase().includes(q),
    );
  }, [points, query]);

  const select = (point: DeliveryPoint) => {
    onSelect(point);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={460}>
      <View style={styles.container}>
        <ThemedText type="smallBold" style={styles.title}>
          Punto de entrega
        </ThemedText>

        <View style={[styles.searchBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Icon name="magnifyingglass" size={15} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por código, nombre o dirección"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {query.length > 0 ? (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Icon name="xmark" size={13} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {results.map((point) => {
            const active = point.id === selectedId;
            return (
              <Pressable
                key={point.id}
                onPress={() => select(point)}
                style={[styles.row, active ? { backgroundColor: theme.accentSoft } : null]}>
                <Icon
                  name={active ? 'checkmark.circle.fill' : 'mappin'}
                  size={15}
                  color={active ? theme.accent : theme.textSecondary}
                />
                <View style={styles.rowTexts}>
                  <ThemedText
                    type="smallBold"
                    numberOfLines={1}
                    style={[styles.rowLabel, active ? { color: theme.accent } : null]}>
                    {deliveryPointLabel(point)}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.rowAddress} numberOfLines={2}>
                    {point.address}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
          {results.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              Sin resultados para “{query}”
            </ThemedText>
          ) : null}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 15,
    paddingHorizontal: Spacing.two,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
  },
  rowTexts: {
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    fontSize: 13,
  },
  rowAddress: {
    fontSize: 11,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
