import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VisitTimer } from '@/components/client/visit-timer';
import { DeliveryPointSheet } from '@/components/order/delivery-point-sheet';
import { DeliveryWindowSheet } from '@/components/order/delivery-window-sheet';
import { GiftProductSheet } from '@/components/order/gift-product-sheet';
import { DatePickerDialog } from '@/components/ui/date-picker';
import { ThemedText } from '@/components/themed-text';
import { useDialog } from '@/components/ui/dialog';
import { Icon, type IconName } from '@/components/ui/icon';
import { OfflineBadge } from '@/components/ui/offline-badge';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { useClientVisits } from '@/context/client-visit-context';
import { useConnectivity } from '@/context/connectivity-context';
import { bonificationOf, useOrderIncentives } from '@/context/order-incentives-context';
import { useOrders } from '@/context/orders-context';
import { type LineBonification } from '@/data/mock-bonifications';
import { mockProducts } from '@/data/mock-catalog';
import { calculateIncentives, PAYMENT_METHODS, type PaymentMethod } from '@/data/mock-incentives';
import {
  deliveryDateLabel,
  deliveryDateOptions,
  deliveryPointLabel,
  DELIVERY_WINDOWS,
  deliveryWindowLabelFor,
  deliveryWindowSpan,
  fromDateKey,
  orderDetailsFor,
  ORDER_TYPES,
  toDateKey,
  type OrderType,
} from '@/data/mock-order-details';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';
import type { CartLine, Product } from '@/types/catalog';
import { iceTotalOf, lineAmount, lineIce, lineQtyDetail } from '@/utils/order';
import { suggestionsFor } from '@/utils/suggestions';
import { formatBs } from '@/utils/currency';

