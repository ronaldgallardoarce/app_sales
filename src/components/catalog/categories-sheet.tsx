import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { ThemedText } from '@/components/themed-text';
import { getCategoryColor } from '@/constants/category-colors';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme, useThemeScheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
  const scheme = useThemeScheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={520}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ThemedText type="smallBold" style={styles.title}>
          Ver Categorías
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
            dotColor={getCategoryColor(category.name, scheme, theme.textSecondary)}
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
  dotColor,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  dotColor?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: active ? theme.accentSoft : theme.background }]}>
      <View style={styles.rowLeft}>
        {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
        <ThemedText themeColor={active ? undefined : 'text'} style={active ? { color: theme.accent, fontWeight: '700' } : undefined}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.rowRight}>
        <ThemedText themeColor="textSecondary" type="small">
          {count}
        </ThemedText>
        {active ? <Icon name="checkmark" size={16} color={theme.accent} /> : null}
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
  title: {
    fontSize: 18,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
