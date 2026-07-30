import type { ThemeColor } from '@/constants/theme';
import { mapClients, type MapClient } from '@/data/mock-clients';
import type { PaymentMethod } from '@/data/mock-incentives';
import { lastOrderLines, mockProducts } from '@/data/mock-catalog';
import { toDateKey, type OrderType } from '@/data/mock-order-details';
import type { LineBonification } from '@/data/mock-bonifications';
import type { CartLine } from '@/types/catalog';
import { iceTotalOf, lineAmount } from '@/utils/order';

/**
 * Where an order is in its life. Not the same axis as `synced`: an order can be confirmed and
 * still sitting on the phone, which is exactly the state a seller with no signal ends the day
 * in and the one they most need to see.
 */
export type OrderStatus = 'borrador' | 'confirmado' | 'entregado' | 'anulado';

/** Typed with `ThemeColor` like the project's other status maps, so a token is looked up on the
 *  theme without a cast and a typo is a compile error rather than a missing colour. */
export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; color: ThemeColor; soft: ThemeColor }
> = {
  // Prepedido gets its own hue: it is the one status that is not yet a commitment, so reading it
  // as just another confirmed order is the mistake worth designing out.
  borrador: { label: 'Prepedido', color: 'accentAlt', soft: 'accentAltSoft' },
  confirmado: { label: 'Confirmado', color: 'accent', soft: 'accentSoft' },
  entregado: { label: 'Entregado', color: 'success', soft: 'successSoft' },
  anulado: { label: 'Anulado', color: 'danger', soft: 'dangerSoft' },
};

/**
 * One placed order, carrying everything the confirm screen asked for.
 *
 * Amounts are stored, not recomputed from the lines: an order is a record of what was agreed,
 * and the discount that applied on the day is not something a later rule change may rewrite.
 * The lines travel with it for the same reason — they are frozen copies, which is what
 * `CartLine` already is.
 */
export type PlacedOrder = {
  /**
   * The order number, the thing a seller reads out when the office calls. An integer, the way the
   * back office issues it — the old `P-004518` was a label wearing an id, and formatting belongs
   * to whoever prints it, not to the record.
   */
  id: number;
  clientId: string;
  clientCode: string;
  clientName: string;
  /**
   * When the order was taken, to the millisecond. Needed as a real instant and not just a day,
   * because the edit window is measured from this point — a day key would make an order taken
   * last night either two days old or one, depending on nothing but which side of midnight the
   * seller is standing on.
   */
  createdAtMs: number;
  /** The same moment as its local `YYYY-MM-DD` day, derived — never set by hand. */
  createdAt: string;
  deliveryDate: string;
  deliveryFrom: string;
  deliveryTo: string;
  paymentMethod: PaymentMethod;
  orderType: OrderType;
  /** Taken without an on-site check-in — the exception, so it is worth surfacing. */
  remote: boolean;
  status: OrderStatus;
  /** False while the order is still only on this phone. */
  synced: boolean;
  /**
   * Whether the order has already been amended. An order gets one edit and no more, so this is
   * the second half of the edit gate: `createdAtMs` closes the window with time, this one closes
   * it with use — and unlike the clock it never reopens.
   */
  edited: boolean;
  lines: CartLine[];
  /** The free goods granted, one entry per line that earned any. */
  bonifications: LineBonification[];
  subtotal: number;
  discount: number;
  ice: number;
  total: number;
  /** Free minimum units across the whole order — derived from `bonifications`. */
  bonificationUnits: number;
};

/**
 * The order number written the way it is said out loud: "N° 4518".
 *
 * One function so every screen prints the id the same way. A bare integer on its own in a header
 * or a dialog title reads like a quantity — the "N°" is what makes it a number *of* something,
 * and it is the same abbreviation the search box already asks for.
 */
export function orderNumberLabel(id: number): string {
  return `N° ${id}`;
}

/**
 * How long after it was taken an order may still be changed — edited or deleted alike.
 *
 * One window and not two: both actions rewrite what the office was already told, so the moment
 * the order stops being the seller's to amend is the same moment it stops being theirs to
 * withdraw. A delete that outlived the edit would be the wider hole of the two.
 */
