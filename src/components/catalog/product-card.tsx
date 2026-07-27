import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { useTheme } from '@/hooks/use-theme';
import { Product } from '@/types/catalog';
import { formatBs } from '@/utils/currency';

export const PRODUCT_CARD_HEIGHT = 52;

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
  const primaryVariant = product.variants[0];
  const hasVariants = product.variants.length > 1;
  const code = hasVariants ? primaryVariant.sku.split('-').slice(0, 2).join('-') : primaryVariant.sku;
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
      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
          {code} - {product.name}
        </ThemedText>
        <View style={styles.metaRow}>
          <ThemedText style={[styles.family, { color: theme.textSecondary }]} numberOfLines={1}>
            {product.family}
          </ThemedText>
          {hasVariants ? (
            <View style={[styles.variantPill, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText style={[styles.variantText, { color: theme.textSecondary }]}>
                {product.variants.length} sabores
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      <ThemedText style={[styles.price, { color: theme.success }]} numberOfLines={1}>
        {formatBs(primaryVariant.priceUnidad)}
      </ThemedText>

      {inOrder ? (
        <Icon name="checkmark.circle.fill" size={15} color={theme.accent} />
      ) : (
        <Icon name="chevron.right" size={13} color={theme.textSecondary} />
      )}
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
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  family: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  variantPill: {
    flexShrink: 0,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  variantText: {
    fontSize: 9,
    fontWeight: '700',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
