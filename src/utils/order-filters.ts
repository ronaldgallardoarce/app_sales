import { fromDateKey, toDateKey } from '@/data/mock-order-details';
import type { OrderStatus, PlacedOrder } from '@/data/mock-orders';

/**
 * The date filter, as the shapes a seller actually asks for.
 *
 * `hoy` and the rolling windows are the everyday questions — "what did I sell today", "how is
 * the week going" — and `rango` is the escape hatch for everything else. Kept as a period plus
 * an optional explicit range rather than always storing two dates, so the common cases stay one
 * tap and the label can say "Últimos 7 días" instead of spelling out two dates the seller never
 * typed.
 */
export type PeriodKey = 'hoy' | '7' | '30' | 'rango';

/**
 * Chip labels. Short on purpose: the periods now sit in a row on the screen rather than spelled
 * out in a sheet, so all five have to share one line's width.
 */
export const PERIOD_CHIP_LABELS: Record<PeriodKey, string> = {
  hoy: 'Hoy',
  '7': '7 días',
  '30': '30 días',
  rango: 'Rango',
};

export type OrderFilters = {
  period: PeriodKey;
  /** Inclusive `YYYY-MM-DD` bounds, only meaningful when `period` is `rango`. */
  from: string | null;
  to: string | null;
  /** Null means every status. */
  status: OrderStatus | null;
  query: string;
};

export const DEFAULT_ORDER_FILTERS: OrderFilters = {
  period: '30',
  from: null,
  to: null,
  status: null,
  query: '',
};

/**
 * The inclusive day bounds a period resolves to.
 *
 * Null only ever means a range with an end still missing — every period now carries a date
 * limit, so there is no "everything" case to fall through to.
 *
 * Compared as `YYYY-MM-DD` strings rather than as `Date` objects: the keys are already local
 * calendar days, they sort lexicographically because the format is fixed-width, and comparing
 * them avoids reintroducing the timezone drift that made the delivery date key wrong.
 */
export function periodBounds(filters: OrderFilters): { from: string; to: string } | null {
  if (filters.period === 'rango') {
    if (!filters.from || !filters.to) return null;
    // Tolerates the two dates arriving in either order, so a seller who picks the end first
    // still gets the range they meant instead of an empty list.
    return filters.from <= filters.to
      ? { from: filters.from, to: filters.to }
      : { from: filters.to, to: filters.from };
  }

  const today = new Date();
  const to = toDateKey(today);
  if (filters.period === 'hoy') return { from: to, to };

  const back = new Date(today);
  back.setDate(back.getDate() - (Number(filters.period) - 1));
  return { from: toDateKey(back), to };
}

/** Every order matching the filters, newest first. */
export function filterOrders(orders: PlacedOrder[], filters: OrderFilters): PlacedOrder[] {
  const bounds = periodBounds(filters);
  const query = filters.query.trim().toLowerCase();

  return orders
    .filter((order) => {
      if (bounds && (order.createdAt < bounds.from || order.createdAt > bounds.to)) return false;
      if (filters.status && order.status !== filters.status) return false;
      if (query) {
        // Order number and client both, because the seller arrives here from either direction:
        // the office quoting a number, or a client asking about their own last order.
        const haystack = `${order.id} ${order.clientCode} ${order.clientName}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/**
 * What the filtered set adds up to — the figures worth a strip above the list.
 *
 * The average is the third figure rather than a pending-sync count: it is always present, so the
 * strip does not change shape as the data does, and against the total it answers the question a
 * total alone cannot — whether the period was many small orders or a few large ones.
 */
export function summariseOrders(orders: PlacedOrder[]): {
  count: number;
  total: number;
  average: number;
} {
  const total = orders.reduce((sum, order) => sum + order.total, 0);
  return {
    count: orders.length,
    total,
    average: orders.length === 0 ? 0 : total / orders.length,
  };
}

/** Day and month for a compact list row, e.g. "29 jul". */
const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function shortDateLabel(key: string): string {
  const date = fromDateKey(key);
  return `${date.getDate()} ${MONTH_ABBR[date.getMonth()]}`;
}

// `periodSummary` lived here to label the filter button that opened the sheet. Both are gone —
// the active chip and the two range rows now say the same thing on the screen itself.
