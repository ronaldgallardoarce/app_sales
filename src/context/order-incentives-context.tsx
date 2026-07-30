import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  fetchOrderIncentives,
  giftOfProduct,
  type LineBonification,
  type OrderIncentives,
} from '@/data/mock-bonifications';
import type { PaymentMethod } from '@/data/mock-incentives';
import type { CartLine, Product } from '@/types/catalog';

type RequestStatus = 'idle' | 'loading' | 'ready';

interface OrderIncentivesContextValue {
  status: RequestStatus;
  /** The resolved reply, or null until the first request lands. */
  result: OrderIncentives | null;
  /**
   * Ask the pricing service to resolve this order. Resolves when the reply is in, so the caller
   * can wait before navigating — the summary screen is only worth opening once there is something
   * to summarise. Resolves `false` if the call failed, in which case nothing was stored and the
   * caller should stay put and say so.
   */
  request: (
    lines: CartLine[],
    paymentMethod: PaymentMethod,
    subtotal: number,
  ) => Promise<boolean>;
  /** Redirect one line's free goods to a sibling product — the variant the client asked for. */
  chooseGift: (productId: number, product: Product) => void;
  /** Drop the reply — the order it described is gone. */
  reset: () => void;
}

const OrderIncentivesContext = createContext<OrderIncentivesContextValue | null>(null);

/**
 * Holds what the pricing service replied for the order being built.
 *
 * Kept in a provider rather than in either screen because it spans both: the cart is where
 * the request is made, and the summary is where the reply is read and edited. Passing it
 * through navigation params was the alternative, and route params are strings — the reply is
 * a list of objects the seller then modifies.
 */
export function OrderIncentivesProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [result, setResult] = useState<OrderIncentives | null>(null);

  const request = useCallback(
    async (lines: CartLine[], paymentMethod: PaymentMethod, subtotal: number) => {
      setStatus('loading');
      try {
        const reply = await fetchOrderIncentives(lines, paymentMethod, subtotal);
        setResult(reply);
        setStatus('ready');
        return true;
      } catch {
        // Back to idle, not stuck in loading. Without this a rejected request left the status at
        // 'loading' forever, and the button that reads it stayed disabled — one failed call and
        // the cart could no longer be sent at all. The mock never rejects; the real service will.
        setStatus('idle');
        return false;
      }
    },
    [],
  );

  /**
   * Replaces the gift's product identity in place. Keyed by the *ordered* line rather than by
   * the gift, because the gift's own id is the thing being changed and would stop matching.
   */
  const chooseGift = useCallback((productId: number, product: Product) => {
    setResult((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            bonifications: prev.bonifications.map((bonification) =>
              bonification.productId === productId ? giftOfProduct(bonification, product) : bonification,
            ),
          },
    );
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setStatus('idle');
  }, []);

  const value = useMemo(
    () => ({ status, result, request, chooseGift, reset }),
    [status, result, request, chooseGift, reset],
  );

  return <OrderIncentivesContext.Provider value={value}>{children}</OrderIncentivesContext.Provider>;
}

export function useOrderIncentives() {
  const context = useContext(OrderIncentivesContext);
  if (!context) throw new Error('useOrderIncentives must be used inside OrderIncentivesProvider');
  return context;
}

/** The award for one line, or null when that line earned nothing. */
export function bonificationOf(
  result: OrderIncentives | null,
  productId: number,
): LineBonification | null {
  return result?.bonifications.find((bonification) => bonification.productId === productId) ?? null;
}
