import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
// ORDER_STATUS_META is imported by the detail sheet and the filter chips; the commented-out
// status pill below is the only thing this file needed it for.
import { orderNumberLabel, type PlacedOrder } from '@/data/mock-orders';
import { useTheme } from '@/hooks/use-theme';
import { formatBs } from '@/utils/currency';
import { shortDateLabel } from '@/utils/order-filters';

/**
 * One placed order as a list row.
 *
 * Ordered top to bottom by what the seller is looking for: the order number they were given,
 * the client it belongs to, then the money. Everything below that line is context — when it
 * arrives, and the handful of flags that make this order not routine.
 *
 * The exceptions get badges and the ordinary case gets none. A row with nothing at the bottom is
 * a normal, synced, on-site order, so the badges only ever appear on the rows that need reading
 * twice — which is what makes them worth noticing at all.
 */
export function OrderCard({ order, onPress }: { order: PlacedOrder; onPress: () => void }) {
  const theme = useTheme();
  // const meta = ORDER_STATUS_META[order.status]; // with the status pill above
  const productCount = order.lines.length;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.id}>
          {orderNumberLabel(order.id)}
        </ThemedText>
        {/* Status pill hidden for now, by request — kept rather than deleted because the status
            itself still drives the detail sheet and the filter chips, so this is a display
            decision that may be reversed. Restore by uncommenting.
        <View style={[styles.statusPill, { backgroundColor: theme[meta.soft] }]}>
          <ThemedText style={[styles.statusText, { color: theme[meta.color] }]} numberOfLines={1}>
            {meta.label}
          </ThemedText>
        </View>
        */}
      </View>

      <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.client}>
        {order.clientCode}-{order.clientName}
      </ThemedText>

      <View style={styles.moneyRow}>
        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.metaText}>
          {shortDateLabel(order.createdAt)} · {productCount}{' '}
          {productCount === 1 ? 'producto' : 'productos'}
        </ThemedText>
        <ThemedText style={[styles.total, { color: theme.success }]} numberOfLines={1}>
          {formatBs(order.total)}
        </ThemedText>
      </View>

      <View style={styles.deliveryRow}>
        <Icon name="shippingbox.fill" size={12} color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.metaText}>
          Entrega {shortDateLabel(order.deliveryDate)} · {order.deliveryFrom} a {order.deliveryTo}
        </ThemedText>
      </View>

      {order.remote || order.bonificationUnits > 0 ? (
        <View style={styles.badgeRow}>
          {/* Sync badge hidden for now, by request. The flag is still on the order and still
              drives the detail sheet's notice. Restore by uncommenting.
          {!order.synced ? (
            <Badge icon="sync" label="Por sincronizar" color={theme.accentAlt} soft={theme.accentAltSoft} />
          ) : null}
          */}
          {order.remote ? (
            <Badge icon="smartphone" label="Remoto" color={theme.violet} soft={theme.violetSoft} />
          ) : null}
          {order.bonificationUnits > 0 ? (
            <Badge
              icon="gift"
              label={`${order.bonificationUnits} de regalo`}
              color={theme.success}
              soft={theme.successSoft}
            />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function Badge({
  icon,
  label,
  color,
  soft,
}: {
  icon: 'sync' | 'smartphone' | 'gift';
  label: string;
  color: string;
  soft: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: soft }]}>
      <Icon name={icon} size={10} color={color} />
      <ThemedText style={[styles.badgeText, { color }]} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 7,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  id: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  statusPill: {
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  statusText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  client: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: 2,
  },
  metaText: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 14,
  },
  total: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
});
