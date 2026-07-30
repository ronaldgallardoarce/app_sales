import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrderCard } from '@/components/orders/order-card';
import { OrderDetailSheet } from '@/components/orders/order-detail-sheet';
import { ThemedText } from '@/components/themed-text';
import { DatePickerDialog } from '@/components/ui/date-picker';
import { useDialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { OfflineBadge } from '@/components/ui/offline-badge';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { useOrders } from '@/context/orders-context';
import { fromDateKey, toDateKey } from '@/data/mock-order-details';
import { type PlacedOrder } from '@/data/mock-orders';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';
import { formatBs } from '@/utils/currency';
import {
  DEFAULT_ORDER_FILTERS,
  filterOrders,
  PERIOD_CHIP_LABELS,
  shortDateLabel,
  summariseOrders,
  type OrderFilters,
  type PeriodKey,
} from '@/utils/order-filters';

const PERIODS: PeriodKey[] = ['hoy', '7', '30', 'rango'];

/**
 * Every order this route has placed.
 *
 * Built around one question — what happened, and when — so the period is the only filter given
 * permanent space, spelled out in a button the seller reads without opening anything. Status and
 * a custom range live one tap deeper in a sheet, because they are the follow-up questions, and
 * controls stacked across the top would spend on filters the height that should show orders.
 *
 * The search box stays out here beside it: arriving with an order number from the office, or a
 * client's name from the client themself, is how most visits to this screen start.
 */
export default function OrdersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const dialog = useDialog();
  const insets = useContentInsets();

  const [filters, setFilters] = useState<OrderFilters>(DEFAULT_ORDER_FILTERS);
  /** Which end of the custom range the calendar is open for. */
  const [editingEnd, setEditingEnd] = useState<'from' | 'to' | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const { orders: allOrders, removeOrder } = useOrders();
  const { lines: cartLines, upsertLines, clearCart } = useCart();

  const orders = useMemo(() => filterOrders(allOrders, filters), [allOrders, filters]);
  const summary = useMemo(() => summariseOrders(orders), [orders]);
  /**
   * Looked up by id every render instead of holding the order object itself, so the open sheet
   * follows the list: an order edited or removed underneath it cannot leave a stale copy on
   * screen.
   */
  const openOrder = useMemo(
    () => allOrders.find((order) => order.id === openOrderId) ?? null,
    [allOrders, openOrderId],
  );

  const confirmDelete = (order: PlacedOrder) => {
    dialog.show({
      icon: 'trash',
      tone: 'danger',
      title: `¿Eliminar ${order.id}?`,
      message: `Se eliminará el pedido de ${order.clientName}. No se puede deshacer.`,
      actions: [
        { label: 'Cancelar', variant: 'outline' },
        {
          label: 'Eliminar',
          variant: 'primary',
          tone: 'danger',
          onPress: () => {
            removeOrder(order.id);
            // Closes the sheet as well: it was showing the order that just stopped existing.
            setOpenOrderId(null);
          },
        },
      ],
    });
  };

  /**
   * Reopens the order in the catalog with its lines loaded, carrying its number along so the
   * confirm screen saves over it instead of taking a new one.
   *
   * The cart is emptied first: it holds one order at a time, and `upsertLines` merges by product
   * code, so anything already in there would silently become part of the order being edited.
   */
  const openForEdit = (order: PlacedOrder) => {
    clearCart();
    // Copied, not handed over: the cart replaces line objects rather than mutating them today, so
    // sharing them would work — but a stored order and a live cart pointing at the same objects is
    // the kind of coupling that turns into a corrupted record the first time that changes.
    upsertLines(order.lines.map((line) => ({ ...line })));
    setOpenOrderId(null);
    router.push({
      pathname: '/catalog',
      params: { clientId: order.clientId, editOrderId: order.id },
    } as Href);
  };

  /**
   * Starting an edit destroys whatever is in the cart, and the seller may have been half way
   * through a different order. Asks before doing it, and only then — a warning on an empty cart
   * is a warning about nothing.
   */
  const startEdit = (order: PlacedOrder) => {
    if (cartLines.length === 0) {
      openForEdit(order);
      return;
    }
    dialog.show({
      icon: 'pencil',
      tone: 'accentAlt',
      title: '¿Descartar el pedido en curso?',
      message: `Tenés ${cartLines.length} ${
        cartLines.length === 1 ? 'producto' : 'productos'
      } sin confirmar. Editar ${order.id} va a reemplazarlos.`,
      actions: [
        { label: 'Cancelar', variant: 'outline' },
        {
          label: `Editar ${order.id}`,
          variant: 'primary',
          tone: 'accentAlt',
          onPress: () => openForEdit(order),
        },
      ],
    });
  };

  const selectPeriod = (period: PeriodKey) => {
    // Entering the range seeds both ends with today, so the calendar opens somewhere real and the
    // range is never half-defined while the seller is looking at it.
    if (period === 'rango') {
      const today = toDateKey(new Date());
      setFilters((prev) => ({ ...prev, period, from: prev.from ?? today, to: prev.to ?? today }));
      return;
    }
    setFilters((prev) => ({ ...prev, period }));
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable
            hitSlop={8}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="chevron.left" size={18} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold" style={styles.headerTitle} numberOfLines={1}>
            Pedidos
          </ThemedText>
          <OfflineBadge />
        </View>
      </SafeAreaView>

      <View style={styles.controls}>
        <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Icon name="magnifyingglass" size={15} color={theme.textSecondary} />
          <TextInput
            value={filters.query}
            onChangeText={(query) => setFilters((prev) => ({ ...prev, query }))}
            placeholder="Buscar por N° o cliente"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {filters.query.length > 0 ? (
            <Pressable hitSlop={8} onPress={() => setFilters((prev) => ({ ...prev, query: '' }))}>
              <Icon name="xmark" size={13} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {/* Periods on the surface rather than behind a sheet. Five short options fit one row, and
            a filter you can see the state of without opening anything is one less thing to
            remember — the sheet was making the seller tap twice to learn what they were looking
            at. */}
        <View style={styles.periodRow}>
          {PERIODS.map((period) => {
            const active = filters.period === period;
            return (
              <Pressable
                key={period}
                onPress={() => selectPeriod(period)}
                style={[
                  styles.periodChip,
                  {
                    backgroundColor: active ? theme.accent : theme.backgroundElement,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}>
                {period === 'rango' ? (
                  <Icon name="calendar" size={12} color={active ? theme.onAccent : theme.accent} />
                ) : null}
                <ThemedText
                  type="smallBold"
                  numberOfLines={1}
                  style={[styles.periodChipText, { color: active ? theme.onAccent : theme.text }]}>
                  {PERIOD_CHIP_LABELS[period]}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* The two ends appear only while the range is the chosen period — sitting there greyed
            out under the presets, they would imply the presets feed them. */}
        {filters.period === 'rango' ? (
          <View style={styles.rangeRow}>
            <RangeEnd caption="Desde" value={filters.from} onPress={() => setEditingEnd('from')} />
            <RangeEnd caption="Hasta" value={filters.to} onPress={() => setEditingEnd('to')} />
          </View>
        ) : null}

        {/* Status filter removed from view for now, by request, along with the status pills it
            filtered on. `filterOrders` still honours `filters.status`, so restoring this is a
            matter of putting a chip row back here.

        <View style={styles.periodRow}>
          {([null, 'confirmado', 'entregado', 'borrador', 'anulado'] as (OrderStatus | null)[]).map(
            (status) => { ... }
          )}
        </View>
        */}
      </View>

      {/* What the filtered set adds up to. Few figures on purpose: a count answers "did the filter
          do anything", the amount is the one number a seller gets asked for, and the pending-sync
          tile only exists when there is something pending. */}
      <View style={styles.summaryRow}>
        <SummaryTile label={summary.count === 1 ? 'Pedido' : 'Pedidos'} value={String(summary.count)} />
        <SummaryTile label="Monto total" value={formatBs(summary.total)} tone={theme.success} />
        <SummaryTile label="Promedio" value={formatBs(summary.average)} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        renderItem={({ item }) => <OrderCard order={item} onPress={() => setOpenOrderId(item.id)} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.three }]}
        showsVerticalScrollIndicator={false}
        // No `getItemLayout`: a row's height varies with how many badges it carries, so a fixed
        // estimate would put the scroll position out of step with the content.
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSelected }]}>
              <Icon name="clipboard" size={22} color={theme.textSecondary} />
            </View>
            <ThemedText type="smallBold" style={styles.emptyTitle}>
              Sin pedidos en este período
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              Probá ampliar las fechas o limpiar los filtros.
            </ThemedText>
          </View>
        }
      />

      {/* The app's own calendar, so a date is chosen the same way here as on the order form. */}
      <DatePickerDialog
        visible={editingEnd !== null}
        value={
          editingEnd === null
            ? null
            : fromDateKey((editingEnd === 'from' ? filters.from : filters.to) ?? toDateKey(new Date()))
        }
        title={editingEnd === 'from' ? 'Desde' : 'Hasta'}
        onSelect={(date) => {
          const key = toDateKey(date);
          setFilters((prev) => ({
            ...prev,
            period: 'rango',
            ...(editingEnd === 'from' ? { from: key } : { to: key }),
          }));
        }}
        onClose={() => setEditingEnd(null)}
      />

      <OrderDetailSheet
        order={openOrder}
        onClose={() => setOpenOrderId(null)}
        onEdit={() => openOrder && startEdit(openOrder)}
        onDelete={() => openOrder && confirmDelete(openOrder)}
      />
    </View>
  );
}

/** One end of the custom range: what it is, and the date it currently holds. */
function RangeEnd({
  caption,
  value,
  onPress,
}: {
  caption: string;
  value: string | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.rangeEnd, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Icon name="calendar" size={14} color={theme.accent} />
      <View style={styles.rangeTexts}>
        <ThemedText themeColor="textSecondary" style={styles.rangeCaption}>
          {caption}
        </ThemedText>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.rangeValue}>
          {value ? shortDateLabel(value) : '—'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** One figure from the filtered set. */
function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.summaryTile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.summaryLabel}>
        {label}
      </ThemedText>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={[styles.summaryValue, tone ? { color: tone } : null]}>
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
  },
  controls: {
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  periodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  periodChipText: {
    fontSize: 11,
    lineHeight: 15,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rangeEnd: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  rangeTexts: {
    flex: 1,
  },
  rangeCaption: {
    fontSize: 9,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rangeValue: {
    fontSize: 12,
    lineHeight: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  summaryTile: {
    flex: 1,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 9,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryValue: {
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: 6,
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.six,
    gap: 4,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
