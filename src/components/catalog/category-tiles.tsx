import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CatalogTabKey } from '@/types/catalog';

interface Tile {
  key: CatalogTabKey;
  label: string;
  colorToken: ThemeColor;
  softToken: ThemeColor;
  count?: number;
}

export function CategoryTiles({
  tiles,
  activeKey,
  onChange,
}: {
  tiles: Tile[];
  activeKey: CatalogTabKey;
  onChange: (key: CatalogTabKey) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {tiles.map((tile) => {
        const active = tile.key === activeKey;
        const color = theme[tile.colorToken];
        const soft = theme[tile.softToken];
        return (
          <Pressable
            key={tile.key}
            onPress={() => onChange(tile.key)}
            style={[
              styles.tile,
              { backgroundColor: soft, borderColor: active ? color : 'transparent' },
            ]}>
            <ThemedText numberOfLines={1} style={[styles.label, { color }]}>
              {tile.label}
            </ThemedText>
            {tile.count !== undefined ? (
              <View style={[styles.badge, { backgroundColor: theme.danger }]}>
                <ThemedText numberOfLines={1} style={[styles.badgeText, { color: theme.onAccent }]}>
                  {tile.count}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