export const CHANGE_WINDOW_HOURS = 2;

const CHANGE_WINDOW_MS = CHANGE_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * Whether the order may still be edited: young enough, and never edited before.
 *
 * Two rules, and the one-edit half is the stricter of them. It is checked first because it is
 * permanent — an order that has been amended stays closed for good, so the remaining minutes on
 * its clock stop meaning anything.
 *
 * Status is still not consulted, which means a cancelled or already-delivered order that happens
 * to be fresh and untouched is editable. If those should be frozen too, that is a third rule and
 * it belongs here.
 */
export function canEditOrder(order: PlacedOrder, now: number = Date.now()): boolean {
  return !order.edited && now - order.createdAtMs < CHANGE_WINDOW_MS;
}

/**
 * Whether the order may still be deleted: the same two hours, and only those.
 *
 * The one-edit half deliberately does not apply here. It exists so an order cannot be reshaped
 * again and again after the office has seen it; an order that used its edit has not used up any
 * right to be withdrawn, and freezing it would leave a seller who amended a mistaken order at
 * 9:05 unable to cancel it at 9:10.
 */
export function canDeleteOrder(order: PlacedOrder, now: number = Date.now()): boolean {
  return now - order.createdAtMs < CHANGE_WINDOW_MS;
}

/**
 * Which rule closed the edit, or null while it is still open.
 *
 * The two closures are not the same news to a seller — one is "you already did this", the other
 * "you waited too long" — and only one of them is worth arguing with the office about. The screens
 * ask instead of re-deriving it, so the wording stays a screen's business and the rule stays this
 * file's.
 */
export function editBlockedReason(
  order: PlacedOrder,
  now: number = Date.now(),
): 'edited' | 'expired' | null {
  if (order.edited) return 'edited';
  return now - order.createdAtMs < CHANGE_WINDOW_MS ? null : 'expired';
}

/**
 * How much of the change window is left, spoken the way it is read out: "1 h 20 min", "45 min".
 *
 * Minutes and not whole hours, and that is not cosmetic. This used to floor the remainder to
 * hours, which was harmless while the window was two days wide and became a lie the moment it
 * became two: an order with fifty minutes left reported "0 horas más" — the window open, the
 * button live, and the sentence under it saying the time was gone.
 */
