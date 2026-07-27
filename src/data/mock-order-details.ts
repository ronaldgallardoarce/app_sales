import type { MapClient } from '@/data/mock-clients';

/**
 * A place the client can receive goods at. Clients may have several, so each is
 * identified by its own numeric code — the label a seller reads is
 * `code - client name`, with the address as the distinguishing line.
 */
export type DeliveryPoint = { id: string; code: number; name: string; address: string };

/** The label shown for a delivery point: its code and the client it belongs to. */
export function deliveryPointLabel(point: DeliveryPoint): string {
  return `${point.code} - ${point.name}`;
}

/** How the order is classified commercially. */
export const ORDER_TYPES = ['Normal', 'Licitación'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

/** Order-time client data: who to invoice, where to deliver, who to ask for. */
export type OrderClientDetails = {
  nit: string;
  razonSocial: string;
  deliveryPoints: DeliveryPoint[];
  contact: string;
};

/** Deterministic pseudo-random in [0, 1) from a string seed, stable across renders. */
function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Address suffixes that make each mock delivery point distinguishable. */
const DELIVERY_SUFFIXES = ['Local principal', 'Depósito · Galpón 2', 'Sucursal Norte', 'Sucursal Sur'];

/**
 * Invoicing and delivery data for an order, derived from the client record.
 *
 * A real backend owns these fields; deriving them keeps the mock consistent —
 * the same client always shows the same NIT and delivery points — without
 * duplicating twenty hand-written records. Every client gets four delivery points
 * so the picker has enough entries for its search to be worth using.
 */
export function orderDetailsFor(client: MapClient): OrderClientDetails {
  const baseCode = Number(client.code) || 100000;

  const deliveryPoints: DeliveryPoint[] = DELIVERY_SUFFIXES.map((suffix, index) => ({
    id: `${client.id}-dp-${index + 1}`,
    code: baseCode + index,
    name: client.name,
    address: `${client.address} · ${suffix}`,
  }));

  return {
    nit: `${client.code}0${Math.floor(seededUnit(`${client.id}:nit`) * 10)}`,
    razonSocial: client.name,
    deliveryPoints,
    contact: client.owner,
  };
}

/**
 * Delivery windows the seller can commit to. Typed as plain strings rather than a
 * literal tuple: the screen compares positions to keep "hasta" at or after
 * "desde", and a literal union would force a cast at every comparison.
 */
export const DELIVERY_HOURS: readonly string[] = [
  '08:00',
  '10:00',
  '12:00',
  '14:00',
  '16:00',
  '18:00',
];

/** The next few days, as pickable delivery dates. */
export function deliveryDateOptions(from: Date = new Date()): { key: string; label: string }[] {
  const labels = ['Hoy', 'Mañana'];
  return [0, 1, 2, 3].map((offset) => {
    const date = new Date(from);
    date.setDate(date.getDate() + offset);
    return {
      key: date.toISOString().slice(0, 10),
      label:
        labels[offset] ??
        date.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }),
    };
  });
}
