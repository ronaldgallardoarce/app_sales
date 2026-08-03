import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VisitTimer } from '@/components/client/visit-timer';
import { DeliveryPointSheet } from '@/components/order/delivery-point-sheet';
import { DeliveryWindowSheet } from '@/components/order/delivery-window-sheet';
import { GiftProductSheet } from '@/components/order/gift-product-sheet';
import { DateInputField, formatDateInput, parseDateInput } from '@/components/ui/date-input-field';
import { ThemedText } from '@/components/themed-text';
import { useDialog } from '@/components/ui/dialog';
import { Icon, type IconName } from '@/components/ui/icon';
import { OfflineBadge } from '@/components/ui/offline-badge';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useCart, useCartScope } from '@/context/cart-context';
import { useClientVisits } from '@/context/client-visit-context';
import { useConnectivity } from '@/context/connectivity-context';
import { bonificationOf, useOrderIncentives } from '@/context/order-incentives-context';
import { useOrderSummary } from '@/context/order-summary-context';
import { useOrders } from '@/context/orders-context';
import { orderNumberLabel } from '@/data/mock-orders';
import { type LineBonification } from '@/data/mock-bonifications';
import { mockProducts } from '@/data/mock-catalog';
import { calculateIncentives, PAYMENT_METHODS, type PaymentMethod } from '@/data/mock-incentives';
import {
  deliveryDateLabel,
  deliveryDateOptions,
  deliveryPointLabel,
  DELIVERY_WINDOWS,
  fromDateKey,
  orderDetailsFor,
  toDateKey,
} from '@/data/mock-order-details';
import { type OrderSummaryData } from '@/components/orders/order-summary-document';
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
  const { clients, markOrder, openVisitOf } = useClientVisits();
  const { lines, clearCart, endEdit, totalAmount } = useCart();
  const { offline } = useConnectivity();

  const { clientId, paymentMethod: paymentParam, editOrderId, returnTo } = useLocalSearchParams<{
    clientId?: string;
    paymentMethod?: string;
    /** Set when the catalog was opened to amend a placed order. */
    editOrderId?: string;
    /** Where saving the amended order lands. Defaults to the orders list. */
    returnTo?: string;
  }>();

  /** Same declaration the catalog makes, so a reload straight onto this screen lands right too. */
  useCartScope(editOrderId ? 'edit' : 'draft');

  const { addOrder, updateOrder, find: findOrder, nextOrderId } = useOrders();
  /**
   * The order being amended, or null for a new one. Everything below branches on this rather than
   * on the raw param, so a stale id — an order deleted from another screen while this one sat in
   * the stack — falls back to behaving like a new order instead of saving into nothing.
   */
  const editing = findOrder(editOrderId);

  const client = clients.find((c) => c.id === clientId) ?? null;

  /**
   * Whether this is a remote order, inferred from there being no visit open rather than passed
   * along: an on-site order is placed from inside a visit, a remote one is placed without ever
   * checking in, and both routes reach this screen carrying nothing but the client id.
   *
   * Asked of the open visit and not of the client's history, which is what makes it right on a
   * return: a client visited this morning and phoned in the afternoon is remote for the second
   * order, and presencial again the moment the seller checks in for a third.
   */
  const isRemote = clientId ? openVisitOf(clientId) === null : false;
  const paymentMethod: PaymentMethod =
    PAYMENT_METHODS.find((m) => m === paymentParam) ?? 'Contado';

  const details = useMemo(() => (client ? orderDetailsFor(client) : null), [client]);
  const dateOptions = useMemo(() => deliveryDateOptions(), []);

  /**
   * Seeded from the order when amending one, so the seller lands on what they already agreed and
   * changes only what moved. Lazy initialisers, evaluated once: after that these are the form's
   * own state, and re-deriving them would undo edits on every render.
   */
  const [deliveryPointId, setDeliveryPointId] = useState<string | null>(null);
  const [pointSheetVisible, setPointSheetVisible] = useState(false);
  /** Which line's gift flavor is being chosen — the ordered product's id, or null when closed. */
  const [giftLineId, setGiftLineId] = useState<number | null>(null);
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => editing?.deliveryDate ?? dateOptions[0].key);
  /**
   * The same day as `deliveryDate`, in the shape the typed field speaks: `DD/MM/AAAA`.
   *
   * Two states and not one derived from the other, because a half-typed date is a normal state of
   * that field and `YYYY-MM-DD` has nowhere to put "31/0". This one is what the input shows; the
   * committed `deliveryDate` above only moves once what was typed is a day that exists, so the
   * order can never be carrying a date the seller was still in the middle of writing.
   */
  const [deliveryDateText, setDeliveryDateText] = useState(() =>
    formatDateInput(fromDateKey(editing?.deliveryDate ?? dateOptions[0].key)),
  );
  const [windowSheetVisible, setWindowSheetVisible] = useState(false);
  const [fromHour, setFromHour] = useState<string>(editing?.deliveryFrom ?? DELIVERY_WINDOWS[1].from);
  const [toHour, setToHour] = useState<string>(editing?.deliveryTo ?? DELIVERY_WINDOWS[1].to);
  /**
   * Which half of the form is on screen. Opens on the products, because that is the half the
   * seller arrives holding: they came from the catalog, and "is this the order?" is still the
   * open question — the delivery terms answer one nobody has asked yet.
   */
  const [tab, setTab] = useState<ConfirmTab>('items');
  const scrollRef = useRef<ScrollView>(null);

  /**
   * Both halves share one scroll view, so the offset has to be reset by hand. The products can
   * run several screens and the delivery form is short, so switching without this drops the
   * seller into the middle of the other half — or, when that half is shorter than the offset,
   * wherever the scroll view happens to clamp. Unanimated on purpose: this is not travel across
   * a form, it is a different form arriving.
   */
  const showTab = (next: ConfirmTab) => {
    if (next === tab) return;
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const iceTotal = useMemo(() => iceTotalOf(lines), [lines]);

  /**
   * The pricing service's reply, requested by the cart's "Aplicar descuentos y bonificaciones"
   * button before it navigated here. Falling back to a local calculation rather than showing
   * an error: this screen is also reachable by reload or deep link, where no request was ever
   * made, and a summary with no discount on it would be wrong rather than merely empty.
   */
  const { result, chooseGift, reset: resetIncentives } = useOrderIncentives();
  const { showSummary } = useOrderSummary();
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
   * The order as the document the client is shown. Built from the same figures that `placeOrder`
   * is about to store, so what the seller reads back before confirming is what gets registered —
   * not a second calculation that could disagree with it.
   */
  const summaryData: OrderSummaryData | null = client
    ? {
        title: editing ? `Pedido ${orderNumberLabel(editing.id)}` : 'Resumen del pedido',
        clientCode: client.code,
        clientName: client.name,
        clientPhone: client.phone,
        meta: [
          { label: 'Entrega', value: deliveryDateLabel(deliveryDate) },
          { label: 'Horario', value: `${fromHour} a ${toHour}` },
          { label: 'Pago', value: paymentMethod },
          { label: 'Tipo', value: isRemote ? 'Remoto' : 'Presencial' },
        ],
        lines,
        bonifications: result?.bonifications ?? [],
        subtotal: totalAmount,
        discount: discountAmount,
        ice: iceTotal,
        total: finalTotal,
      }
    : null;

  /** A quick chip: it answers both halves at once, so the typed field reads back what was tapped. */
  const pickDeliveryDate = (key: string) => {
    setDeliveryDate(key);
    setDeliveryDateText(formatDateInput(fromDateKey(key)));
  };

  /**
   * A keystroke in the typed field. The text is kept whatever it says; the order's date only
   * follows once it names a day that exists — until then the last committed one stands, which is
   * what keeps a half-typed "12/0" from blanking the delivery the seller already agreed.
   */
  const typeDeliveryDate = (text: string) => {
    setDeliveryDateText(text);
    const parsed = parseDateInput(text);
    if (parsed) setDeliveryDate(toDateKey(parsed));
  };

  /**
   * Writes the amended order back over the one being edited.
   *
   * `id`, `createdAtMs` and `status` are carried across untouched: this is the same order, and
   * resetting its creation instant would silently hand it a fresh edit window every time it was
   * saved. The amounts are recomputed from the lines as they now stand, because the whole
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
      // Spends the single edit the order gets. Set here and not when the catalog opened, because
      // an edit the seller backed out of never happened: `saveEdit` runs only from the confirm
      // dialog, so the order is only closed once its new lines are actually stored.
      edited: true,
    });
  };

  /**
   * Stores the new order, so it exists everywhere an order is read from: the orders list, and the
   * client's own "ya pidió hoy" card that decides whether a second order is a second order or an
   * amendment of this one. Until this existed, confirming showed a dialog and left no record.
   *
   * Needs a client, and quietly places nothing without one. This screen is reachable by reload
   * with no `clientId`, and an order belonging to nobody is worse in the list than an order the
   * seller has to place again.
   */
  const placeOrder = () => {
    if (!client) return;
    const takenAt = Date.now();
    const bonifications = result?.bonifications ?? [];
    addOrder({
      id: nextOrderId,
      clientId: client.id,
      clientCode: client.code,
      clientName: client.name,
      createdAtMs: takenAt,
      createdAt: toDateKey(new Date(takenAt)),
      deliveryDate,
      deliveryFrom: fromHour,
      deliveryTo: toHour,
      paymentMethod,
      remote: isRemote,
      status: 'confirmado',
      // False the way a real one is: taken on the phone, sent when there is signal.
      synced: false,
      edited: false,
      lines: lines.map((line) => ({ ...line })),
      bonifications,
      bonificationUnits: bonifications.reduce((sum, bonification) => sum + bonification.qty, 0),
      subtotal: totalAmount,
      discount: discountAmount,
      ice: iceTotal,
      total: finalTotal,
    });
  };

  /**
   * Stores the order (or the edit) and leaves the screen.
   *
   * Confirming ends the visit it was taken in. The order is what the seller came to get, so the
   * call is over once it is placed — there is no longer a choice to stay, and nothing else on
   * this screen decides it.
   */
  const settle = () => {
    // Read before anything writes: `markOrder` below closes this very visit, and the
    // destination depends on whether the seller was in one when they confirmed.
    const finishedVisit = !editing && clientId !== undefined && openVisitOf(clientId) !== null;

    if (editing) {
      saveEdit();
    } else {
      placeOrder();
      // Amending an order the client already placed is not a second sale, so it records nothing
      // against the visit. On a remote order there is no open visit and this only records the
      // sale — the close has nothing to close and is harmless.
      if (clientId) markOrder(clientId, { closeVisit: true });
    }

    // Dropped alongside the lines, not after them: the reply is keyed by product code,
    // so a next order containing the same product would otherwise inherit this
    // order's free goods. Both are scoped to the order just saved — a draft the seller
    // had going for another client is in the other bucket and survives this untouched.
    resetIncentives();
    if (editing) endEdit();
    else clearCart();
    /**
     * A finished visit is done with this client, so it lands on the list of the rest of them
     * rather than on the menu of the one just closed.
     *
     * Rebuilt from the root instead of dismissed back to, and that is the whole fix: `dismissTo`
     * only clears the screens above its destination when that destination is already in the
     * stack. When it is not — the seller reached this client through "Clientes" and the map was
     * never opened — React Navigation's POP_TO quietly degrades to replacing the top screen and
     * leaves the rest standing. The catalog and this confirmation survived underneath, so one
     * press of back walked straight into the order that had just been placed.
     *
     * Popping to the root first makes the result the same however the seller got here: home, then
     * the list. Nothing can be left underneath because there is no "underneath" left.
     */
    if (finishedVisit) {
      router.dismissAll();
      router.push('/clients' as Href);
      return;
    }

    /**
     * `dismissTo`, not `replace`: the catalog and this screen are still on the stack behind us,
     * and replacing only swaps the top one — which left the client menu with the catalog
     * underneath it. Safe here in a way it was not above: both destinations are guaranteed to be
     * on the stack, because the catalog is only ever pushed from the client screen, and an edit
     * carries the screen it started from in `returnTo`.
     */
    router.dismissTo(
      editing
        ? ((returnTo ?? '/orders') as Href)
        : clientId
          ? ({
              pathname: '/client/[id]',
              params: {
                id: clientId,
                // A remote order came through the reason picker, and that picker is spent: the
                // client screen is still sitting on it underneath us, so without this the seller
                // lands back on a form offering to start the order they just placed. Remote is
                // in practice the only kind of order that lands here at all now — an on-site one
                // closes its visit above — but the guard stays, so this keeps landing on the
                // client's menu rather than on the picker if that ever stops being true.
                ...(isRemote ? { step: 'menu' } : {}),
              },
            } as Href)
          : ('/map' as Href),
    );
  };

  const confirm = () => {
    /**
     * Whether this confirmation also closes a visit — true for an on-site order and false for the
     * two cases that were never in one: an edit is office work, and a remote order was taken off
     * site. Only used to say so in the message; the action below is the same one either way.
     */
    const closesVisit = !editing && clientId !== undefined && openVisitOf(clientId) !== null;

    dialog.show({
      icon: 'checkmark.circle.fill',
      tone: 'success',
      title: editing ? 'Pedido actualizado' : 'Pedido confirmado',
      message: editing
        ? `Se guardaron los cambios del pedido ${orderNumberLabel(editing.id)}. Nuevo total: ${formatBs(finalTotal)}.`
        : `Se registró el pedido ${orderNumberLabel(nextOrderId)} por ${formatBs(finalTotal)}.${
            // Stated rather than left to be discovered: the visit ends here now, and the seller
            // finds out on the next screen otherwise.
            closesVisit ? ' La visita quedó finalizada.' : ''
          }`,
      // One acknowledgement, no choice: the order closes the call.
      actions: [{ label: 'Listo', variant: 'primary', onPress: settle }],
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
              {editing ? `Editar pedido ${orderNumberLabel(editing.id)}` : 'Confirmar pedido'}
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
        {/* Pinned with the client card and above the scroll, because a switch that scrolls away
            stops being a way back: the point of the split is that either half stays one tap from
            the other, at any depth in either of them. */}
        <ConfirmTabs active={tab} itemCount={lines.length} onChange={showTab} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        // The second half is mostly fields, so a tap that lands while the keyboard is up is far
        // more likely to be aimed at a chip or a sheet than at dismissing it.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        {tab === 'items' ? (
          <>
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
                  {/* Same two rows as the catalog's order panel — what it is and what it costs,
                      then the small print under both — so a line the seller already reviewed
                      there does not rearrange itself on the screen where they confirm it. */}
                  <View style={styles.itemTop}>
                    <ThemedText type="smallBold" numberOfLines={1} style={styles.itemName}>
                      {line.productName}
                    </ThemedText>
                    <ThemedText style={[styles.itemAmount, { color: theme.success }]} numberOfLines={1}>
                      {formatBs(amount - lineDiscount)}
                    </ThemedText>
                  </View>

                  {/* Quantity and ICE share one row and one separator, because they are the same
                      kind of thing — the small print behind the amount above — and each was
                      spending a whole line on a handful of characters. The quantity leads, so a
                      line too narrow for both truncates the tax and not the count: the count is
                      the one the seller reads back to the client. */}
                  <View style={styles.itemFooter}>
                    <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.itemMeta}>
                      {lineQtyDetail(line)} · ICE {formatBs(lineIce(line))}
                    </ThemedText>
                    {/* Money only — the percentage was identical on every line, so repeating it
                        down the list said nothing the totals do not say once. Abbreviated here
                        and spelled out in the totals. */}
                    {lineDiscount > 0 ? (
                      <ThemedText numberOfLines={1} style={[styles.itemDiscount, { color: theme.accent }]}>
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
          </>
        ) : (
          <>
          <SectionLabel>Cliente y facturación</SectionLabel>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <FieldRow icon="person.fill" label="Cliente" value={client?.name ?? '—'} />
            <FieldRow icon="tag.fill" label="Código" value={client?.code ?? '—'} />
            <FieldRow icon="doc.text" label="NIT" value={details?.nit ?? '—'} />
            <FieldRow icon="person.crop.circle" label="Razón social" value={details?.razonSocial ?? '—'} />
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
              {/* Three ways in, in the order they get used. The chips are one tap and cover almost
                  every order; under them the date can be typed outright — eight digits off a
                  delivery plan beat paging a calendar for a day three weeks out — and the calendar
                  button beside the field is the third door, for the seller who would rather look
                  at a month than count days.

                  The typed field is the same `DateInputField` the tasks and returns forms use, so
                  a date is written the same way everywhere in the app: the same mask, the same
                  rejection of `31/02`, the same calendar button on its right. */}
              <View style={styles.dateChoices}>
                {dateOptions.map((option) => {
                  const active = option.key === deliveryDate;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => pickDeliveryDate(option.key)}
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

              {/* No spelled-out weekday underneath any more: the field itself now shows the date
                  in full, and repeating it as prose one line below was the same answer twice. */}
              <DateInputField
                value={deliveryDateText}
                onChange={typeDeliveryDate}
                title="Fecha de entrega"
              />
            </View>

            <View style={[styles.deliveryDivider, { borderTopColor: theme.border }]} />

            {/* One row, one sheet. The row shows the hours themselves and nothing else: the
                window's name and how long it lasts — "Mañana · 4 h" — were a second line
                restating what "08:00 a 12:00" already says, and stacked under the date field
                above they turned the card into four lines of small print. Both still lead the
                chips inside the sheet, which is where choosing actually happens. */}
            <View style={styles.deliveryField}>
              <ThemedText themeColor="textSecondary" style={styles.fieldCaption}>
                ¿En qué horario recibe el cliente?
              </ThemedText>
              <Pressable
                onPress={() => setWindowSheetVisible(true)}
                style={[styles.selectRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Icon name="clock.fill" size={15} color={theme.accent} />
                <ThemedText type="smallBold" numberOfLines={1} style={styles.windowValue}>
                  {fromHour} a {toHour}
                </ThemedText>
                <Icon name="chevron.down" size={13} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>
          </>
        )}
      </ScrollView>

      {/* Pinned rather than left at the end of the second half, and not merely for reach: the
          button carries the total, so parking it inside one tab would hide the amount for as
          long as the seller was reading the other one. Out here it is the one thing on screen
          that holds for the whole order whichever half is showing — which is also why the
          offline notice sits beside it and not in the form: it explains the button, not the
          fields. */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            paddingBottom: insets.bottom + Spacing.two,
          },
        ]}>
        {offline ? (
          <View style={[styles.notice, { backgroundColor: theme.accentAltSoft }]}>
            <Icon name="wifi.slash" size={14} color={theme.accentAlt} />
            <ThemedText style={[styles.noticeText, { color: theme.accentAlt }]}>
              Sin conexión no se puede confirmar el pedido. Volvé a intentarlo al recuperar la
              señal.
            </ThemedText>
          </View>
        ) : null}

        {/**
          * The primary action belongs to the half being read, and confirming is only offered from
          * the second one.
          *
          * Every delivery term has a default — today, 08:00 a 12:00, the client's first point —
          * so the order is technically complete the moment this screen opens, and a confirm
          * button on the products half would let it be sent without those defaults ever having
          * been on screen. The old single column made that impossible by accident: the button sat
          * under the delivery form, so reaching it meant scrolling past it. Splitting the screen
          * removed that accident, and this puts the guarantee back deliberately.
          *
          * It is still not a lock. The tabs stay live, so the seller can jump straight to the
          * second half and confirm from there — what they cannot do is confirm having never
          * looked at it.
          */}
        {/* Reading the order back to the client is the last thing that happens before confirming,
            so the document stays in the footer — but above the action and not beside it.

            As a bare square sharing the row it was two problems at once: a lone `doc.text` glyph
            names nothing, so the only way to learn what it did was to press it and find out; and
            it took a quarter of the row from the one control the seller is actually looking for.
            Now it says what it is, and it is quiet — outlined, a row rather than a button — so the
            filled action underneath it stays the only thing in the footer that reads as the way
            forward. */}
        <Pressable
          disabled={lines.length === 0}
          onPress={() => summaryData && showSummary(summaryData)}
          style={[
            styles.summaryButton,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              opacity: lines.length === 0 ? 0.4 : 1,
            },
          ]}>
          <Icon name="doc.text" size={15} color={theme.accent} />
          <ThemedText
            type="smallBold"
            numberOfLines={1}
            style={[styles.summaryLabel, { color: theme.accent }]}>
            Ver y compartir resumen
          </ThemedText>
          <Icon name="chevron.right" size={13} color={theme.accent} />
        </Pressable>

        {tab === 'items' ? (
          <Pressable
            onPress={() => showTab('details')}
            style={[styles.confirmButton, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Continuar · {formatBs(finalTotal)}
            </ThemedText>
            <Icon name="chevron.right" size={16} color={theme.onAccent} />
          </Pressable>
        ) : (
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
        )}
      </View>

      <DeliveryPointSheet
        visible={pointSheetVisible}
        onClose={() => setPointSheetVisible(false)}
        points={details?.deliveryPoints ?? []}
        selectedId={selectedPointId}
        onSelect={(point) => setDeliveryPointId(point.id)}
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

/** The two halves of this form. */
type ConfirmTab = 'items' | 'details';

const CONFIRM_TABS: readonly { key: ConfirmTab; label: string }[] = [
  { key: 'items', label: 'Productos' },
  // Not "Entrega": this half also carries the client, the order type and the contact, and it
  // holds a section actually called "Entrega" further down, so the tab would be naming a part
  // of its own contents.
  { key: 'details', label: 'Datos del pedido' },
];

/**
 * The switch between what the client is buying and how it reaches them.
 *
 * This screen asks two unrelated questions — "is this the order?" and "when and where does it go?"
 * — and used to stack both into one column. Checking a line against what the client just said
 * meant scrolling up past the whole delivery form, and filling the delivery form meant scrolling
 * past every product to get to it. Splitting them costs one tap and returns a screen where
 * whichever question is being asked is the only thing on it.
 *
 * Tabs and not steps, which is why there is no "Continuar" button anywhere: the seller reads an
 * order back in whatever order the client asks about it, jumping to a product when the price is
 * questioned and back to the hours when the delivery is. A step that had to be finished before
 * the next one unlocked would be modelling a sequence the conversation does not have.
 *
 * Deliberately not the same shape as the "Tipo de pedido" control that lives inside the second
 * half: that one is a filled segment, this one is a soft-backed tile row. Two identical-looking
 * segmented controls on one screen, one of them navigation and the other a field, would be a
 * coin toss every time.
 */
function ConfirmTabs({
  active,
  itemCount,
  onChange,
}: {
  active: ConfirmTab;
  itemCount: number;
  onChange: (tab: ConfirmTab) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.tabRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {CONFIRM_TABS.map((entry) => {
        const isActive = entry.key === active;
        return (
          <Pressable
            key={entry.key}
            onPress={() => onChange(entry.key)}
            style={[styles.tab, isActive ? { backgroundColor: theme.accentSoft } : null]}>
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              style={[styles.tabLabel, { color: isActive ? theme.accent : theme.textSecondary }]}>
              {entry.label}
            </ThemedText>
            {/* Keeps its colour whichever half is showing, the same way the catalog's tiles carry
                theirs: how many lines the order has is a fact about the order, not about the
                selection. */}
            {entry.key === 'items' ? (
              <View style={[styles.tabBadge, { backgroundColor: theme.accent }]}>
                <ThemedText numberOfLines={1} style={[styles.tabBadgeText, { color: theme.onAccent }]}>
                  {itemCount}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
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
    gap: 6,
  },
  /** Explicit, because the footer below is a sibling: without it the scroll view takes its full
      content height and pushes the confirm button off the bottom of the screen. */
  scroll: {
    flex: 1,
  },
  /** The tile row the catalog uses for its categories, in the one place it also reads as
      navigation. Same measurements on purpose — a control the seller already knows. */
  tabRow: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: ControlHeight.segment,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.one,
  },
  tabLabel: {
    flexShrink: 1,
    fontSize: 12,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: Radius.pill,
    paddingHorizontal: 4,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    // Explicit lineHeight and textAlign: without them the glyph sits off-centre in its circle,
    // since the default line box does not match the badge height.
    lineHeight: 18,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  /**
   * Every line of an item card carries an explicit lineHeight, and that is where the card's
   * height actually went.
   *
   * `ThemedText` sets a lineHeight per type and nothing else changes it, so a row that overrode
   * only `fontSize` kept the box of the size it no longer was: the untyped rows here render at
   * 10 and 12 points inside the default type's 24-point line, which is ten to fourteen points of
   * empty space per row, three rows deep, on every line of the order. Naming the lineHeight beside
   * each size is the same thing the gift block below already does.
   */
  itemName: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  itemAmount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  itemMeta: {
    // Takes the row and truncates, so the discount beside it keeps its full width.
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  itemDiscount: {
    flexShrink: 0,
    fontSize: 10,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
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
  dateChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
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
  windowValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
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
  // Deliberately shorter than the action below it: same width, less presence.
  summaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 34,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.two,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
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
