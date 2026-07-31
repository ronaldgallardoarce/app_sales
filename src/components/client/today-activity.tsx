import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TodayOrders } from '@/components/client/today-orders';
import { VisitHistory } from '@/components/client/visit-history';
import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import type { Visit } from '@/context/client-visit-context';
import type { PlacedOrder } from '@/data/mock-orders';
import { useTheme } from '@/hooks/use-theme';

/**
 * What already happened with this client today, folded into one line.
 *
 * The two lists it stands for — the orders placed and the visits made — are worth having and were
 * worth building: the visit list is what stops a seller coming back for a task that was done at
 * nine in the morning, and the order list is what tells a second order from an amendment of the
 * first. But they are *reference*, and they had been sitting between the client's figures and the
 * buttons that do the work, so on a client with two orders and three visits the seller scrolled
 * past five rows of history to reach "Realizar pedido".
 *
 * So they keep their place in the reading order and lose their place on the screen: the counts stay
 * visible, because knowing there is something to look at is the part that has to be free, and the
 * detail is one tap behind them. Nothing was removed — a client with no history renders nothing at
 * all, which is what the screen looked like before this ever mattered.
 *
 * The visit the seller is inside right now is not counted here, and that is the whole point of the
 * word "already": on a first check-in this used to appear announcing "1 visita", which was the one
 * being made, and told the seller nothing they were not already living. Counting only closed
 * visits means the row shows up exactly when it has something to say — arriving at a client who
 * was worked earlier today.
 */
export function TodayActivity({
  orders,
  visits,
  onOpenOrder,
}: {
  /** Already filtered to today and to this client, by `ordersPlacedToday`. */
  orders: PlacedOrder[];
  /** Today's visits to this client, oldest first — the open one included, and filtered out here. */
  visits: Visit[];
  onOpenOrder: (order: PlacedOrder) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  // A visit with no `endedAt` is the one currently open. History is what closed.
  const pastVisits = visits.filter((visit) => visit.endedAt !== null);

  if (orders.length === 0 && pastVisits.length === 0) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
          Hoy
        </ThemedText>

        {orders.length > 0 ? (
          <Count
            icon="cart"
            value={orders.length}
            label={orders.length === 1 ? 'pedido' : 'pedidos'}
            tone={theme.success}
          />
        ) : null}

        {pastVisits.length > 0 ? (
          <Count
            icon="clock.fill"
            value={pastVisits.length}
            label={pastVisits.length === 1 ? 'visita' : 'visitas'}
            tone={theme.accent}
          />
        ) : null}

        <View style={styles.spacer} />
        <Icon name="chevron.right" size={15} color={theme.textSecondary} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="doc.text" size={22} color={theme.accent} />
            </View>
            <View style={styles.sheetHeaderText}>
              <ThemedText type="smallBold" style={styles.sheetTitle}>
                Actividad de hoy
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Lo que ya pasó con este cliente
              </ThemedText>
            </View>
          </View>

          {orders.length > 0 ? (
            <>
              <Label>{orders.length === 1 ? 'Pedido' : 'Pedidos'}</Label>
              {/* Closes on the way out: the order's own sheet is the next thing to open, and two
                  stacked sheets would leave this one behind the one being read. */}
              <TodayOrders
                orders={orders}
                onOpen={(order) => {
                  setOpen(false);
                  onOpenOrder(order);
                }}
              />
            </>
          ) : null}

          {pastVisits.length > 0 ? (
            <>
              <Label>{pastVisits.length === 1 ? 'Visita' : 'Visitas'}</Label>
              <VisitHistory visits={pastVisits} />
            </>
          ) : null}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

/** One figure and what it counts, e.g. "2 pedidos". */
function Count({
  icon,
  value,
  label,
  tone,
}: {
  icon: 'cart' | 'clock.fill';
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <View style={styles.count}>
      <Icon name={icon} size={13} color={tone} />
      <ThemedText type="smallBold" style={[styles.countValue, { color: tone }]}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.countLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  caption: {
    fontSize: 10,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spacer: {
    flex: 1,
  },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countValue: {
    fontSize: 13,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
  },
  countLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  label: {
    fontSize: 12,
    marginTop: Spacing.two,
    marginBottom: -Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheet: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderText: {
    flex: 1,
    gap: 1,
  },
  sheetTitle: {
    fontSize: 15,
  },
});
