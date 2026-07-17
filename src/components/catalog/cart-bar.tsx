import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ThemedText } from '@/components/themed-text';
import { CardShadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatBs } from '@/utils/currency';

const COLUMNS = ['Producto', 'Cantidad', 'Precio Bs.', 'ICE Bs.', 'Total Bs.'];

export function CartSummaryBar({
  productCount,
  totalAmount,
  onPress,
}: {
  productCount: number;
  totalAmount: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const isEmpty = productCount === 0;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, CardShadow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.headerLine}>
        <Icon name="cart" size={16} color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary" type="small">
          {isEmpty ? 'Sin productos en la lista' : `${productCount} ${productCount === 1 ? 'producto' : 'productos'} en la lista`}
        </ThemedText>
      </View>

      <View style={[styles.columnsRow, { borderTopColor: theme.border }]}>
        {COLUMNS.map((col, index) => (
          <ThemedText
            key={col}
            numberOfLines={1}
            style={[
              styles.columnLabel,
              { color: theme.textSecondary, flex: index === 0 ? 1.6 : 1, textAlign: index === 0 ? 'left' : 'right' },
            ]}>
            {col}
          </ThemedText>
        ))}
      </View>

      <View style={styles.totalRow}>
        <ThemedText type="smallBold">Total General:</ThemedText>
        <ThemedText style={[styles.totalValue, { color: theme.accent }]}>{formatBs(totalAmount)}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  columnsRow: {
    flexDirection: 'row',
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  columnLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'baseline',
    gap: 6,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
