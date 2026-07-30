import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { useTheme } from '@/hooks/use-theme';
import { Product } from '@/types/catalog';
import { formatBs } from '@/utils/currency';

/**
 * Fixed so the catalog can hand `getItemLayout` to its `FlatList` — the two must agree or
 * scrolling jumps, which is why this is one exported constant rather than a number repeated
 * in both files.
 *
 * The 44 is the two rows plus their gap and a little slack: 17 for the name, 2, then 17 for
 * the category-and-price row. Those come out that short only because every text style below
 * declares its own `lineHeight` — `ThemedText` without a `type` carries `lineHeight: 24`
 * regardless of the `fontSize` set on it, which is what made this row 52 tall before.
 */
export const PRODUCT_CARD_HEIGHT = 44;

/** Fixed so the price column lines up: the trailing glyph is 15 wide when in the order and
 * 13 when not, and letting it size itself shifted every price by two points. */
const TRAILING_ICON_WIDTH = 16;

export function ProductCard({
  product,
  onPress,
}: {
  product: Product;
  onPress: (product: Product) => void;
}) {
  const theme = useTheme();
  // Subscribing to the cart here (rather than taking a prop) is what keeps rows in
  // sync: the FlatList would otherwise need its renderItem rebuilt on every change.
  const { lines } = useCart();
  const inOrder = lines.some((line) => line.productId === product.id);

  return (
    <Pressable
      onPress={() => onPress(product)}
      style={[
        styles.row,
        { borderBottomColor: theme.border },
        // Accent, not green: green now means money (the price), so the "already in
        // the order" state needs its own hue or the row reads as three green cues.
        inOrder ? { backgroundColor: theme.accentSoft } : null,
      ]}>
      {/* Two rows, and the name gets the first one to itself: it is what the seller scans
          down the list for, and it is what gets truncated first when it has to share the
          width with anything else. */}
      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
          {product.id} - {product.name}
        </ThemedText>

        {/* The price sits with the category rather than in its own column: both are what
            the row is judged on, and pushed to the right edge the prices still read as a
            column to scan down. */}
        <View style={styles.metaRow}>
          <ThemedText style={[styles.family, { color: theme.textSecondary }]} numberOfLines={1}>
            {product.family}
          </ThemedText>
          <ThemedText style={[styles.price, { color: theme.success }]} numberOfLines={1}>
            {formatBs(product.priceUnidad)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.trailing}>
        {inOrder ? (
          <Icon name="checkmark.circle.fill" size={15} color={theme.accent} />
        ) : (
          <Icon name="chevron.right" size={13} color={theme.textSecondary} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: PRODUCT_CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    // Inset so the "in order" tint has breathing room instead of touching the text.
    // The list's left gutter is reduced by the same amount, so text stays aligned.
    paddingHorizontal: Spacing.two,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 13,
    // Explicit alongside every reduced font size in the app: the `smallBold` type carries
    // lineHeight 20, so a smaller font on its own keeps the old row height.
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  family: {
    // Takes the slack so the price is pushed to the right edge, and gives it up first when
    // the category name is long — the price must never be the thing that truncates.
    flex: 1,
    fontSize: 10,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  price: {
    flexShrink: 0,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  trailing: {
    width: TRAILING_ICON_WIDTH,
    alignItems: 'center',
  },
});
