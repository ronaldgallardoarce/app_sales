import { useRouter, type Href } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { OrderSummaryData } from '@/components/orders/order-summary-document';

type OrderSummaryContextValue = {
  /** What the summary screen is currently showing, or null if it was never opened. */
  data: OrderSummaryData | null;
  /** Hands the screen a document and navigates to it. */
  showSummary: (data: OrderSummaryData) => void;
};

const OrderSummaryContext = createContext<OrderSummaryContextValue | null>(null);

/**
 * Carries the summary document from whoever opened it to the screen that shows it.
 *
 * The summary is a screen and not a sheet, so it is reached by navigating — and a document this
 * shape (lines, bonifications, four money figures) does not fit through route params, which are
 * strings. It could be rebuilt on the other side from an order id, except that the confirm screen
 * opens the summary on an order that has not been placed and therefore has no id yet. One holder
 * that takes the object as it already exists serves both callers without either of them having to
 * serialise anything.
 *
 * The payload deliberately outlives the visit to the screen: clearing it on the way back would
 * empty the document mid-animation, and the next `showSummary` replaces it anyway.
 */
export function OrderSummaryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<OrderSummaryData | null>(null);

  const showSummary = useCallback(
    (next: OrderSummaryData) => {
      setData(next);
      router.push('/order-summary' as Href);
    },
    [router],
  );

  const value = useMemo(() => ({ data, showSummary }), [data, showSummary]);

  return <OrderSummaryContext.Provider value={value}>{children}</OrderSummaryContext.Provider>;
}

export function useOrderSummary(): OrderSummaryContextValue {
  const context = useContext(OrderSummaryContext);
  if (!context) throw new Error('useOrderSummary must be used within an OrderSummaryProvider');
  return context;
}
