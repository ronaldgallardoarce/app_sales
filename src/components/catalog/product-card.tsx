import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Product } from '@/types/catalog';
import { formatBs } from '@/utils/currency';

export const PRODUCT_CARD_HEIGHT = 66;

export function ProductCard({
  product,
  onPress,
}: {
  product: Product;
  onPress: (product: Product) => void;
}) {
  const theme = useTheme();
  const primaryVariant = product.variants[0];
  const hasVariants = product.variants.length > 1;
  const code = hasVariants ? primaryVariant.sku.split('-').slice(0, 2).join('-') : primaryVariant.sku;

  return (
    <Pressable onPress={() => onPress(product)} style={[styles.row, { borderBottomColor: theme.border }]}>
      {/* <View style={[styles.codeBadge, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText style={[styles.codeText, { color: theme.textSecondary }]} numberOfLines={1}>
          {code}
        </ThemedText>
      </View> */}

      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {code} - {product.name}
        </ThemedText>
        <ThemedText style={[styles.family, { color: theme.textSecondary }]} numberOfLines={1}>
          {product.family}
          {hasVariants ? ` · ${product.variants.length} sabores` : ''}
        </ThemedText>
      </View>

      <View style={styles.priceCol}>
        <ThemedText style={[styles.price, { color: theme.danger }]}>
          {/* {hasVariants ? 'desde ' : ''} */}
          {formatBs(primaryVariant.priceUnidad)}
        </ThemedText>
      </View>

      <Icon name="chevron.right" size={14} color={theme.textSecondary} />
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
  },
  codeBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  codeText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  family: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
