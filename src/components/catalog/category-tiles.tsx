import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PulseRing } from '@/components/ui/pulse-dot';
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
                the count is information about the list, not about the selection.

                And it pings while the seller is somewhere else: these two lists are what the
                company wants pushed, and a static count on an unselected tab was easy to walk
                past. The ring stops on the selected tab — once the list is open the count has
                been read, and a badge still pulsing under the seller's eyes is just noise. */}
            {tile.count !== undefined ? (
              <View style={styles.badgeWrap}>
                <PulseRing color={color} scale={1.9} live={tile.count > 0 && !active} />
                <View style={[styles.badge, { backgroundColor: color }]}>
                  <ThemedText numberOfLines={1} style={[styles.badgeText, { color: theme.onAccent }]}>
                    {tile.count}
                  </ThemedText>
                </View>
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
  // Wraps the badge so the ring has the badge's exact box to grow out of. No `overflow: hidden`
  // here or on the tile above it — the ring is drawn outside both.
  badgeWrap: {
    flexShrink: 0,
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
