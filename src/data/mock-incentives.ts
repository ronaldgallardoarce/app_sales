import type { MapClient } from '@/data/mock-clients';

/** Payment terms offered on an order. */
export const PAYMENT_METHODS = ['Contado', 'Pronto pago'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PriceListId = 'mayorista' | 'preferencial' | 'estandar' | 'basica';

/**
 * The commercial terms one client buys on.
 *
 * The list, not the payment method, is where a client's standing discount lives: "Contado" grants
 * nothing of its own, so what a client gets for paying on delivery is whatever their list already
 * gave them. "Pronto pago" is the only method that adds points on top, and `promptPaymentPct` is
 * how many — which makes it exactly the part that has to come back off when a prompt payment is
 * not completed in time.
 */
export type PriceList = {
  id: PriceListId;
  /** Named, because the seller has to be able to tell the client where the discount came from. */
  name: string;
  /** Granted on every order, whatever the payment terms. */
  standingPct: number;
  /** Added only while the order is being paid up front. */
  promptPaymentPct: number;
  /** The subtotal in Bs the volume discount starts at, and what it grants from there. */
  volumeFromBs: number;
  volumePct: number;
  /**
   * Scales the free-goods thresholds in `mock-bonifications`. Under 1 the client reaches each tier
   * sooner, which is what per-client bonifications amount to in practice: one ladder for everyone,
   * climbed earlier on a better list.
   */
  bonificationTierFactor: number;
};

/**
 * The four lists. Stand-ins for records the backend owns — what matters here is the shape and the
 * spread: `basica` grants nothing standing, so a client on it paying Contado sees no discount at
 * all, and `mayorista` carries one large enough that losing the prompt-payment points is visible
 * without being the entire discount.
 */
const PRICE_LISTS: Record<PriceListId, PriceList> = {
  mayorista: {
    id: 'mayorista',
    name: 'Mayorista',
    standingPct: 6,
    promptPaymentPct: 4,
    volumeFromBs: 500,
    volumePct: 3,
    bonificationTierFactor: 0.75,
  },
  preferencial: {
    id: 'preferencial',
    name: 'Preferencial',
    standingPct: 4,
    promptPaymentPct: 3,
    volumeFromBs: 500,
    volumePct: 3,
    bonificationTierFactor: 0.9,
  },
  estandar: {
    id: 'estandar',
    name: 'Estándar',
    standingPct: 2,
    promptPaymentPct: 3,
    volumeFromBs: 800,
    volumePct: 3,
    bonificationTierFactor: 1,
  },
  basica: {
    id: 'basica',
    name: 'Básica',
    standingPct: 0,
    promptPaymentPct: 2,
    volumeFromBs: 1000,
    volumePct: 2,
    bonificationTierFactor: 1.25,
  },
};

/**
 * The list a client buys on, derived from their record the same way `orderDetailsFor` derives their
 * NIT and delivery points: the real assignment lives in the backend, and deriving it keeps the same
 * client on the same list every time without a field hand-written across twenty-odd fixtures.
 *
 * Falls back to the list that grants least when there is no client. The confirm screen is reachable
 * by reload with no `clientId`, and guessing a generous list there would overstate a discount the
 * seller then has to walk back in front of whoever they are standing with.
 */
export function priceListFor(client: MapClient | null): PriceList {
  if (!client) return PRICE_LISTS.basica;
  if (client.isPareto && client.hasCreditLine) return PRICE_LISTS.mayorista;
  if (client.isPareto) return PRICE_LISTS.preferencial;
  if (client.hasCreditLine) return PRICE_LISTS.estandar;
  return PRICE_LISTS.basica;
}

/** One reason the order is discounted, and how many points that reason accounts for. */
export type DiscountComponent = {
  /** What it is called when the discount is read back to the client. */
  label: string;
  pct: number;
  /**
   * Whether these points exist only because the order is being paid up front. The one flag the
   * expiry path reads: an uncompleted prompt payment removes exactly the components carrying this
   * and leaves every other one standing.
   */
  fromPromptPayment: boolean;
};

/** What the incentive calculation resolved for the current order. */
export type Incentives = {
  priceListId: PriceListId;
  /** Carried beside the id so a screen can name the list without looking it up. */
  priceListName: string;
  /**
   * Every component that applied, in the order they are read out.
   *
   * The order's discount is the sum of these and is deliberately not stored next to them: a total
   * held beside its own parts is a total that can disagree with them. `discountBreakdown` adds
   * them up, and it is the only thing that does.
   */
  components: DiscountComponent[];
};

/** The three figures a screen asks of a discount, added up in one pass. */
export type DiscountBreakdown = {
  /** Everything that applied — the percentage the money is actually calculated from. */
  total: number;
  /** The part that only stands while the prompt payment does. */
  promptPayment: number;
  /** What `total` falls back to if the prompt payment is never completed. */
  base: number;
};

export function discountBreakdown(incentives: Incentives): DiscountBreakdown {
  return incentives.components.reduce<DiscountBreakdown>(
    (sum, component) => ({
      total: sum.total + component.pct,
      promptPayment: sum.promptPayment + (component.fromPromptPayment ? component.pct : 0),
      base: sum.base + (component.fromPromptPayment ? 0 : component.pct),
    }),
    { total: 0, promptPayment: 0, base: 0 },
  );
}

/**
 * Mock incentive rules. The real percentages belong to the backend: this stands in so the order
 * summary has something to resolve, and keeps every rule in one place for whoever wires the real
 * service in.
 *
 * Takes the client and not just the terms, because the client is where most of the answer comes
 * from: two clients paying the same way on the same subtotal are owed different discounts, and
 * until this argument existed the app could not express that at all.
 */
export function calculateIncentives(
  paymentMethod: PaymentMethod,
  subtotal: number,
  client: MapClient | null,
): Incentives {
  const priceList = priceListFor(client);
  const components: DiscountComponent[] = [];

  // A list granting nothing standing contributes no row rather than a row reading 0%: the
  // breakdown is what the seller reads out, and "Lista Básica 0%" is an explanation of nothing.
  if (priceList.standingPct > 0) {
    components.push({
      label: `Lista ${priceList.name}`,
      pct: priceList.standingPct,
      fromPromptPayment: false,
    });
  }

  if (subtotal >= priceList.volumeFromBs) {
    components.push({ label: 'Volumen', pct: priceList.volumePct, fromPromptPayment: false });
  }

  // Last in the list on purpose. It is the component the seller points at to close the sale, and
  // the one that disappears on expiry — both of which read better at the end of a total than
  // buried in the middle of it.
  if (paymentMethod === 'Pronto pago' && priceList.promptPaymentPct > 0) {
    components.push({
      label: 'Pronto pago',
      pct: priceList.promptPaymentPct,
      fromPromptPayment: true,
    });
  }

  return { priceListId: priceList.id, priceListName: priceList.name, components };
}
