import type { CartLine, Product } from '@/types/catalog';
import { calculateIncentives, type Incentives, type PaymentMethod } from '@/data/mock-incentives';
import { lineMinUnits } from '@/utils/order';

/**
 * A free-goods award attached to one ordered line.
 *
 * The gift is the same product by default, because that is what the rules grant: buy enough
 * of a thing and you are given more of that thing. What the seller may change is which
 * sibling row arrives — the client picks a variant, and the warehouse ships that instead. So
 * the gift carries its own product identity, separate from the line's.
 *
 * Only the id and the description are held, no flavor field: flavor is an attribute of a
 * product, not of an award, and the description already contains it. Storing it twice would
 * mean it could disagree with the product it came from.
 */
export type LineBonification = {
  /** The ordered line this was awarded for. */
  productId: number;
  /** The product actually being given — starts as `productId`, swappable for a sibling. */
  giftProductId: number;
  giftProductName: string;
  /**
   * How much is free, always counted in minimum units. Free goods are never granted by the
   * case, so there is no unit code to carry alongside this — `minUnitLabel` is only the word
   * to print next to it.
   */
  qty: number;
  minUnitLabel: string;
};

/**
 * Quantity thresholds, richest first so the first match wins.
 *
 * Measured in minimum units via `lineMinUnits`, not in cases: a line of two cases and a line
 * of the same amount bought loose earned the same money, so they have to earn the same award.
 * These numbers are a stand-in — the real ladder is per product line and lives in the
 * backend, which is the whole reason this is resolved by a request rather than in the app.
 */
const BONIFICATION_TIERS = [
  { minUnits: 120, giftQty: 12 },
  { minUnits: 60, giftQty: 6 },
  { minUnits: 24, giftQty: 2 },
] as const;

/** The award this line qualifies for, or null when it does not reach the first threshold. */
export function bonificationFor(line: CartLine): LineBonification | null {
  const units = lineMinUnits(line);
  const tier = BONIFICATION_TIERS.find((candidate) => units >= candidate.minUnits);
  if (!tier) return null;

  return {
    productId: line.productId,
    giftProductId: line.productId,
    giftProductName: line.productName,
    qty: tier.giftQty,
    minUnitLabel: line.minUnitLabel,
  };
}

/**
 * The same award redirected to a sibling product — what choosing from the picker produces.
 * The quantity is untouched: the seller is changing what arrives, never how much of it.
 */
export function giftOfProduct(bonification: LineBonification, product: Product): LineBonification {
  return {
    ...bonification,
    giftProductId: product.id,
    giftProductName: product.name,
  };
}

/** Everything the order summary needs the backend to resolve, in one reply. */
export type OrderIncentives = {
  incentives: Incentives;
  bonifications: LineBonification[];
};

/**
 * How long the fake round trip takes. Long enough to be visibly a wait — the seller has to
 * learn that this step costs something and is not a local calculation — and short enough not
 * to feel broken.
 */
const SIMULATED_LATENCY_MS = 1100;

/**
 * Stands in for the pricing service the "Aplicar descuentos y bonificaciones" button will
 * really call.
 *
 * Deliberately asynchronous even though every rule here is synchronous and local: discounts
 * and free goods are the backend's answer, not the app's, and building the screen against a
 * promise now is what keeps the wiring honest when the real endpoint replaces this. Both
 * halves come back together because the service resolves them together — the discount
 * depends on the subtotal, and the bonifications on the same lines that produced it.
 */
export function fetchOrderIncentives(
  lines: CartLine[],
  paymentMethod: PaymentMethod,
  subtotal: number,
): Promise<OrderIncentives> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        incentives: calculateIncentives(paymentMethod, subtotal),
        bonifications: lines
          .map(bonificationFor)
          .filter((bonification): bonification is LineBonification => bonification !== null),
      });
    }, SIMULATED_LATENCY_MS);
  });
}
