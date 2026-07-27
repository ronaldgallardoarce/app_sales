import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function CategoriesSheet({
  visible,
  onClose,
  categories,
  activeCategory,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  categories: { name: string; count: number }[];
  activeCategory: string | null;
  onSelect: (category: string | null) => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={460}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ThemedText type="smallBold" style={styles.title}>
          Categorías
        </ThemedText>

        <Row
          label="Todas las categorías"
          count={categories.reduce((sum, c) => sum + c.count, 0)}
          active={activeCategory === null}
          onPress={() => {
            onSelect(null);
            onClose();
          }}
        />
        {categories.map((category) => (
          <Row
            key={category.name}
            label={category.name}
            count={category.count}
            active={activeCategory === category.name}
            onPress={() => {
              onSelect(category.name);
              onClose();
            }}
          />
        ))}
      </ScrollView>
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
      style={[styles.row, active ? { backgroundColor: theme.accentSoft } : null]}>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={[styles.label, active ? { color: theme.accent } : null]}>
        {label}
      </ThemedText>
      <View style={[styles.countPill, { backgroundColor: active ? 'transparent' : theme.backgroundSelected }]}>
        <ThemedText style={[styles.countText, { color: active ? theme.accent : theme.textSecondary }]}>
          {count}
        </ThemedText>
      </View>
      {active ? <Icon name="checkmark" size={13} color={theme.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: 2,
  },
  title: {
    fontSize: 15,
    marginBottom: 6,
    paddingHorizontal: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
  },
  label: {
    flex: 1,
    fontSize: 13,
  },
  countPill: {
    minWidth: 22,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
