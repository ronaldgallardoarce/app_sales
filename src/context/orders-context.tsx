import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { mockOrders, type CancelReason, type PlacedOrder } from '@/data/mock-orders';

interface OrdersContextValue {
  orders: PlacedOrder[];
  /** Store a newly confirmed order. Newest first, like the fixtures. */
  addOrder: (order: PlacedOrder) => void;
  /** Replace a placed order in place, keyed by its number. */
  updateOrder: (order: PlacedOrder) => void;
  /**
   * Withdraw an order, recording why.
   *
   * It stays in the list, marked `anulado`: the office was already told about this order, so the
   * seller's cancellation is another fact about it and not the absence of one. A row that simply
   * vanished would leave the client's history with a gap where a conversation happened, and the
   * reason with nowhere to live.
   */
  annulOrder: (id: number, reason: CancelReason) => void;
  find: (id: string | number | undefined) => PlacedOrder | null;
  /** The number the next order takes. */
  nextOrderId: number;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

/**
 * The highest number the office had issued before this session.
 *
 * Kept as a floor for `nextOrderId` so the sequence carries on from the fixtures even if every
 * order in the list is deleted — numbering is the back office's, and it does not rewind because
 * a seller cleaned up their screen.
 */
const LAST_ISSUED_ID = mockOrders.reduce((highest, order) => Math.max(highest, order.id), 0);

/**
 * The route's placed orders.
 *
 * In a provider rather than in the orders screen's own state because editing one spans three
 * screens: the list starts the edit, the catalog changes the products, and the confirm screen
 * saves. State living in the list would be unmounted by the time the save happened, and passing
 * the order through navigation params is not possible — params are strings and this is an object
 * with a line array inside it.
 */
export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<PlacedOrder[]>(mockOrders);

  const addOrder = useCallback((order: PlacedOrder) => {
    setOrders((prev) => [order, ...prev]);
  }, []);

  const updateOrder = useCallback((order: PlacedOrder) => {
    setOrders((prev) => prev.map((candidate) => (candidate.id === order.id ? order : candidate)));
  }, []);

  const annulOrder = useCallback((id: number, reason: CancelReason) => {
    setOrders((prev) =>
      prev.map((candidate) =>
        candidate.id === id
          ? // Back to unsent, the same way an edit is: what the server holds is no longer what
            // the seller and the client agreed.
            { ...candidate, status: 'anulado', cancelReason: reason, synced: false }
          : candidate,
      ),
    );
  }, []);

  /**
   * Tolerates `undefined` so callers can pass a route param straight through — and a string for
   * the same reason: navigation params arrive as text, and the id they name is a number. Parsing
   * here rather than at every call site keeps the coercion in one place, and anything that is not
   * a number ("", "abc", a param that was never set) finds nothing instead of matching by accident.
   */
  const find = useCallback(
    (id: string | number | undefined) => {
      if (id === undefined) return null;
      // `parseInt` and not `Number`, which turns an empty param into 0 — a real id that could one
      // day exist, and a lookup that would then succeed for a param nobody set.
      const numeric = typeof id === 'number' ? id : Number.parseInt(id, 10);
      if (!Number.isFinite(numeric)) return null;
      return orders.find((order) => order.id === numeric) ?? null;
    },
    [orders],
  );

  const nextOrderId = useMemo(
    () => orders.reduce((highest, order) => Math.max(highest, order.id), LAST_ISSUED_ID) + 1,
    [orders],
  );

  const value = useMemo(
    () => ({ orders, addOrder, updateOrder, annulOrder, find, nextOrderId }),
    [orders, addOrder, updateOrder, annulOrder, find, nextOrderId],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error('useOrders must be used inside OrdersProvider');
  return context;
}
