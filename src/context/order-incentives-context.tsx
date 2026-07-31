import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useCart, type CartScope } from '@/context/cart-context';
import {
  fetchOrderIncentives,
  giftOfProduct,
  type LineBonification,
  type OrderIncentives,
} from '@/data/mock-bonifications';
import type { PaymentMethod } from '@/data/mock-incentives';
import type { CartLine, Product } from '@/types/catalog';

type RequestStatus = 'idle' | 'loading' | 'ready';

/** What the service said about one order, and whether it has said it yet. */
type Reply = { status: RequestStatus; result: OrderIncentives | null };

const NO_REPLY: Reply = { status: 'idle', result: null };

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
 *
 * One reply per cart scope, following the cart: the discounts and free goods belong to a set of
 * lines, so keeping the two orders' lines apart and letting them share one reply would just move
 * the collision — an edit priced and saved would have wiped the gifts the seller had already
 * chosen on the order they were still building.
 */
export function OrderIncentivesProvider({ children }: { children: ReactNode }) {
  const { scope } = useCart();
  const [replies, setReplies] = useState<Record<CartScope, Reply>>({
    draft: NO_REPLY,
    edit: NO_REPLY,
  });

  const { status, result } = replies[scope];

  const request = useCallback(
    async (lines: CartLine[], paymentMethod: PaymentMethod, subtotal: number) => {
      setReplies((prev) => ({ ...prev, [scope]: { ...prev[scope], status: 'loading' } }));
      try {
        const reply = await fetchOrderIncentives(lines, paymentMethod, subtotal);
        setReplies((prev) => ({ ...prev, [scope]: { status: 'ready', result: reply } }));
        return true;
      } catch {
        // Back to idle, not stuck in loading. Without this a rejected request left the status at
        // 'loading' forever, and the button that reads it stayed disabled — one failed call and
        // the cart could no longer be sent at all. The mock never rejects; the real service will.
        setReplies((prev) => ({ ...prev, [scope]: { ...prev[scope], status: 'idle' } }));
        return false;
      }
    },
    [scope],
  );

  /**
   * Replaces the gift's product identity in place. Keyed by the *ordered* line rather than by
   * the gift, because the gift's own id is the thing being changed and would stop matching.
   */
  const chooseGift = useCallback(
    (productId: number, product: Product) => {
      setReplies((prev) => {
        const current = prev[scope].result;
        if (current === null) return prev;
        return {
          ...prev,
          [scope]: {
            ...prev[scope],
            result: {
              ...current,
              bonifications: current.bonifications.map((bonification) =>
                bonification.productId === productId
                  ? giftOfProduct(bonification, product)
                  : bonification,
              ),
            },
          },
        };
      });
    },
    [scope],
  );

  const reset = useCallback(
    () => setReplies((prev) => ({ ...prev, [scope]: NO_REPLY })),
    [scope],
  );

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
