import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon, type IconName } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { deliveryDateLabel } from '@/data/mock-order-details';
// ORDER_STATUS_META goes with the commented-out status pill below.
import {
  canEditOrder,
  editHoursLeft,
  EDIT_WINDOW_HOURS,
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
  onDelete,
}: {
  /** Null keeps the sheet closed; a value opens it on that order. */
  order: PlacedOrder | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  if (!order) return null;

  // const meta = ORDER_STATUS_META[order.status]; // with the status pill below
  // Evaluated on open rather than on a timer: the window is 48 hours wide, so a sheet going
  // stale while the seller reads it is not a case worth a ticking clock.
  const editable = canEditOrder(order);
  const hoursLeft = editHoursLeft(order);

  return (
    <BottomSheet visible onClose={onClose} maxHeight={620}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerTexts}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.id}>
              {order.id}
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
        </View>

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
          <FactRow icon="tag.fill" label="Tipo" value={order.orderType} />
          <FactRow
            icon={order.remote ? 'smartphone' : 'store'}
            label="Modalidad"
            value={order.remote ? 'Pedido remoto' : 'Pedido presencial'}
            tone={order.remote ? theme.violet : undefined}
          />
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

        {/* Editing closes 48 hours after the order was taken. The button stays visible once it
            expires rather than disappearing: a seller who cannot find it does not know whether
            the feature is missing or the window is closed, so it says which. */}
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
              {editable ? 'Editar pedido' : 'Ya no se puede editar'}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={onDelete}
            style={[styles.deleteButton, { backgroundColor: theme.dangerSoft }]}>
            <Icon name="trash" size={15} color={theme.danger} />
          </Pressable>
        </View>

        <ThemedText themeColor="textSecondary" style={styles.editHint}>
          {editable
            ? `Se puede editar por ${hoursLeft} ${hoursLeft === 1 ? 'hora' : 'horas'} más.`
            : `Los pedidos se editan dentro de las ${EDIT_WINDOW_HOURS} horas de creados.`}
        </ThemedText>
      </ScrollView>
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
  // Square and unlabelled beside the wide edit button: destroying the order should not be as
  // easy to hit as amending it, and the trash glyph carries the meaning on its own.
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
