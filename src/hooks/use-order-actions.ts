import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

import { useDialog } from '@/components/ui/dialog';
import { useCart } from '@/context/cart-context';
import { useOrders } from '@/context/orders-context';
import { orderNumberLabel, type PlacedOrder } from '@/data/mock-orders';

/**
 * What can be done to a placed order, from wherever it is being read.
 *
 * A hook and not two copies of these handlers because the order detail sheet is opened from more
 * than one screen — the orders list and the client — and amending an order has to mean the same
 * thing in both: the same cart bucket, the same route, the same warning before a delete. The
 * screens differ only in what they do afterwards, which is what the callbacks are for.
 *
 * Neither action asks for a visit, and neither starts one. Editing an order is office work — the
 * office calls about a number, the seller fixes it from wherever they are standing — so tying it
 * to a check-in would be inventing an on-site call that never happened. The two-hour window is
 * the restriction that applies here, and it is the sheet's to enforce.
 */
export function useOrderActions() {
  const router = useRouter();
  const dialog = useDialog();
  const { beginEdit } = useCart();
  const { removeOrder } = useOrders();

  /**
   * Reopens the order in the catalog with its lines loaded, carrying its number along so the
   * confirm screen saves over it instead of taking a new one.
   *
   * The lines go into the cart's edit bucket, which is why this asks nothing first: an order the
   * seller was half way through building for another client is in the other bucket and is still
   * there, untouched, when the edit ends.
   */
  const startEdit = useCallback(
    (order: PlacedOrder, onStarted?: () => void, returnTo?: string) => {
      // Copied, not handed over: the cart replaces line objects rather than mutating them today,
      // so sharing them would work — but a stored order and a live cart pointing at the same
      // objects is the kind of coupling that turns into a corrupted record the first time that
      // changes.
      beginEdit(order.lines.map((line) => ({ ...line })));
      onStarted?.();
      router.push({
        pathname: '/catalog',
        // Stringified on the way out because that is what a route param is; the confirm screen
        // parses it back through `find`, which is the one place that knows the id is a number.
        params: {
          clientId: order.clientId,
          editOrderId: String(order.id),
          // Where saving or discarding lands. Carried as a param because the two screens that end
          // the edit are pushed on top of whatever started it and cannot see what that was: an
          // edit begun from a client used to finish on the orders list, a screen the seller had
          // not been on.
          ...(returnTo ? { returnTo } : {}),
        },
      } as Href);
    },
    [beginEdit, router],
  );

  const confirmDelete = useCallback(
    (order: PlacedOrder, onDeleted?: () => void) => {
      dialog.show({
        icon: 'trash',
        tone: 'danger',
        title: `¿Eliminar el pedido ${orderNumberLabel(order.id)}?`,
        message: `Se eliminará el pedido de ${order.clientName}. No se puede deshacer.`,
        actions: [
          { label: 'Cancelar', variant: 'outline' },
          {
            label: 'Eliminar',
            variant: 'primary',
            tone: 'danger',
            onPress: () => {
              removeOrder(order.id);
              onDeleted?.();
            },
          },
        ],
      });
    },
    [dialog, removeOrder],
  );

  return { startEdit, confirmDelete };
}
