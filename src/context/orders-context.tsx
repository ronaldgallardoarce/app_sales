import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { mockOrders, type PlacedOrder } from '@/data/mock-orders';

interface OrdersContextValue {
  orders: PlacedOrder[];
  /** Replace a placed order in place, keyed by its number. */
  updateOrder: (order: PlacedOrder) => void;
  removeOrder: (id: string) => void;
  find: (id: string | undefined) => PlacedOrder | null;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

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

  const updateOrder = useCallback((order: PlacedOrder) => {
    setOrders((prev) => prev.map((candidate) => (candidate.id === order.id ? order : candidate)));
  }, []);

  const removeOrder = useCallback((id: string) => {
    setOrders((prev) => prev.filter((candidate) => candidate.id !== id));
  }, []);

  /** Tolerates `undefined` so callers can pass a route param straight through. */
  const find = useCallback(
    (id: string | undefined) => orders.find((order) => order.id === id) ?? null,
    [orders],
  );

  const value = useMemo(
    () => ({ orders, updateOrder, removeOrder, find }),
    [orders, updateOrder, removeOrder, find],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error('useOrders must be used inside OrdersProvider');
  return context;
}
