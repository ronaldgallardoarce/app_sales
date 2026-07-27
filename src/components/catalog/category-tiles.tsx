import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ControlHeight, Radius, Spacing, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CatalogTabKey } from '@/types/catalog';

interface Tile {
  key: CatalogTabKey;
  label: string;
  colorToken: ThemeColor;
  softToken: ThemeColor;
  count?: number;
}

/**
 * Product-list tabs, built on the app's segmented-control idiom: one muted
 * container, only the selected item carries color. Each tab keeps its own hue as
 * an identity accent, so the color tells you which list you are on without ever
 * showing three saturated colors at once.
 */
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
    <View style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {tiles.map((tile) => {
        const active = tile.key === activeKey;
        const color = theme[tile.colorToken];
        const soft = theme[tile.softToken];
        return (
          <Pressable
            key={tile.key}
            onPress={() => onChange(tile.key)}
            style={[styles.tile, active ? { backgroundColor: soft } : null]}>
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              style={[styles.label, { color: active ? color : theme.textSecondary }]}>
              {tile.label}
            </ThemedText>
            {/* The badge keeps its tile's color whether or not the tab is selected:
                the count is information about the list, not about the selection. */}
            {tile.count !== undefined ? (
              <View style={[styles.badge, { backgroundColor: color }]}>
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
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: ControlHeight.segment,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.one,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: Radius.pill,
    paddingHorizontal: 4,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    // Explicit lineHeight and textAlign: without them the glyph sits off-centre in
    // its circle, since the default line box does not match the badge height.
    lineHeight: 18,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  label: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