export function changeTimeLeftLabel(order: PlacedOrder, now: number = Date.now()): string {
  const minutes = Math.max(Math.floor((order.createdAtMs + CHANGE_WINDOW_MS - now) / 60_000), 0);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** A timestamp `hours` hours before now, so fixtures land on both sides of the edit window. */
function hoursAgo(hours: number): number {
  return Date.now() - hours * 60 * 60 * 1000;
}

/**
 * The same, in minutes — the only way to place a fixture inside a two-hour window.
 *
 * With the window at two days the freshest fixture could be hours old and still editable. At two
 * hours every one of them fell outside it, which would have left the edit path unreachable in the
 * mock data: not a broken rule, but a feature no one could see working.
 */
function minutesAgo(minutes: number): number {
  return Date.now() - minutes * 60 * 1000;
}

/** A day key `offset` days before today. */
function dayKey(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return toDateKey(date);
}

/** A day key `offset` days after today. */
function futureKey(offset: number): string {
  return dayKey(-offset);
}

/** The free goods for one line, at the quantity given. */
function gift(productId: number, qty: number): LineBonification {
  const product = mockProducts.find((candidate) => candidate.id === productId);
  return {
    productId,
    giftProductId: productId,
    giftProductName: product?.name ?? 'Producto',
    qty,
    minUnitLabel: product?.minUnit ?? 'Unidad',
  };
}

/** Cart lines for a handful of product codes, at the quantities given. */
function linesOf(spec: { id: number; qtyMax: number; qtyMin: number }[]): CartLine[] {
  return spec.flatMap(({ id, qtyMax, qtyMin }) => {
    const product = mockProducts.find((candidate) => candidate.id === id);
    if (!product) return [];
    return [
      {
        productId: product.id,
        productName: product.name,
        flavor: product.flavor,
        sizeLabel: product.sizeLabel,
        minUnitLabel: product.minUnit,
        maxUnitLabel: product.maxUnit,
        qtyMax,
        qtyMin,
        unitPriceMax: product.priceCaja,
        unitPriceMin: product.priceUnidad,
        ice: product.ice,
        unitsPerCase: product.unitsPerCase,
      },
    ];
  });
}

/**
 * Assembles an order from its lines and the discount that applied, so the stored amounts stay
 * arithmetically consistent with each other. Hand-written totals in fixture data drift from
 * their own lines the moment anyone edits a quantity, and then the screen showing them looks
 * broken for reasons that have nothing to do with the screen.
 */
function order(
  base: Omit<
    PlacedOrder,
    | 'subtotal'
    | 'discount'
    | 'ice'
    | 'total'
    | 'clientCode'
    | 'clientName'
    | 'createdAt'
    | 'bonificationUnits'
    | 'edited'
  > & { discountPct: number; edited?: boolean },
): PlacedOrder {
  // `edited` defaults to false so only a fixture that means to be spent says so: untouched is
  // what an order is when it is taken, and ten fixtures repeating that adds nothing.
  const { discountPct, edited = false, ...rest } = base;
  const client = mapClients.find((candidate: MapClient) => candidate.id === rest.clientId);
  const subtotal = rest.lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const discount = Number(((subtotal * discountPct) / 100).toFixed(2));
  return {
    ...rest,
    edited,
    // Derived, not accepted as input: the day and the instant are the same fact, and the free
    // unit count is just its own list added up.
    createdAt: toDateKey(new Date(rest.createdAtMs)),
    bonificationUnits: rest.bonifications.reduce((sum, bonification) => sum + bonification.qty, 0),
    clientCode: client?.code ?? '—',
    clientName: client?.name ?? 'Cliente',
    subtotal,
    discount,
    ice: iceTotalOf(rest.lines),
    total: Number((subtotal - discount).toFixed(2)),
  };
}

/**
 * Orders already placed on this route, newest first.
 *
 * Spread across today, this week and last month on purpose: the date filter is the point of the
 * screen, so a fixture set clustered on one day would make every period look identical and hide
 * whether the filter works at all. The mix of statuses, payment terms, remote flags and pending
 * syncs is there for the same reason — every branch the row can render has an example.
 */
export const mockOrders: PlacedOrder[] = [
  order({
    id: 4518,
    clientId: mapClients[0]?.id ?? 'c1',
    createdAtMs: minutesAgo(35),
    deliveryDate: futureKey(1),
    deliveryFrom: '08:00',
    deliveryTo: '12:00',
    paymentMethod: 'Contado',
    orderType: 'Normal',
    remote: false,
    status: 'confirmado',
    synced: false,
    discountPct: 3,
    lines: linesOf([
      { id: 10020, qtyMax: 2, qtyMin: 4 },
      { id: 20101, qtyMax: 2, qtyMin: 0 },
      { id: 10100, qtyMax: 1, qtyMin: 6 },
    ]),
    bonifications: [gift(10020, 2), gift(20101, 2)],
  }),
  order({
    id: 4517,
    clientId: mapClients[1]?.id ?? 'c2',
    createdAtMs: minutesAgo(105),
    // Inside its window and already spent — the only way to see an order refused for having been
    // edited rather than for being old, since the two fresh fixtures are the only editable ones
    // and the other is left open on purpose.
    edited: true,
    deliveryDate: futureKey(2),
    deliveryFrom: '14:00',
    deliveryTo: '18:00',
    paymentMethod: 'Pronto pago',
    orderType: 'Normal',
    remote: true,
    status: 'confirmado',
    synced: true,
    discountPct: 8,
    lines: linesOf([
      { id: 10040, qtyMax: 1, qtyMin: 2 },
      { id: 10160, qtyMax: 0, qtyMin: 8 },
    ]),
    bonifications: [],
  }),
  order({
    id: 4515,
    clientId: mapClients[2]?.id ?? 'c3',
    createdAtMs: hoursAgo(30),
    deliveryDate: dayKey(0),
    deliveryFrom: '08:00',
    deliveryTo: '10:00',
    paymentMethod: 'Contado',
    orderType: 'Normal',
    remote: false,
    status: 'entregado',
    synced: true,
    discountPct: 0,
    lines: linesOf([{ id: 10030, qtyMax: 3, qtyMin: 0 }]),
    bonifications: [gift(10030, 6)],
  }),
  order({
    id: 4509,
    clientId: mapClients[3]?.id ?? 'c4',
    createdAtMs: hoursAgo(74),
    deliveryDate: dayKey(2),
    deliveryFrom: '10:00',
    deliveryTo: '12:00',
    paymentMethod: 'Contado',
    orderType: 'Licitación',
    remote: false,
    status: 'entregado',
    synced: true,
    discountPct: 3,
    lines: linesOf([
      { id: 10050, qtyMax: 4, qtyMin: 0 },
      { id: 10080, qtyMax: 2, qtyMin: 6 },
      { id: 10130, qtyMax: 2, qtyMin: 0 },
    ]),
    bonifications: [gift(10050, 6), gift(10080, 6)],
  }),
  order({
    id: 4503,
    clientId: mapClients[4]?.id ?? 'c5',
    createdAtMs: hoursAgo(145),
    deliveryDate: dayKey(5),
    deliveryFrom: '08:00',
    deliveryTo: '18:00',
    paymentMethod: 'Pronto pago',
    orderType: 'Normal',
    remote: true,
    status: 'anulado',
    synced: true,
    discountPct: 5,
    lines: linesOf([{ id: 10090, qtyMax: 0, qtyMin: 12 }]),
    bonifications: [],
  }),
  order({
    id: 4498,
    clientId: mapClients[0]?.id ?? 'c1',
    createdAtMs: hoursAgo(220),
    deliveryDate: dayKey(8),
    deliveryFrom: '12:00',
    deliveryTo: '14:00',
    paymentMethod: 'Contado',
    orderType: 'Normal',
    remote: false,
    status: 'entregado',
    synced: true,
    discountPct: 3,
    lines: linesOf(lastOrderLines.map((line) => ({ id: line.productId, qtyMax: line.qtyMax, qtyMin: line.qtyMin }))),
    bonifications: [gift(10020, 2)],
  }),
  order({
    id: 4491,
    clientId: mapClients[5]?.id ?? 'c6',
    createdAtMs: hoursAgo(340),
    deliveryDate: dayKey(13),
    deliveryFrom: '16:00',
    deliveryTo: '18:00',
    paymentMethod: 'Contado',
    orderType: 'Normal',
    remote: false,
    status: 'borrador',
    synced: false,
    discountPct: 0,
    lines: linesOf([
      { id: 10110, qtyMax: 1, qtyMin: 0 },
      { id: 10180, qtyMax: 1, qtyMin: 4 },
    ]),
    bonifications: [],
  }),
  order({
    id: 4476,
    clientId: mapClients[2]?.id ?? 'c3',
    createdAtMs: hoursAgo(580),
    deliveryDate: dayKey(23),
    deliveryFrom: '08:00',
    deliveryTo: '12:00',
    paymentMethod: 'Contado',
    orderType: 'Normal',
    remote: false,
    status: 'entregado',
    synced: true,
    discountPct: 3,
    lines: linesOf([
      { id: 10070, qtyMax: 5, qtyMin: 0 },
      { id: 10150, qtyMax: 2, qtyMin: 10 },
    ]),
    bonifications: [gift(10070, 10)],
  }),
  order({
    id: 4455,
    clientId: mapClients[1]?.id ?? 'c2',
    createdAtMs: hoursAgo(985),
    deliveryDate: dayKey(40),
    deliveryFrom: '14:00',
    deliveryTo: '16:00',
    paymentMethod: 'Pronto pago',
    orderType: 'Normal',
    remote: false,
    status: 'entregado',
    synced: true,
    discountPct: 8,
    lines: linesOf([{ id: 10010, qtyMax: 2, qtyMin: 0 }]),
    bonifications: [],
  }),
];
