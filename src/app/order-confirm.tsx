import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VisitTimer } from '@/components/client/visit-timer';
import { DeliveryPointSheet } from '@/components/order/delivery-point-sheet';
import { ThemedText } from '@/components/themed-text';
import { useDialog } from '@/components/ui/dialog';
import { Icon, type IconName } from '@/components/ui/icon';
import { OfflineBadge } from '@/components/ui/offline-badge';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { useClientVisits } from '@/context/client-visit-context';
import { useConnectivity } from '@/context/connectivity-context';
import { calculateIncentives, PAYMENT_METHODS, type PaymentMethod } from '@/data/mock-incentives';
import {
  deliveryDateOptions,
  deliveryPointLabel,
  DELIVERY_HOURS,
  orderDetailsFor,
  ORDER_TYPES,
  type OrderType,
} from '@/data/mock-order-details';
import { mockSeller } from '@/data/mock-user';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';
import { iceTotalOf, lineAmount } from '@/utils/order';
import { formatBs } from '@/utils/currency';

export default function OrderConfirmScreen() {
  const theme = useTheme();
  const router = useRouter();
  const dialog = useDialog();
  const insets = useContentInsets();
  const { clients, markOrder } = useClientVisits();
  const { lines, clearCart, totalAmount } = useCart();
  const { offline } = useConnectivity();

  const { clientId, paymentMethod: paymentParam } = useLocalSearchParams<{
    clientId?: string;
    paymentMethod?: string;
  }>();

  const client = clients.find((c) => c.id === clientId) ?? null;
  const paymentMethod: PaymentMethod =
    PAYMENT_METHODS.find((m) => m === paymentParam) ?? 'Contado';

  const details = useMemo(() => (client ? orderDetailsFor(client) : null), [client]);
  const dateOptions = useMemo(() => deliveryDateOptions(), []);

  const [orderType, setOrderType] = useState<OrderType>('Normal');
  const [deliveryPointId, setDeliveryPointId] = useState<string | null>(null);
  const [pointSheetVisible, setPointSheetVisible] = useState(false);
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(dateOptions[0].key);
  const [fromHour, setFromHour] = useState<string>(DELIVERY_HOURS[0]);
  const [toHour, setToHour] = useState<string>(DELIVERY_HOURS[2]);

  const iceTotal = useMemo(() => iceTotalOf(lines), [lines]);
  const incentives = useMemo(
    () => calculateIncentives(paymentMethod, totalAmount),
    [paymentMethod, totalAmount],
  );

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

  /** From/until must describe a window, so keep the end at or after the start. */
  const changeFromHour = (hour: string) => {
    setFromHour(hour);
    if (DELIVERY_HOURS.indexOf(hour) > DELIVERY_HOURS.indexOf(toHour)) {
      setToHour(hour);
    }
  };

  const confirm = () => {
    dialog.show({
      icon: 'checkmark.circle.fill',
      tone: 'success',
      title: 'Pedido confirmado',
      message: `Se registró el pedido por ${formatBs(finalTotal)}.`,
      actions: [
        {
          label: 'Listo',
          variant: 'primary',
          onPress: () => {
            if (clientId) markOrder(clientId);
            clearCart();
            router.replace(
              clientId
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
            <ThemedText type="smallBold" style={styles.headerTitle}>
              Confirmar pedido
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.three }]}>
        {/* Where the order is being taken from — captured with the order. */}
        <View style={[styles.card, styles.locationCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={[styles.locationIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon name="mappin" size={16} color={theme.accent} />
          </View>
          <View style={styles.locationTexts}>
            <ThemedText themeColor="textSecondary" style={styles.metaLabel}>
              Ubicación actual
            </ThemedText>
            <ThemedText type="smallBold" style={styles.coords}>
              {mockSeller.location.lat.toFixed(6)}, {mockSeller.location.lng.toFixed(6)}
            </ThemedText>
          </View>
        </View>

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
                style={[styles.itemCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <View style={styles.itemTop}>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.itemName}>
                    {line.productName}
                  </ThemedText>
                  {line.sizeLabel ? (
                    <View style={[styles.sizePill, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText style={[styles.sizeText, { color: theme.textSecondary }]}>
                        {line.sizeLabel}
                      </ThemedText>
                    </View>
                  ) : null}
                  <ThemedText style={[styles.itemAmount, { color: theme.success }]} numberOfLines={1}>
                    {formatBs(amount - lineDiscount)}
                  </ThemedText>
                </View>

                {/* Each unit type only appears when it was actually ordered. */}
                {line.qtyMax > 0 ? (
                  <QtyRow qty={line.qtyMax} unitLabel={line.maxUnitLabel} unitPrice={line.unitPriceMax} />
                ) : null}
                {line.qtyMin > 0 ? (
                  <QtyRow qty={line.qtyMin} unitLabel={line.minUnitLabel} unitPrice={line.unitPriceMin} />
                ) : null}

                <View style={styles.itemFooter}>
                  <ThemedText themeColor="textSecondary" style={styles.metaLabel}>
                    ICE {formatBs(line.ice)}
                  </ThemedText>
                  {lineDiscount > 0 ? (
                    <ThemedText style={[styles.metaLabel, { color: theme.accent }]}>
                      Desc. {incentives.discountPct}% −{formatBs(lineDiscount)}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {/* Totals — the discount the previous screen sent us to calculate. */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <TotalRow label="Productos" value={String(lines.length)} />
          <TotalRow label="ICE" value={formatBs(iceTotal)} />
          <TotalRow label="Pago" value={paymentMethod} />
          <TotalRow label="Subtotal" value={formatBs(totalAmount)} />
          {incentives.discountPct > 0 ? (
            <TotalRow
              label={`Descuento (${incentives.reasons.join(' · ')})`}
              value={`−${formatBs(discountAmount)}`}
              tone={theme.accent}
            />
          ) : null}
          {incentives.bonification ? (
            <TotalRow label="Bonificación" value={incentives.bonification} tone={theme.success} />
          ) : null}
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
          <ChipPickerRow
            icon="calendar"
            label="Fecha"
            options={dateOptions.map((d) => ({ key: d.key, label: d.label }))}
            selected={deliveryDate}
            onSelect={setDeliveryDate}
          />
          <ChipPickerRow
            icon="clock.fill"
            label="Desde"
            options={DELIVERY_HOURS.map((h) => ({ key: h, label: h }))}
            selected={fromHour}
            onSelect={changeFromHour}
          />
          <ChipPickerRow
            icon="clock.fill"
            label="Hasta"
            options={DELIVERY_HOURS.filter(
              (h) => DELIVERY_HOURS.indexOf(h) >= DELIVERY_HOURS.indexOf(fromHour),
            ).map((h) => ({ key: h, label: h }))}
            selected={toHour}
            onSelect={setToHour}
          />
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
          <Icon name="cart" size={16} color={theme.onSuccess} />
          <ThemedText type="smallBold" style={{ color: theme.onSuccess }}>
            Confirmar pedido · {formatBs(finalTotal)}
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

/** One ordered quantity with the price it was agreed at, so the amount stays verifiable. */
function QtyRow({ qty, unitLabel, unitPrice }: { qty: number; unitLabel: string; unitPrice: number }) {
  return (
    <View style={styles.qtyRow}>
      <ThemedText type="smallBold" style={styles.qtyText}>
        {qty} {unitLabel}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.qtyText}>
        × {formatBs(unitPrice)}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={[styles.qtyText, styles.qtyAmount]}>
        {formatBs(qty * unitPrice)}
      </ThemedText>
    </View>
  );
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

/** Icon + label + a horizontal row of small selectable chips. */
function ChipPickerRow({
  icon,
  label,
  options,
  selected,
  onSelect,
}: {
  icon: IconName;
  label: string;
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.pickerRow}>
      <Icon name={icon} size={13} color={theme.textSecondary} />
      <ThemedText themeColor="textSecondary" style={styles.pickerLabel}>
        {label}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pickerChips}>
        {options.map((option) => {
          const active = option.key === selected;
          return (
            <Pressable
              key={option.key}
              onPress={() => onSelect(option.key)}
              style={[
                styles.pickerChip,
                {
                  backgroundColor: active ? theme.accent : theme.background,
                  borderColor: active ? theme.accent : theme.border,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={[styles.pickerChipText, { color: active ? theme.onAccent : theme.textSecondary }]}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
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
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  locationIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTexts: {
    flex: 1,
    gap: 1,
  },
  coords: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
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
  itemCard: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
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
  sizePill: {
    flexShrink: 0,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  sizeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  itemAmount: {
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
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  metaLabel: {
    fontSize: 10,
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
    gap: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickerLabel: {
    width: 46,
    fontSize: 11,
  },
  pickerChips: {
    gap: 4,
    paddingVertical: 2,
  },
  pickerChip: {
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  pickerChipText: {
    fontSize: 11,
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
