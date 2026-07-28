import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Product } from '@/types/catalog';
import { formatBs } from '@/utils/currency';
import type { SuggestionAxis } from '@/utils/suggestions';

export function SuggestionCard({
  product,
  axis,
  inOrder,
  onPress,
}: {
  product: Product;
  /** Which attribute differs — it becomes the headline, so the card says why it's here. */
  axis: SuggestionAxis;
  /** Whether the product already carries a quantity, drafted or already in the cart. */
  inOrder: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const headline = axis === 'flavor' ? (product.flavor ?? product.baseName) : (product.sizeLabel ?? product.baseName);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          // Accent border is the whole "already in the order" cue: the quantities
          // themselves are listed further down the sheet, so repeating them here
          // would only make the card taller.
          borderColor: inOrder ? theme.accent : theme.border,
        },
      ]}>
      <ThemedText style={[styles.caption, { color: theme.textSecondary }]} numberOfLines={2}>
        {product.baseName}
      </ThemedText>

      <ThemedText type="smallBold" numberOfLines={2} style={styles.headline}>
        {headline}
      </ThemedText>

      {/* Pushed to the bottom edge so every card in a strip aligns its price, whatever
          the headline above it needed. */}
      <ThemedText style={[styles.price, { color: theme.accent }]}>{formatBs(product.priceUnidad)}</ThemedText>

      {/* Pencil versus plus: a tap always moves the sheet to this product, but what
          happens next differs — an existing quantity gets edited, a missing one gets
          added. The accent belongs to the first case, matching the border. */}
      <View
        style={[
          styles.actionBadge,
          { backgroundColor: inOrder ? theme.accentSoft : theme.backgroundSelected },
        ]}>
        <Icon
          name={inOrder ? 'pencil' : 'plus'}
          size={13}
          color={inOrder ? theme.accent : theme.textSecondary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    // Square: the strips read as a row of equal tiles rather than a list of bars.
    width: 112,
    height: 112,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    padding: Spacing.two,
    gap: 2,
  },
  caption: {
    // Clears the affordance badge so neither line runs under it.
    paddingRight: 24,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  headline: {
    paddingRight: 24,
    fontSize: 13,
    lineHeight: 17,
  },
  price: {
    marginTop: 'auto',
    fontSize: 14,
    fontWeight: '700',
  },
  actionBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
