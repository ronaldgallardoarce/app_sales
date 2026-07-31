import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ChipPadding, Radius, Spacing } from '@/constants/theme';
import { toDateKey } from '@/data/mock-order-details';
import { canEditOrder, orderNumberLabel, type PlacedOrder } from '@/data/mock-orders';
import { useTheme } from '@/hooks/use-theme';
import { formatBs } from '@/utils/currency';

/** The hour an order was taken, e.g. "09:24". */
function clockLabel(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * This client's orders from today, newest first — the one most likely to still be inside its edit
 * window is the one the seller is asking about.
 *
 * Exported because the screen needs the same list to decide whether the section exists at all,
 * and two copies of "which orders count as today's" is the kind of duplicate that drifts.
 */
export function ordersPlacedToday(orders: PlacedOrder[], clientId: string): PlacedOrder[] {
  const today = toDateKey(new Date());
  return orders
    .filter((order) => order.clientId === clientId && order.createdAt === today)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/**
 * What this client has already ordered today.
 *
 * The answer to "ya le vendí hoy, ¿hago otro pedido o corrijo el que hice?" — and it answers it by
 * showing rather than asking. A second order is always a second order: it is a separate document
 * with its own number, and the office may already be picking the first one. So the big button on
 * the screen still takes a new order, and the legitimate case for changing the earlier one —
 * forgot two boxes, ten minutes ago — lives here, where the seller can see which order they would
 * be touching before touching it.
 *
 * Every row opens the same detail sheet the orders list opens, which is where the two-hour rule is
 * enforced and explained. Reachable without a visit and without starting one: the office calls
 * about a number, not about a doorway.
 */
export function TodayOrders({
  orders,
  onOpen,
}: {
  /** Already filtered to today and to this client, by `ordersPlacedToday`. */
  orders: PlacedOrder[];
  onOpen: (order: PlacedOrder) => void;
}) {
  const theme = useTheme();

  if (orders.length === 0) return null;

  return (
    <View style={styles.list}>
      {orders.map((order) => {
        const editable = canEditOrder(order);
        return (
          <Pressable
            key={order.id}
            onPress={() => onOpen(order)}
            style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="clipboard" size={15} color={theme.accent} />
            </View>

            <View style={styles.texts}>
              <ThemedText type="smallBold" numberOfLines={1} style={styles.number}>
                {orderNumberLabel(order.id)}
              </ThemedText>
              <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.meta}>
                {clockLabel(order.createdAtMs)} · {order.lines.length}{' '}
                {order.lines.length === 1 ? 'producto' : 'productos'}
              </ThemedText>
            </View>

            <ThemedText numberOfLines={1} style={[styles.amount, { color: theme.success }]}>
              {formatBs(order.total)}
            </ThemedText>

            {/* Says which of the two this tap is worth before it is spent: inside the window the
                order can still be changed, outside it there is only reading it back. */}
            <View
              style={[
                styles.actionChip,
                { backgroundColor: editable ? theme.accentAltSoft : theme.backgroundSelected },
              ]}>
              <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={[
                  styles.actionText,
                  { color: editable ? theme.accentAlt : theme.textSecondary },
                ]}>
                {editable ? 'Editar' : 'Ver'}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 1,
  },
  number: {
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontSize: 10,
    lineHeight: 14,
  },
  amount: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionChip: {
    flexShrink: 0,
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  actionText: {
    fontSize: 10,
    lineHeight: 14,
  },
});
