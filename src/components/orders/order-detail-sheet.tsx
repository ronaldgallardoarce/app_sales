import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CancelOrderSheet } from '@/components/orders/cancel-order-sheet';
import { paidAtLabel } from '@/components/orders/order-summary-document';
import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon, type IconName } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { deliveryDateLabel } from '@/data/mock-order-details';
// ORDER_STATUS_META goes with the commented-out status pill below.
import {
  canAnnulOrder,
  canEditOrder,
  CHANGE_WINDOW_HOURS,
  changeTimeLeftLabel,
  editBlockedReason,
  orderNumberLabel,
  PAID_ANNUL_WINDOW_MINUTES,
  type CancelReason,
  type PlacedOrder,
} from '@/data/mock-orders';
import { useTheme } from '@/hooks/use-theme';
import { formatBs } from '@/utils/currency';
import { lineAmount, lineQtyDetail } from '@/utils/order';

/**
 * A placed order in full: the same facts the confirm screen collected, read back.
 *
 * Ordered the way the order was built — who and when, then the products, then what it came to —
 * because a seller checking an order against a client's complaint follows that same path. The
 * line rows reuse the shape they had on the confirm screen, accent bar included, so a product
 * looks like a product everywhere in the app.
 */
export function OrderDetailSheet({
  order,
  onClose,
  onEdit,
  onAnnul,
  onShowSummary,
  onShowInvoice,
}: {
  /** Null keeps the sheet closed; a value opens it on that order. */
  order: PlacedOrder | null;
  onClose: () => void;
  onEdit: () => void;
  /** Withdraw the order on the grounds the seller picked in the sheet this one raises. */
  onAnnul: (reason: CancelReason) => void;
  /**
   * Opens the shareable summary. Raised to the screen rather than owned here because this sheet
   * unmounts with the order it is showing, and a summary nested inside would be torn down with it
   * the moment closing one led to the other.
   */
  onShowSummary: () => void;
  /** Opens the factura, on the same route and for the same reason. Only offered when one exists. */
  onShowInvoice: () => void;
}) {
  const theme = useTheme();
  const [cancelVisible, setCancelVisible] = useState(false);

  /**
   * Cleared by hand, because this component is not unmounted between orders: the screens keep it
   * rendered with `order: null` while it is closed, so the flag would still be standing the next
   * time one is opened and the annul sheet would come up over an order nobody asked to withdraw.
   */
  useEffect(() => {
    if (!order) setCancelVisible(false);
  }, [order]);

  if (!order) return null;

  // const meta = ORDER_STATUS_META[order.status]; // with the status pill below
  /**
   * Evaluated on open, not on a timer — and at a two-hour window that is now a real, if small,
   * approximation rather than a free one.
   *
   * While the window was two days wide, a sheet could be left open for an entire lunch and still
   * be telling the truth. At two hours the countdown below drifts by however long the sheet stays
   * up, and an order read at the very edge of its window can have the button live for a minute
   * after it closed. Worth a ticking clock if the rule tightens further or the window is ever
   * shown on the list rows; not worth one for a sheet that is open for seconds at a time.
   */
  /**
   * What was collected up front, on the orders that were. Absent on everything paid against delivery,
   * which is most of them — so the block below appears only when there is money to account for.
   */
  const payment = order.payment;
  const editable = canEditOrder(order);
  const annullable = canAnnulOrder(order);
  const blocked = editBlockedReason(order);
  const timeLeft = changeTimeLeftLabel(order);

  return (
    <BottomSheet visible onClose={onClose} maxHeight={620}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerTexts}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.id}>
              {orderNumberLabel(order.id)}
            </ThemedText>
            <ThemedText themeColor="textSecondary" numberOfLines={2} style={styles.client}>
              {order.clientCode}-{order.clientName}
            </ThemedText>
          </View>
          {/* Status pill hidden for now, by request. Restore by uncommenting.
          <View style={[styles.statusPill, { backgroundColor: theme[meta.soft] }]}>
            <ThemedText style={[styles.statusText, { color: theme[meta.color] }]}>{meta.label}</ThemedText>
          </View>
          */}

          {/* Up here and not down with the buttons, because it is not one of them: editing and
              annulling change the order and are both governed by the two-hour window, while this
              only reads it back — and reading is never blocked, so an order the seller can no
              longer touch is exactly the one they are most likely to be asked to show a client.
              Sharing a row with the other two made it look like a third way to alter the order,
              and it took width from the one button that actually does. */}
          <Pressable
            onPress={onShowSummary}
            style={[styles.summaryButton, { backgroundColor: theme.accentSoft }]}>
            {/* "Compartir" and the share glyph rather than naming the document: what the seller
                comes here to do is send the order to the client — PDF, image or WhatsApp — and the
                summary is what they end up looking at on the way. */}
            <Icon name="share" size={14} color={theme.accent} />
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              style={[styles.summaryLabel, { color: theme.accent }]}>
              Compartir
            </ThemedText>
          </Pressable>
        </View>

        {/* Money already in, and the document that proves it.

            Its own block directly under the header, not a row down in the totals: "this was paid"
            is the first thing that changes how the rest of the sheet is read — an order that is
            already collected is not one the seller chases, and the factura is what the client asks
            for by name.

            Paid and invoiced are separated on purpose, because they are two services and two
            moments. The seconds between them are a real state, and saying "Factura en camino" is
            the honest version of a button that would otherwise open nothing. */}
        {payment ? (
          <View style={[styles.paymentCard, { backgroundColor: theme.successSoft }]}>
            <View style={styles.paymentHead}>
              <Icon name="creditcard" size={14} color={theme.success} />
              <ThemedText type="smallBold" numberOfLines={1} style={[styles.paymentTitle, { color: theme.success }]}>
                Cobrado por adelantado
              </ThemedText>
              <ThemedText style={[styles.paymentWhen, { color: theme.success }]} numberOfLines={1}>
                {paidAtLabel(payment.paidAtMs)}
              </ThemedText>
            </View>

            {payment.invoiceId ? (
              <Pressable
                onPress={onShowInvoice}
                style={[styles.invoiceRow, { backgroundColor: theme.backgroundElement, borderColor: theme.success }]}>
                <Icon name="doc.text" size={14} color={theme.success} />
                <ThemedText type="smallBold" numberOfLines={1} style={styles.invoiceLabel}>
                  Factura {payment.invoiceId}
                </ThemedText>
                <ThemedText type="smallBold" style={[styles.invoiceAction, { color: theme.success }]}>
                  Ver y enviar
                </ThemedText>
                <Icon name="chevron.right" size={13} color={theme.success} />
              </Pressable>
            ) : (
              <View style={[styles.invoiceRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Icon name="clock.fill" size={14} color={theme.accentAlt} />
                <ThemedText style={[styles.invoicePending, { color: theme.accentAlt }]} numberOfLines={2}>
                  Factura en camino. Va a aparecer acá cuando esté lista.
                </ThemedText>
              </View>
            )}
          </View>
        ) : null}

        {/* Sync notice hidden for now, by request. The `synced` flag is still on the order, so
            uncommenting brings it back with no other change.
        {!order.synced ? (
          <View style={[styles.notice, { backgroundColor: theme.accentAltSoft }]}>
            <Icon name="sync" size={13} color={theme.accentAlt} />
            <ThemedText style={[styles.noticeText, { color: theme.accentAlt }]}>
              Este pedido todavía no se sincronizó. Se enviará al recuperar la señal.
            </ThemedText>
          </View>
        ) : null}
        */}

        <SectionLabel>Pedido</SectionLabel>
        <View style={[styles.card, { backgroundColor: theme.background }]}>
          <FactRow icon="calendar" label="Tomado el" value={deliveryDateLabel(order.createdAt)} />
          <FactRow
            icon="shippingbox.fill"
            label="Entrega"
            value={`${deliveryDateLabel(order.deliveryDate)}, ${order.deliveryFrom} a ${order.deliveryTo}`}
          />
          <FactRow icon="cash" label="Pago" value={order.paymentMethod} />
          <FactRow
            icon={order.remote ? 'smartphone' : 'store'}
            label="Modalidad"
            value={order.remote ? 'Pedido remoto' : 'Pedido presencial'}
            tone={order.remote ? theme.violet : undefined}
          />
          {/* Only on an annulled order, and in danger red: this is the fact that overrides every
              other one in the block — the delivery it names is not happening. */}
          {order.cancelReason ? (
            <FactRow
              icon="xmark.circle.fill"
              label="Anulado por"
              value={order.cancelReason}
              tone={theme.danger}
            />
          ) : null}
        </View>

        <SectionLabel>Productos</SectionLabel>
        {order.lines.map((line) => {
          const bonification = order.bonifications.find((entry) => entry.productId === line.productId);
          return (
            <View
              key={String(line.productId)}
              style={[
                styles.lineCard,
                {
                  backgroundColor: theme.background,
                  borderTopColor: theme.border,
                  borderRightColor: theme.border,
                  borderBottomColor: theme.border,
                  borderLeftColor: theme.accent,
                },
              ]}>
              <ThemedText type="smallBold" numberOfLines={1} style={styles.lineName}>
                {line.productName}
              </ThemedText>
              <View style={styles.lineBottom}>
                <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.lineQty}>
                  {lineQtyDetail(line)}
                </ThemedText>
                <ThemedText style={[styles.lineAmount, { color: theme.success }]} numberOfLines={1}>
                  {formatBs(lineAmount(line))}
                </ThemedText>
              </View>

              {/* The gift hangs off the line that earned it, in the same green block the confirm
                  screen uses, so a bonified product is recognised the same way in both places.
                  The delivered product is named in full: on a past order the seller is checking
                  what actually shipped, and by then the flavour may not be the one ordered. */}
              {bonification ? (
                <View style={[styles.giftCard, { backgroundColor: theme.successSoft }]}>
                  <View style={styles.giftHeader}>
                    <Icon name="gift" size={12} color={theme.success} />
                    <ThemedText style={[styles.giftQty, { color: theme.success }]} numberOfLines={1}>
                      {bonification.qty} {bonification.minUnitLabel} de regalo
                    </ThemedText>
                  </View>
                  <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.giftProduct}>
                    {bonification.giftProductId} - {bonification.giftProductName}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          );
        })}

        <SectionLabel>Totales</SectionLabel>
        <View style={[styles.card, { backgroundColor: theme.background }]}>
          <TotalRow label="ICE" value={formatBs(order.ice)} />
          <TotalRow label="Subtotal" value={formatBs(order.subtotal)} />
          {order.discount > 0 ? (
            <TotalRow label="Descuento" value={`−${formatBs(order.discount)}`} tone={theme.accent} />
          ) : null}
          {order.bonificationUnits > 0 ? (
            <TotalRow
              label="Bonificación"
              value={`${order.bonificationUnits} de regalo`}
              tone={theme.success}
            />
          ) : null}
          <View style={[styles.grandTotalRow, { borderTopColor: theme.border }]}>
            <ThemedText type="smallBold" style={styles.grandTotalLabel}>
              Total
            </ThemedText>
            <ThemedText style={[styles.grandTotalValue, { color: theme.success }]}>
              {formatBs(order.total)}
            </ThemedText>
          </View>
        </View>

        {/* Editing closes a couple of hours after the order was taken, and for good the first time
            it is used; annulling closes on the same clock, minus the one-use half. Both buttons stay
            visible once they close rather than disappearing: a seller who cannot find one does not
            know whether the feature is missing or the door is shut, so the edit button says which —
            and names which of the two rules shut it, because "you already edited this" and "you took
            too long" are different conversations with the office. The annul button carries no label
            to say it with, so its reason lives in the line below. */}
        <View style={styles.actions}>
          <Pressable
            disabled={!editable}
            onPress={onEdit}
            style={[
              styles.actionButton,
              {
                backgroundColor: editable ? theme.accent : theme.backgroundSelected,
                opacity: editable ? 1 : 0.7,
              },
            ]}>
            <Icon name="pencil" size={15} color={editable ? theme.onAccent : theme.textSecondary} />
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              style={[styles.actionLabel, { color: editable ? theme.onAccent : theme.textSecondary }]}>
              {editable
                ? 'Editar pedido'
                : blocked === 'paid'
                  ? 'Cobrado: no se edita'
                  : blocked === 'edited'
                    ? 'Ya se editó'
                    : 'Ya no se puede editar'}
            </ThemedText>
          </Pressable>

          {/* An X and not a trash can: the order is not being thrown away. It stays on the list,
              marked and carrying the reason it was withdrawn — a bin would promise the seller it
              disappears. */}
          <Pressable
            disabled={!annullable}
            onPress={() => setCancelVisible(true)}
            style={[
              styles.deleteButton,
              {
                backgroundColor: annullable ? theme.dangerSoft : theme.backgroundSelected,
                opacity: annullable ? 1 : 0.7,
              },
            ]}>
            <Icon name="xmark" size={15} color={annullable ? theme.danger : theme.textSecondary} />
          </Pressable>
        </View>

        <ThemedText themeColor="textSecondary" style={styles.editHint}>
          {/* The one-edit rule is said before it bites, not only after: a seller who knows this is
              their only pass makes it count, and finding out afterwards is finding out too late.
              An order that spent its edit can still be annulled, so that middle case says what is
              left rather than reading as if the whole order had closed. An already annulled one
              says so first — for that order neither clock means anything any more. */}
          {/* A collected order gets its own two branches, because neither of the ordinary ones is
              true of it: it is not "ya se editó" and it is not out of time — it is paid, which closes
              editing outright and puts annulling on the payment's much shorter clock. Both branches
              say the money moves, since that is the part the seller has to be sure of before pressing
              anything, and the closed one names who to talk to instead of leaving a dead end. */}
          {order.status === 'anulado'
            ? 'Este pedido está anulado.'
            : payment
              ? annullable
                ? `Este pedido ya está cobrado, así que no se edita. Se puede anular por ${timeLeft} más y el pago se revierte.`
                : `Este pedido está cobrado y pasó la ventana de ${PAID_ANNUL_WINDOW_MINUTES} minutos para revertir el pago. Para una devolución, hablá con la oficina.`
              : editable
                ? `Se puede editar una sola vez o anular, por ${timeLeft} más.`
                : annullable
                  ? `Este pedido ya se editó. Se puede anular por ${timeLeft} más.`
                  : `Los pedidos se editan o anulan dentro de las ${CHANGE_WINDOW_HOURS} horas de creados.`}
        </ThemedText>
      </ScrollView>

      {/* Nested inside this sheet's tree rather than raised beside it — see the note on the
          component. Reachable only through the button above, which is closed once the order is
          already annulled. */}
      <CancelOrderSheet
        visible={cancelVisible}
        onClose={() => setCancelVisible(false)}
        orderId={order.id}
        clientName={`${order.clientCode}-${order.clientName}`}
        // Withdrawing a collected order sends money back, which is a materially different thing from
        // withdrawing a promise — so the sheet that asks for a reason says so before it is confirmed.
        refundAmount={payment ? order.total : undefined}
        onConfirm={onAnnul}
      />
    </BottomSheet>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
      {children}
    </ThemedText>
  );
}

function FactRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  tone?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.factRow}>
      <Icon name={icon} size={13} color={theme.textSecondary} />
      <ThemedText themeColor="textSecondary" style={styles.factLabel}>
        {label}
      </ThemedText>
      <ThemedText
        type="smallBold"
        numberOfLines={2}
        style={[styles.factValue, tone ? { color: tone } : null]}>
        {value}
      </ThemedText>
    </View>
  );
}

function TotalRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.totalRow}>
      <ThemedText themeColor="textSecondary" style={styles.totalLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={[styles.totalValue, tone ? { color: tone } : null]}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  headerTexts: {
    flex: 1,
    gap: 1,
  },
  id: {
    fontSize: 17,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },
  client: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  // A pill in the header, not a button in the action row: same height as the order number beside
  // it, and it never grows — the client name below is what takes the width.
  summaryButton: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  summaryLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  paymentCard: {
    padding: Spacing.two,
    borderRadius: Radius.sm,
    gap: 6,
  },
  paymentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  paymentTitle: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  paymentWhen: {
    flexShrink: 0,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  invoiceLabel: {
    // Takes the row and truncates, so the action beside it keeps its full width — the same division
    // the cart's own rows make between what a thing is and what pressing it does.
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  invoiceAction: {
    flexShrink: 0,
    fontSize: 11,
    lineHeight: 15,
  },
  invoicePending: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  statusPill: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: Spacing.two,
    borderRadius: Radius.sm,
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  sectionLabel: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    gap: 3,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  factLabel: {
    width: 74,
    fontSize: 10,
    lineHeight: 14,
  },
  factValue: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
  },
  lineCard: {
    borderRadius: Radius.sm,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 3,
    paddingVertical: 5,
    paddingRight: Spacing.two,
    paddingLeft: Spacing.two - 2,
    gap: 1,
  },
  lineName: {
    fontSize: 12,
    lineHeight: 16,
  },
  lineBottom: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  lineQty: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  lineAmount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  giftCard: {
    marginTop: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 1,
  },
  giftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  giftQty: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  giftProduct: {
    fontSize: 10,
    lineHeight: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
  actionLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  // Square and unlabelled beside the wide edit button: withdrawing the order should not be as
  // easy to hit as amending it. Now the only thing sharing that row with the edit button.
  deleteButton: {
    width: ControlHeight.input,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editHint: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  totalLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
  totalValue: {
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  grandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
    paddingTop: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grandTotalLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  grandTotalValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
