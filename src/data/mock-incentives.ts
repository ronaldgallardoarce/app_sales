/** Payment terms offered on an order. */
export const PAYMENT_METHODS = ['Contado', 'Pronto pago'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** What the incentive calculation resolved for the current order. */
export type Incentives = {
  discountPct: number;
  /** Why the discount adds up to that — shown so the seller can explain it. */
  reasons: string[];
  bonification: string | null;
};

/**
 * Mock incentive rules. The real percentages belong to the backend: this stands in
 * so the order summary has something to resolve, and keeps every rule in one place
 * for whoever wires the real service in.
 */
export function calculateIncentives(paymentMethod: PaymentMethod, subtotal: number): Incentives {
  const reasons: string[] = [];
  let discountPct = 0;

  if (paymentMethod === 'Pronto pago') {
    discountPct += 5;
    reasons.push('Pronto pago 5%');
  }
  if (subtotal >= 500) {
    discountPct += 3;
    reasons.push('Volumen 3%');
  }

  return {
    discountPct,
    reasons,
    bonification: subtotal >= 1000 ? '2 unidades bonificadas' : null,
  };
}