export default function OrderConfirmScreen() {
  const theme = useTheme();
  const router = useRouter();
  const dialog = useDialog();
  const insets = useContentInsets();
  const { clients, markOrder, activityOf } = useClientVisits();
  const { lines, clearCart, totalAmount } = useCart();
  const { offline } = useConnectivity();

  const { clientId, paymentMethod: paymentParam, editOrderId } = useLocalSearchParams<{
    clientId?: string;
    paymentMethod?: string;
    /** Set when the catalog was opened to amend a placed order. */
    editOrderId?: string;
  }>();

  const { updateOrder, find: findOrder } = useOrders();
  /**
   * The order being amended, or null for a new one. Everything below branches on this rather than
   * on the raw param, so a stale id — an order deleted from another screen while this one sat in
   * the stack — falls back to behaving like a new order instead of saving into nothing.
   */
  const editing = findOrder(editOrderId);

  const client = clients.find((c) => c.id === clientId) ?? null;

  /**
   * Whether this is a remote order, inferred from the on-site check-in rather than passed
   * along: the client screen calls `markEntry` only on the presencial path — the remote one
   * goes straight to the catalog without it — and both routes reach this screen carrying
   * nothing but the client id. `entered` is therefore the only shared trace of which door
   * the seller came through.
   */
  const isRemote = clientId ? !activityOf(clientId).entered : false;
  const paymentMethod: PaymentMethod =
    PAYMENT_METHODS.find((m) => m === paymentParam) ?? 'Contado';

  const details = useMemo(() => (client ? orderDetailsFor(client) : null), [client]);
  const dateOptions = useMemo(() => deliveryDateOptions(), []);

  /**
   * Seeded from the order when amending one, so the seller lands on what they already agreed and
   * changes only what moved. Lazy initialisers, evaluated once: after that these are the form's
   * own state, and re-deriving them would undo edits on every render.
   */
  const [orderType, setOrderType] = useState<OrderType>(editing?.orderType ?? 'Normal');
  const [deliveryPointId, setDeliveryPointId] = useState<string | null>(null);
  const [pointSheetVisible, setPointSheetVisible] = useState(false);
  /** Which line's gift flavor is being chosen — the ordered product's id, or null when closed. */
  const [giftLineId, setGiftLineId] = useState<number | null>(null);
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => editing?.deliveryDate ?? dateOptions[0].key);
  const [dateSheetVisible, setDateSheetVisible] = useState(false);
  const [windowSheetVisible, setWindowSheetVisible] = useState(false);
  const [fromHour, setFromHour] = useState<string>(editing?.deliveryFrom ?? DELIVERY_WINDOWS[1].from);
  const [toHour, setToHour] = useState<string>(editing?.deliveryTo ?? DELIVERY_WINDOWS[1].to);

  const iceTotal = useMemo(() => iceTotalOf(lines), [lines]);

  /**
   * The pricing service's reply, requested by the cart's "Aplicar descuentos y bonificaciones"
   * button before it navigated here. Falling back to a local calculation rather than showing
   * an error: this screen is also reachable by reload or deep link, where no request was ever
   * made, and a summary with no discount on it would be wrong rather than merely empty.
   */
  const { result, chooseGift, reset: resetIncentives } = useOrderIncentives();
  const incentives = useMemo(
    () => result?.incentives ?? calculateIncentives(paymentMethod, totalAmount),
    [result, paymentMethod, totalAmount],
  );

  const giftBonification = giftLineId === null ? null : bonificationOf(result, giftLineId);

  const discountAmount = (totalAmount * incentives.discountPct) / 100;
  const finalTotal = totalAmount - discountAmount;

  // Confirming registers the order, so it needs a connection; the prepedido saved
  // from the catalog panel is the offline path.
  const confirmDisabled = lines.length === 0 || offline;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/map' as Href));

  // Contact and delivery point are prefilled from the client record, but the seller
  // can override them, so the client data is only a fallback for what they picked.
  const selectedPointId = deliveryPointId ?? details?.deliveryPoints[0]?.id ?? null;
  const selectedPoint = details?.deliveryPoints.find((p) => p.id === selectedPointId) ?? null;
  const contactValue = contact || details?.contact || '';

  /**
   * The hours read back the way they are spoken: the stretch of day they name and how long they
   * last. Derived rather than looked up, so a range the seller built off the timeline reads as a
   * window too instead of leaving the row with bare numbers and no name. No guard keeping the end
   * after the start: the sheet cannot produce an inverted range.
   */
  const windowSummary = `${deliveryWindowLabelFor(fromHour, toHour)} · ${deliveryWindowSpan(fromHour, toHour)}`;

  /** True when the date came from the calendar rather than from one of the quick chips. */
  const customDate = !dateOptions.some((option) => option.key === deliveryDate);

  /**
   * Writes the amended order back over the one being edited.
   *
   * `id`, `createdAtMs` and `status` are carried across untouched: this is the same order, and
   * resetting its creation instant would silently hand it a fresh 48-hour edit window every time
   * it was saved. The amounts are recomputed from the lines as they now stand, because the whole
   * point of the edit was that the lines changed.
   */
  const saveEdit = () => {
    if (!editing) return;
    updateOrder({
      ...editing,
      deliveryDate,
      deliveryFrom: fromHour,
      deliveryTo: toHour,
      paymentMethod,
      orderType,
      // Snapshotted for the same reason the cart was copied on the way in: the order must not
      // share a line array with a cart that is about to be emptied and refilled.
      lines: lines.map((line) => ({ ...line })),
      bonifications: result?.bonifications ?? editing.bonifications,
      bonificationUnits: (result?.bonifications ?? editing.bonifications).reduce(
        (sum, bonification) => sum + bonification.qty,
        0,
      ),
      subtotal: totalAmount,
      discount: discountAmount,
      ice: iceTotal,
      total: finalTotal,
      // Back to unsent: the order on the server is no longer what the seller has agreed.
      synced: false,
    });
  };

  const confirm = () => {
    dialog.show({
      icon: 'checkmark.circle.fill',
      tone: 'success',
      title: editing ? 'Pedido actualizado' : 'Pedido confirmado',
      message: editing
        ? `Se guardaron los cambios de ${editing.id}. Nuevo total: ${formatBs(finalTotal)}.`
        : `Se registró el pedido por ${formatBs(finalTotal)}.`,
      actions: [
        {
          label: 'Listo',
          variant: 'primary',
          onPress: () => {
            if (editing) saveEdit();
            // Only a new order closes the visit: amending one the client already placed is not a
            // second sale, and marking it again would overwrite when the visit actually ended.
            else if (clientId) markOrder(clientId);

            clearCart();
            // Dropped alongside the cart, not after it: the reply is keyed by product code,
            // so a next order containing the same product would otherwise inherit this
            // order's free goods.
            resetIncentives();
            /**
             * `dismissTo`, not `replace`: the catalog and this screen are still on the stack
             * behind us, and replacing only swaps the top one — which left the client menu with
             * the catalog underneath it, so its back arrow went forwards into a finished order
             * instead of out to the map. Dismissing pops everything above the destination, so
             * back from there means back to where the visit actually started. Falls back to a
             * replace on its own if the destination is not in the stack.
             */
            router.dismissTo(
              editing
                ? ('/orders' as Href)
                : clientId
                  ? ({ pathname: '/client/[id]', params: { id: clientId } } as Href)
                  : ('/map' as Href),
            );
          },
        },
      ],
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable
            hitSlop={8}
            onPress={goBack}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="chevron.left" size={18} color={theme.text} />
          </Pressable>

          <View style={styles.titleColumn}>
            <ThemedText type="smallBold" style={styles.headerTitle} numberOfLines={1}>
              {editing ? `Editar ${editing.id}` : 'Confirmar pedido'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {/* Owner: route-level context, matching every other screen header. */}
              {client ? `${client.ownerCode}-${client.owner}` : 'Sin cliente'}
            </ThemedText>
          </View>

          <OfflineBadge />

          {clientId ? <VisitTimer clientId={clientId} compact /> : null}
        </View>
      </SafeAreaView>

      {/* Who the order is for and where it is being taken from — captured with the order,
          and pinned outside the ScrollView because it is the answer to "am I on the right
          client, on the right terms?", which has to stay true no matter how far down the
          form the seller is. Two lines and no caption on either: the storefront glyph says
          the first one is the shop, and the second one names itself. */}
      <View style={styles.pinned}>
        <View style={[styles.card, styles.clientCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={[styles.clientIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon name="store" size={16} color={theme.accent} />
          </View>
          <View style={styles.clientTexts}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.clientName}>
              {client ? `${client.code}-${client.name}` : 'Sin cliente'}
            </ThemedText>
            {/* Violet for remote, matching the colour the client screen gives that choice:
                a remote order is the exception there, so it should not read as routine here
                either. */}
            <ThemedText
              numberOfLines={1}
              style={[styles.orderMode, { color: isRemote ? theme.violet : theme.textSecondary }]}>
              {isRemote ? 'Pedido remoto' : 'Pedido presencial'}
            </ThemedText>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.three }]}>
        <SectionLabel>Detalle del pedido</SectionLabel>
        {lines.length === 0 ? (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              El pedido no tiene productos.
            </ThemedText>
          </View>
        ) : (
          lines.map((line) => {
            const amount = lineAmount(line);
            const lineDiscount = (amount * incentives.discountPct) / 100;
            return (
              <View
                key={String(line.productId)}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderTopColor: theme.border,
                    borderRightColor: theme.border,
                    borderBottomColor: theme.border,
                    borderLeftColor: theme.accent,
                  },
                ]}>
                {/* Same three rows as the catalog's order panel — what it is, how much
                    of it, what it costs — so a line the seller already reviewed there
                    does not rearrange itself on the screen where they confirm it. */}
                <View style={styles.itemTop}>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.itemName}>
                    {line.productName}
                  </ThemedText>
                  <ThemedText style={[styles.itemAmount, { color: theme.success }]} numberOfLines={1}>
                    {formatBs(amount - lineDiscount)}
                  </ThemedText>
                </View>

                <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.qtyText}>
                  {lineQtyDetail(line)}
                </ThemedText>

                <View style={styles.itemFooter}>
                  <ThemedText themeColor="textSecondary" style={styles.metaLabel}>
                    ICE {formatBs(lineIce(line))}
                  </ThemedText>
                  {/* Money only — the percentage was identical on every line, so repeating it
                      down the list said nothing the totals do not say once. Abbreviated here
                      and spelled out in the totals: this row shares its width with the ICE
                      figure, and the totals row has a column to itself. */}
                  {lineDiscount > 0 ? (
                    <ThemedText style={[styles.metaLabel, { color: theme.accent }]}>
                      Desc. −{formatBs(lineDiscount)}
                    </ThemedText>
                  ) : null}
                </View>

                {/* Free goods hang off the line that earned them rather than being collected
                    into one list: the award is per line and the seller has to be able to see
                    which purchase produced it. */}
                <GiftRow
                  line={line}
                  bonification={bonificationOf(result, line.productId)}
                  onChangeGift={() => setGiftLineId(line.productId)}
                />
              </View>
            );
          })
        )}

        {/* Totals — the discount the previous screen sent us to calculate. */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <TotalRow label="ICE" value={formatBs(iceTotal)} />
          <TotalRow label="Pago" value={paymentMethod} />
          <TotalRow label="Subtotal" value={formatBs(totalAmount)} />
          {/* Just "Descuento" and an amount. The reasons behind it carried their own
              percentages, which is exactly what was asked to come out. */}
          {discountAmount > 0 ? (
            <TotalRow label="Descuento" value={`−${formatBs(discountAmount)}`} tone={theme.accent} />
          ) : null}
          {/* No whole-order "Bonificación" row: free goods are per line now and each item card
              carries its own, so a single summary line here told a second, vaguer version of
              the same story. */}
          <View style={[styles.grandTotalRow, { borderTopColor: theme.border }]}>
            <ThemedText type="smallBold" style={styles.grandTotalLabel}>
              Total general
            </ThemedText>
            <ThemedText style={[styles.grandTotalValue, { color: theme.success }]}>
              {formatBs(finalTotal)}
            </ThemedText>
          </View>
        </View>

        <SectionLabel>Cliente y facturación</SectionLabel>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <FieldRow icon="person.fill" label="Cliente" value={client?.name ?? '—'} />
          <FieldRow icon="tag.fill" label="Código" value={client?.code ?? '—'} />
          <FieldRow icon="doc.text" label="NIT" value={details?.nit ?? '—'} />
          <FieldRow icon="person.crop.circle" label="Razón social" value={details?.razonSocial ?? '—'} />
        </View>

        <SectionLabel>Tipo de pedido</SectionLabel>
        <View style={[styles.segment, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {ORDER_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => setOrderType(type)}
              style={[styles.segmentButton, orderType === type ? { backgroundColor: theme.accent } : null]}>
              <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={[
                  styles.segmentText,
                  { color: orderType === type ? theme.onAccent : theme.textSecondary },
                ]}>
                {type}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <SectionLabel>Punto de entrega</SectionLabel>
        {/* One row that opens a searchable sheet: a client can have many points, and
            listing them here would push the rest of the form off screen. */}
        <Pressable
          onPress={() => setPointSheetVisible(true)}
          style={[styles.selectRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Icon name="mappin" size={15} color={theme.accent} />
          <View style={styles.optionTexts}>
            {selectedPoint ? (
              <>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.optionLabel}>
                  {deliveryPointLabel(selectedPoint)}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.metaLabel} numberOfLines={1}>
                  {selectedPoint.address}
                </ThemedText>
              </>
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.optionLabel}>
                Elegir punto de entrega
              </ThemedText>
            )}
          </View>
          <ThemedText themeColor="textSecondary" style={styles.metaLabel}>
            {details?.deliveryPoints.length ?? 0}
          </ThemedText>
          <Icon name="chevron.down" size={13} color={theme.textSecondary} />
        </Pressable>

        <SectionLabel>Persona de contacto</SectionLabel>
        <TextInput
          value={contactValue}
          onChangeText={setContact}
          placeholder="Nombre de quien recibe"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}
        />

        <SectionLabel>Observaciones</SectionLabel>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Instrucciones para la entrega (opcional)"
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[
            styles.input,
            styles.notesInput,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}
        />

        <SectionLabel>Entrega</SectionLabel>
        <View style={[styles.card, styles.deliveryCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {/* The next three days are one tap, because they are almost every order; anything
              further out goes through the calendar. Both feed the same value, so the chip row
              stays highlighted when the calendar happens to land on one of those days. */}
          <View style={styles.deliveryField}>
            <ThemedText themeColor="textSecondary" style={styles.fieldCaption}>
              ¿Qué día se entrega?
            </ThemedText>
            {/* Quick days on the left, calendar on the right — the same shape the tasks form
                uses for an expiry date, so the way to reach a calendar is one thing the seller
                learns once. */}
            <View style={styles.dateRow}>
              <View style={styles.dateChoices}>
                {dateOptions.map((option) => {
                  const active = option.key === deliveryDate;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setDeliveryDate(option.key)}
                      style={[
                        styles.dateChip,
                        {
                          backgroundColor: active ? theme.accent : theme.background,
                          borderColor: active ? theme.accent : theme.border,
                        },
                      ]}>
                      <ThemedText
                        type="smallBold"
                        numberOfLines={1}
                        style={[styles.dateChipText, { color: active ? theme.onAccent : theme.text }]}>
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => setDateSheetVisible(true)}
                style={[
                  styles.dateButton,
                  {
                    backgroundColor: customDate ? theme.accentSoft : theme.background,
                    borderColor: customDate ? theme.accent : theme.border,
                  },
                ]}>
                <Icon name="calendar" size={17} color={theme.accent} />
              </Pressable>
            </View>
            {/* Spelled out underneath whichever way it was picked: "Hoy" is convenient but a
                weekday and a number is what gets repeated back to the client. */}
            <ThemedText type="smallBold" numberOfLines={1} style={styles.deliveryReadback}>
              {deliveryDateLabel(deliveryDate)}
            </ThemedText>
          </View>

          <View style={[styles.deliveryDivider, { borderTopColor: theme.border }]} />

          {/* One row, one sheet. Inside it the usual windows are a chip each and anything else is
              drawn on a timeline, so the row below can be any pair of hours — it always reads back
              as a name and a duration all the same. The caption spells out whose hours these are —
              as two bare "Desde"/"Hasta" chip rows it never said. */}
          <View style={styles.deliveryField}>
            <ThemedText themeColor="textSecondary" style={styles.fieldCaption}>
              ¿En qué horario recibe el cliente?
            </ThemedText>
            <Pressable
              onPress={() => setWindowSheetVisible(true)}
              style={[styles.selectRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Icon name="clock.fill" size={15} color={theme.accent} />
              <View style={styles.optionTexts}>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.optionLabel}>
                  {fromHour} a {toHour}
                </ThemedText>
                <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.metaLabel}>
                  {windowSummary}
                </ThemedText>
              </View>
              <Icon name="chevron.down" size={13} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>

        {offline ? (
          <View style={[styles.notice, { backgroundColor: theme.accentAltSoft }]}>
            <Icon name="wifi.slash" size={14} color={theme.accentAlt} />
            <ThemedText style={[styles.noticeText, { color: theme.accentAlt }]}>
              Sin conexión no se puede confirmar el pedido. Volvé a intentarlo al recuperar la
              señal.
            </ThemedText>
          </View>
        ) : null}

        <Pressable
          disabled={confirmDisabled}
          onPress={confirm}
          style={[
            styles.confirmButton,
            { backgroundColor: theme.success, opacity: confirmDisabled ? 0.4 : 1 },
          ]}>
          <Icon name={editing ? 'checkmark' : 'cart'} size={16} color={theme.onSuccess} />
          <ThemedText type="smallBold" style={{ color: theme.onSuccess }}>
            {editing ? 'Guardar cambios' : 'Confirmar pedido'} · {formatBs(finalTotal)}
          </ThemedText>
        </Pressable>
      </ScrollView>

      <DeliveryPointSheet
        visible={pointSheetVisible}
        onClose={() => setPointSheetVisible(false)}
        points={details?.deliveryPoints ?? []}
        selectedId={selectedPointId}
        onSelect={(point) => setDeliveryPointId(point.id)}
      />

      {/* The same calendar the tasks form uses, so a date is picked the same way everywhere in
          the app. No minimum date: a delivery is always ahead, but the mock clock is not the
          seller's, and blocking today would be the more confusing failure. */}
      <DatePickerDialog
        visible={dateSheetVisible}
        value={fromDateKey(deliveryDate)}
        title="Fecha de entrega"
        onSelect={(date) => setDeliveryDate(toDateKey(date))}
        onClose={() => setDateSheetVisible(false)}
      />

      <DeliveryWindowSheet
        visible={windowSheetVisible}
        onClose={() => setWindowSheetVisible(false)}
        selectedFrom={fromHour}
        selectedTo={toHour}
        onSelect={(window) => {
          setFromHour(window.from);
          setToHour(window.to);
        }}
      />

      {giftBonification ? (
        <GiftProductSheet
          visible
          onClose={() => setGiftLineId(null)}
          options={giftOptionsFor(giftBonification.productId)}
          selectedId={giftBonification.giftProductId}
          onSelect={(product) => chooseGift(giftBonification.productId, product)}
          qtyLabel={`${giftBonification.qty} ${giftBonification.minUnitLabel}`}
        />
      ) : null}
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
      {children}
    </ThemedText>
  );
}

/**
 * The free goods a line earned, or how far it is from earning any.
 *
 * The "not yet" case is shown on purpose rather than left blank: a seller who can see that
 * four more pieces would earn a gift has a reason to go back and sell them, and that is the
 * whole commercial point of showing bonifications before the order is closed.
 */
function GiftRow({
  line,
  bonification,
  onChangeGift,
}: {
  line: CartLine;
  bonification: LineBonification | null;
  onChangeGift: () => void;
}) {
  const theme = useTheme();

  // A line that earned nothing says nothing: the card is a record of what is being ordered,
  // and an absent gift is not a fact about the product.
  if (!bonification) return null;

  return (
    <View style={[styles.giftCard, { backgroundColor: theme.successSoft }]}>
      {/* What arrives, and nothing about which threshold produced it: the seller is closing an
          order, not auditing the rule that fired. */}
      <View style={styles.giftHeader}>
        <Icon name="gift" size={13} color={theme.success} />
        <ThemedText style={[styles.giftQty, { color: theme.success }]} numberOfLines={1}>
          {bonification.qty} {bonification.minUnitLabel} de regalo
        </ThemedText>
      </View>

      {/* Always offered, even for a product with no siblings: what arrives as free goods is a
          decision the seller confirms with the client, so the row has to be openable to be
          read back — a product with one option opens showing that option, already selected,
          which answers "what am I getting?" instead of hiding the answer.

          Labelled with the full product code and description, the same string the catalog
          list shows. Not the flavor: flavor is one attribute of a product, and the thing
          being chosen here is which product the warehouse ships. */}
      <Pressable
        onPress={onChangeGift}
        style={[styles.giftSelect, { backgroundColor: theme.backgroundElement, borderColor: theme.success }]}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.giftProduct}>
          {bonification.giftProductId} - {bonification.giftProductName}
        </ThemedText>
        <Icon name="chevron.down" size={13} color={theme.success} />
      </Pressable>
    </View>
  );
}

/** The gift's substitution options: the ordered product itself, then its flavor siblings. */
function giftOptionsFor(productId: number): Product[] {
  const product = mockProducts.find((candidate) => candidate.id === productId);
  if (!product) return [];
  return [product, ...suggestionsFor(product, mockProducts, 'flavor')];
}


function TotalRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.totalRow}>
      <ThemedText themeColor="textSecondary" style={styles.totalLabel} numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.totalValue, tone ? { color: tone } : null]}>{value}</ThemedText>
    </View>
  );
}

function FieldRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.fieldRow}>
      <Icon name={icon} size={14} color={theme.textSecondary} />
      <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.fieldValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: 6,
  },
  card: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    gap: 3,
  },
  // Gutters the ScrollView's own contentContainer used to provide, now that this card sits
  // outside it.
  pinned: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  clientIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientTexts: {
    flex: 1,
    gap: 1,
  },
  clientName: {
    fontSize: 13,
    // Explicit alongside every reduced font size in the app: `smallBold` carries
    // lineHeight 20, so a smaller font on its own keeps the old row height.
    lineHeight: 17,
  },
  orderMode: {
    fontSize: 11,
    // Was the biggest cost in this card: without a lineHeight, ThemedText's default type
    // applies 24 whatever the fontSize is.
    lineHeight: 15,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  /**
   * An ordered product, marked off from every other card on the screen by the accent bar down
   * its left edge. Without it a line item, the totals block and the billing block were the
   * same rounded rectangle with the same border, and the only way to tell which was which was
   * to read it.
   *
   * The three remaining sides are coloured individually rather than with `borderColor`: that
   * shorthand sets all four, so it would paint over the left edge depending on which style
   * object lands last.
   */
  itemCard: {
    borderRadius: Radius.sm,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 3,
    paddingVertical: 5,
    paddingRight: Spacing.two,
    // The bar eats two points of the gutter, so the text starts where the other cards' does.
    paddingLeft: Spacing.two - 2,
    gap: 1,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemName: {
    flex: 1,
    fontSize: 12,
  },
  itemAmount: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  qtyText: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  metaLabel: {
    fontSize: 10,
  },
  giftCard: {
    marginTop: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    gap: 2,
  },
  giftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  giftQty: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  giftSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  giftProduct: {
    // The chevron keeps its own width at the right edge; the description takes the rest and
    // truncates, since the leading code is what identifies it.
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  giftHint: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    fontStyle: 'italic',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  totalLabel: {
    flex: 1,
    fontSize: 11,
  },
  totalValue: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  grandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingTop: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grandTotalLabel: {
    fontSize: 13,
  },
  grandTotalValue: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  fieldLabel: {
    width: 88,
    fontSize: 11,
  },
  fieldValue: {
    flex: 1,
    fontSize: 12,
    textAlign: 'right',
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
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: ControlHeight.input,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
  },
  optionTexts: {
    flex: 1,
    gap: 1,
  },
  optionLabel: {
    fontSize: 12,
  },
  input: {
    minHeight: ControlHeight.input,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    fontSize: 13,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  deliveryCard: {
    gap: Spacing.two,
  },
  deliveryField: {
    gap: 5,
  },
  // A question, not a noun. "Desde" and "Hasta" were the whole reason the old rows read as
  // hours belonging to nobody.
  fieldCaption: {
    fontSize: 11,
    lineHeight: 15,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dateChoices: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  // Square, and the same side and size as the tasks form's calendar button.
  dateButton: {
    width: ControlHeight.input,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  dateChipText: {
    fontSize: 11,
    lineHeight: 15,
  },
  deliveryReadback: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'capitalize',
  },
  deliveryDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    marginTop: Spacing.two,
  },
  // Same idiom as the order panel's notices, so a blocked action reads the same
  // wherever the seller meets it.
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
});
