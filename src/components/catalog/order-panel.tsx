import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useDialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { ThemedText } from '@/components/themed-text';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { useConnectivity } from '@/context/connectivity-context';
import { useOrderIncentives } from '@/context/order-incentives-context';
import { PAYMENT_METHODS, type PaymentMethod } from '@/data/mock-incentives';
import { useTheme } from '@/hooks/use-theme';
import type { CartLine } from '@/types/catalog';
import { lineAmount, lineIce, lineQtyDetail } from '@/utils/order';
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
  const { lines, removeLine, clearCart, totalAmount } = useCart();
  const { offline } = useConnectivity();
  const { status, request, reset: resetIncentives } = useOrderIncentives();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Contado');

  const emptyCart = lines.length === 0;
  // Discounts and bonifications are resolved server-side, so there is nothing to
  // continue to while offline.
  const continueDisabled = emptyCart || offline;
  const pricing = status === 'loading';

  /**
   * Resolve the order's incentives, then move on. Awaited rather than fired and forgotten so
   * the summary opens with the reply already in hand instead of rendering an empty shell and
   * filling in underneath the seller.
   */
  const handleApplyIncentives = async () => {
    const resolved = await request(lines, paymentMethod, totalAmount);
    if (!resolved) {
      // Stays on the cart. Opening the summary with no reply would show it falling back to a
      // locally guessed discount, which looks like an answer and is not one.
      dialog.show({
        icon: 'exclamationmark.circle',
        tone: 'danger',
        title: 'No se pudieron calcular los descuentos',
        message: 'No hubo respuesta del servicio. Revisá la conexión y volvé a intentarlo.',
      });
      return;
    }
    onContinue?.(paymentMethod);
  };

  /**
   * Emptying the order is the one action here that destroys work, and the cart has no undo, so
   * it asks first. The confirming action carries the count: "Quitar 7 productos" is a different
   * decision from "Quitar 1", and the number is what the seller checks before agreeing.
   */
  const handleClearCart = () => {
    dialog.show({
      icon: 'trash',
      tone: 'danger',
      title: '¿Vaciar el pedido?',
      message: 'Se quitarán todos los productos de la lista. No se puede deshacer.',
      actions: [
        { label: 'Cancelar', variant: 'outline' },
        {
          label: `Quitar ${lines.length} ${lines.length === 1 ? 'producto' : 'productos'}`,
          variant: 'primary',
          tone: 'danger',
          onPress: () => {
            clearCart();
            // The pricing reply describes the lines that just went away, and it is keyed by
            // product code, so leaving it behind would let a rebuilt order inherit the old
            // order's discounts and free goods.
            resetIncentives();
          },
        },
      ],
    });
  };

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
        lines.map((line) => (
          // The whole row opens the product sheet, where quantities are edited with
          // the same stepper used to add them — no separate decrement button here.
          <Pressable
            key={String(line.productId)}
            onPress={() => onEditLine?.(line)}
            style={[
              styles.line,
              {
                backgroundColor: theme.backgroundElement,
                borderTopColor: theme.border,
                borderRightColor: theme.border,
                borderBottomColor: theme.border,
                borderLeftColor: theme.accent,
              },
            ]}>
            {/* Three rows, fixed: what it is, how much of it, what it costs. The name
                owns its row outright — it is the only thing the seller reads to know
                the line is the right one, and it is what gets truncated first when it
                has to share the row with amounts. */}
            <View style={styles.lineTop}>
              <ThemedText type="smallBold" numberOfLines={1} style={styles.lineName}>
                {line.productName}
              </ThemedText>
              <Pressable
                hitSlop={8}
                onPress={() => removeLine(line.productId)}
                style={[styles.iconButton, { backgroundColor: theme.dangerSoft }]}>
                <Icon name="trash" size={14} color={theme.danger} />
              </Pressable>
            </View>

            {/* Both unit types share one row, and each only appears when it was
                actually ordered — a case-only line reads as just the cases. Prices
                travel with the quantities so the amount below stays verifiable. */}
            <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.qtyText}>
              {lineQtyDetail(line)}
            </ThemedText>

            <View style={styles.lineBottom}>
              <ThemedText themeColor="textSecondary" style={styles.lineMeta}>
                ICE {formatBs(lineIce(line))}
              </ThemedText>
              <ThemedText style={[styles.lineSubtotal, { color: theme.success }]} numberOfLines={1}>
                {formatBs(lineAmount(line))}
              </ThemedText>
            </View>
          </Pressable>
        ))
      )}

      {/* Sits with the list it empties, not down with the footer buttons: given the same width
          and weight as "Aplicar descuentos" it would read as an equal next step, and it is the
          only control here that throws work away. Right-aligned and quiet, reachable but never
          the thing the thumb lands on by accident. Hidden on an empty cart, where it would be a
          button for removing nothing. */}
      {lines.length > 0 ? (
        <Pressable
          onPress={handleClearCart}
          hitSlop={6}
          style={[styles.clearButton, { borderColor: theme.border }]}>
          <Icon name="trash" size={13} color={theme.danger} />
          <ThemedText type="smallBold" style={[styles.clearLabel, { color: theme.danger }]}>
            Vaciar pedido
          </ThemedText>
        </Pressable>
      ) : null}

      {/* Totals sit directly under the cart: the running subtotal belongs to the
          list of products, not to the payment terms chosen further down. No product count
          here — the sheet's own header already carries it, right above this. */}
      <View style={[styles.totalsSection, { borderTopColor: theme.border }]}>
        <View style={styles.grandTotalRow}>
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

      {offline ? (
        <View style={[styles.notice, { backgroundColor: theme.accentAltSoft }]}>
          <Icon name="wifi.slash" size={14} color={theme.accentAlt} />
          <ThemedText style={[styles.noticeText, { color: theme.accentAlt }]}>
            Sin conexión no se pueden calcular descuentos ni bonificaciones. Guardá el pedido como
            prepedido y aplicalos al sincronizar.
          </ThemedText>
        </View>
      ) : null}

      {/* Discounts and free goods are the pricing service's answer, so this button waits for
          it rather than navigating straight on: the summary is only worth opening once there
          is something to summarise. Nothing here commits the order — that is still the
          summary screen's job. */}
      <Pressable
        disabled={continueDisabled || pricing}
        onPress={handleApplyIncentives}
        style={[
          styles.continueButton,
          { backgroundColor: theme.accent, opacity: continueDisabled || pricing ? 0.4 : 1 },
        ]}>
        {pricing ? (
          <>
            <ActivityIndicator size="small" color={theme.onAccent} />
            <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onAccent }]}>
              Consultando descuentos…
            </ThemedText>
          </>
        ) : (
          <>
            <Icon name="cash" size={15} color={theme.onAccent} />
            <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onAccent }]}>
              Aplicar descuentos y bonificaciones
            </ThemedText>
            <Icon name="chevron.right" size={15} color={theme.onAccent} />
          </>
        )}
      </Pressable>

      {/* Disabled only on an empty cart — there is no draft to save when there is nothing in it.
          Deliberately NOT disabled offline, unlike the button above: the draft is stored locally
          and synced later, which is exactly what lets the seller keep taking orders with no
          signal. The two buttons are unavailable for different reasons, so they must not share a
          condition. */}
      <Pressable
        disabled={emptyCart}
        onPress={handleSavePreorder}
        style={[
          styles.outlineButton,
          {
            borderColor: theme.border,
            backgroundColor: theme.backgroundElement,
            opacity: emptyCart ? 0.4 : 1,
          },
        ]}>
        <Icon
          name="tray.and.arrow.down"
          size={15}
          color={emptyCart ? theme.textSecondary : theme.text}
        />
        <ThemedText
          type="smallBold"
          style={[styles.buttonLabel, emptyCart ? { color: theme.textSecondary } : null]}>
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
  /**
   * One ordered product, carrying the same accent bar down its left edge that marks a line
   * item on the confirm screen. The two screens show the same rows, so a seller should not
   * have to relearn what a product looks like between building the order and closing it.
   *
   * The other three sides are coloured individually rather than with `borderColor`: that
   * shorthand sets all four, so it would paint over the left edge depending on which style
   * object lands last.
   */
  line: {
    borderRadius: Radius.sm,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 3,
    paddingVertical: 5,
    paddingRight: 8,
    // The bar eats two points of the gutter, so the text starts where it did before.
    paddingLeft: 6,
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
  lineBottom: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 6,
  },
  lineMeta: {
    fontSize: 10,
  },
  lineSubtotal: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  qtyText: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  iconButton: {
    width: 24,
    height: 24,
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
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 5,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  clearLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
  totalsSection: {
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // No border of its own any more: it used to be divided from the product count above it,
  // and now that it is the only row in the section, that rule would sit a few points under
  // the section's own and read as a double line.
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
