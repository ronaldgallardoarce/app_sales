import { useEffect, useRef } from 'react';

import { useOrders } from '@/context/orders-context';
import { fetchPaymentState } from '@/data/mock-prompt-payment';

/** How often an order still waiting for its factura asks again. */
const POLL_MS = 2000;

/**
 * Fills in the factura number on orders that were collected before it existed.
 *
 * The invoice lands a moment after the money does, which leaves a gap: an order can be registered,
 * paid, and still have no invoice number for a few seconds. Whoever was watching that happen might
 * have walked away — closed the sheet, moved to the next client — and the order would then sit with
 * its factura permanently pending, because the only thing that knew the number had gone.
 *
 * So this is not a screen's job and does not live on one. It is mounted once, above the navigator,
 * and it looks after every such order regardless of where the seller currently is.
 *
 * **This stands in for the sync.** In the real app the invoice arrives with the order refresh that
 * sync already performs, and this component is what that refresh does for the one field that can
 * change after an order is closed. Asking on a timer is the honest stand-in: it is deliberately not
 * the payment stream, which exists for the seconds when the seller is watching a countdown and needs
 * an answer immediately. This is the opposite case — nobody is waiting, and correctness eventually is
 * the whole requirement.
 */
export function PendingInvoiceSync() {
  const { orders, updateOrder } = useOrders();

  /**
   * The current list, reachable from inside the timer without restarting it. Every unrelated change
   * to the orders — a new order elsewhere, an annulment — would otherwise reset the clock on an
   * invoice that was already being waited for.
   */
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  /**
   * Intents that will never produce an invoice: the payment expired, was refused, or belongs to a
   * record the service has never heard of — a fixture, most often. Without this the timer would ask
   * about them every two seconds for the rest of the session and never get a different answer.
   */
  const abandonedRef = useRef<Set<string>>(new Set());

  /**
   * Restarts only when the *set* of waiting orders changes, not whenever the list does. Sorted so the
   * same set never reads as a different one because two orders were stored in another order.
   */
  const pendingKey = orders
    .filter((order) => order.payment && !order.payment.invoiceId)
    .map((order) => order.payment?.intentId ?? '')
    .sort()
    .join('|');

  useEffect(() => {
    if (!pendingKey) return;

    let cancelled = false;

    const tick = async () => {
      const waiting = ordersRef.current.filter(
        (order) =>
          order.payment &&
          !order.payment.invoiceId &&
          !abandonedRef.current.has(order.payment.intentId),
      );

      for (const order of waiting) {
        const intentId = order.payment?.intentId;
        if (!intentId) continue;

        try {
          const snapshot = await fetchPaymentState(intentId);
          if (cancelled) return;

          // Anything other than a completed payment means no invoice is coming for this one.
          if (snapshot.state !== 'paid') {
            abandonedRef.current.add(intentId);
            continue;
          }
          // Paid, invoice still on its way. Asked again on the next tick.
          if (!snapshot.invoiceId) continue;

          // Re-read before writing: the order may have been annulled or amended while this request
          // was in flight, and writing the stale copy back would undo that.
          const current = ordersRef.current.find((candidate) => candidate.id === order.id);
          if (!current?.payment || current.payment.invoiceId) continue;

          updateOrder({
            ...current,
            payment: { ...current.payment, invoiceId: snapshot.invoiceId },
          });
        } catch {
          // No answer. Nothing is written, nothing is concluded, and the next tick asks again.
        }
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pendingKey, updateOrder]);

  return null;
}
