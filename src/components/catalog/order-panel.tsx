import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useDialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { ThemedText } from '@/components/themed-text';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { PAYMENT_METHODS, type PaymentMethod } from '@/data/mock-incentives';
import { useTheme } from '@/hooks/use-theme';
import type { CartLine } from '@/types/catalog';
import { groupIntoItems, unitLabelOf } from '@/utils/order';
import { formatBs } from '@/utils/currency';

export function OrderPanel({
  contentPaddingBottom,
  onContinue,
  onEditLine,
}: {
  contentPaddingBottom: number;
  /**
   * Move on to the order summary, where incentives are calculated and the order is
   * confirmed. The chosen payment terms travel with it because they drive the
   * discount.
   */
  onContinue?: (paymentMethod: PaymentMethod) => void;
  /** Tapping a line asks the screen to reopen the product sheet to edit it. */
  onEditLine?: (line: CartLine) => void;
}) {
  const theme = useTheme();
  const dialog = useDialog();
  const { lines, removeLine, totalAmount } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Contado');

  const items = useMemo(() => groupIntoItems(lines), [lines]);

  const handleSavePreorder = () => {
    dialog.show({
      icon: 'tray.and.arrow.down',
      tone: 'accent',
      title: 'Prepedido guardado',
      message: 'El pedido quedó guardado como borrador. Podrás retomarlo más tarde.',
    });
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: contentPaddingBottom }]}
      showsVerticalScrollIndicator={false}>
      {/* No title here — the screen's control row above already labels the panel. */}
      {lines.length === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          Aún no agregaste productos.
        </ThemedText>
      ) : (
        items.map((item) => (
          // The whole row opens the product sheet, where quantities are edited with
          // the same stepper used to add them — no separate decrement button here.
          <Pressable
            key={item.sku}
            onPress={() => onEditLine?.(item.lines[0])}
            style={[styles.line, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={styles.lineTop}>
              <ThemedText type="smallBold" numberOfLines={1} style={styles.lineName}>
                {item.productName}
                {item.flavor ? ` · ${item.flavor}` : ''}
              </ThemedText>
              <ThemedText style={[styles.lineSubtotal, { color: theme.success }]} numberOfLines={1}>
                {formatBs(item.subtotal)}
              </ThemedText>
              <Pressable
                hitSlop={8}
                onPress={() => item.lines.forEach((line) => removeLine(line.id))}
                style={[styles.iconButton, { backgroundColor: theme.dangerSoft }]}>
                <Icon name="trash" size={14} color={theme.danger} />
              </Pressable>
            </View>

            {/* One quantity per unit type, each with the price it was priced at. */}
            {item.lines.map((line) => (
              <View key={line.id} style={styles.qtyRow}>
                <ThemedText type="smallBold" style={styles.qtyText}>
                  {line.qty} {unitLabelOf(line)}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.qtyText}>
                  × {formatBs(line.unitPrice)}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={[styles.qtyText, styles.qtyAmount]}>
                  {formatBs(line.qty * line.unitPrice)}
                </ThemedText>
              </View>
            ))}

            <ThemedText themeColor="textSecondary" style={styles.lineMeta}>
              ICE {formatBs(item.ice)}
            </ThemedText>
          </Pressable>
        ))
      )}

      {/* Totals sit directly under the cart: the running subtotal belongs to the
          list of products, not to the payment terms chosen further down. */}
      <View style={[styles.totalsSection, { borderTopColor: theme.border }]}>
        <View style={styles.totalRow}>
          <ThemedText themeColor="textSecondary" type="small">
            Productos
          </ThemedText>
          <ThemedText type="small">{items.length}</ThemedText>
        </View>
        <View style={[styles.grandTotalRow, { borderTopColor: theme.border }]}>
          <ThemedText type="smallBold" style={styles.grandTotalLabel}>
            Subtotal
          </ThemedText>
          <ThemedText style={[styles.totalValue, { color: theme.success }]}>{formatBs(totalAmount)}</ThemedText>
        </View>
      </View>

      <View style={[styles.section, { borderTopColor: theme.border }]}>
        <ThemedText type="smallBold">Método de pago</ThemedText>
        <View style={[styles.segment, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {PAYMENT_METHODS.map((method) => {
            const active = method === paymentMethod;
            return (
              <Pressable
                key={method}
                onPress={() => setPaymentMethod(method)}
                style={[styles.segmentButton, active ? { backgroundColor: theme.accent } : null]}>
                <ThemedText
                  type="smallBold"
                  numberOfLines={1}
                  style={[styles.segmentText, { color: active ? theme.onAccent : theme.textSecondary }]}>
                  {method}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {paymentMethod === 'Pronto pago' ? (
          <View style={[styles.notice, { backgroundColor: theme.accentAltSoft }]}>
            <Icon name="exclamationmark.circle" size={14} color={theme.accentAlt} />
            <ThemedText style={[styles.noticeText, { color: theme.accentAlt }]}>
              Pronto pago aplica un descuento especial. El producto no se descarga hasta recibir el
              pago del cliente.
            </ThemedText>
          </View>
        ) : null}
      </View>

      {/* Discounts are resolved on the summary screen, which is also where the order
          is confirmed — nothing here commits the order. */}
      <Pressable
        disabled={lines.length === 0}
        onPress={() => onContinue?.(paymentMethod)}
        style={[
          styles.continueButton,
          { backgroundColor: theme.accent, opacity: lines.length === 0 ? 0.4 : 1 },
        ]}>
        <Icon name="cash" size={15} color={theme.onAccent} />
        <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onAccent }]}>
          Aplicar descuentos y bonificaciones
        </ThemedText>
        <Icon name="chevron.right" size={15} color={theme.onAccent} />
      </Pressable>

      <Pressable
        onPress={handleSavePreorder}
        style={[styles.outlineButton, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <Icon name="tray.and.arrow.down" size={15} color={theme.text} />
        <ThemedText type="smallBold" style={styles.buttonLabel}>
          Guardar prepedido
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    // Matches the product list's gutters so the panel lines up with the rest of
    // the screen instead of running to the edges.
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  empty: {
    paddingVertical: Spacing.five,
    textAlign: 'center',
  },
  line: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 1,
  },
  lineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lineName: {
    flex: 1,
    fontSize: 12,
  },
  lineMeta: {
    fontSize: 10,
  },
  lineSubtotal: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  qtyText: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  qtyAmount: {
    flex: 1,
    textAlign: 'right',
    // Clears the trash button so amounts line up under the subtotal above.
    marginRight: 26 + 6,
  },
  iconButton: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segmentButton: {
    flex: 1,
    height: ControlHeight.segment,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 12,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: Spacing.two,
    borderRadius: Radius.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    marginTop: Spacing.two,
  },
  totalsSection: {
    gap: 6,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grandTotalLabel: {
    fontSize: 14,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  footerButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  outlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
  buttonLabel: {
    fontSize: 12,
  },
});
