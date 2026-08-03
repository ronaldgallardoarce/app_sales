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
 * A window the client is able to receive in.
 *
 * The presets below are a shortcut, not the whole vocabulary: the picker also spins each end to
 * any half hour of the delivery day, because a client who receives from 09:30 to 11:00 exists and
 * a fixed list cannot hold every such pair. What keeps a range valid is the picker itself — either
 * end pushes the other ahead of it rather than crossing it — and not the old absence of choice.
 *
 * `quick` marks the handful worth a single tap: the wheels cover every other combination, so the
 * chip row only carries the ones a seller reaches for by name several times a day.
 */
export type DeliveryWindow = { from: string; to: string; label: string; quick?: boolean };

export const DELIVERY_WINDOWS: readonly DeliveryWindow[] = [
  { from: '08:00', to: '10:00', label: 'Temprano' },
  { from: '08:00', to: '12:00', label: 'Mañana', quick: true },
  { from: '10:00', to: '12:00', label: 'Media mañana' },
  { from: '12:00', to: '14:00', label: 'Mediodía', quick: true },
  { from: '14:00', to: '16:00', label: 'Media tarde' },
  { from: '14:00', to: '18:00', label: 'Tarde', quick: true },
  { from: '16:00', to: '18:00', label: 'Cierre' },
  { from: '08:00', to: '18:00', label: 'Todo el día', quick: true },
];

/** The window's hours as one string, e.g. "08:00 a 12:00". */
export function deliveryWindowRange(window: DeliveryWindow): string {
  return `${window.from} a ${window.to}`;
}

/** Whichever window matches these hours, or undefined for a pair no preset covers. */
export function findDeliveryWindow(from: string, to: string): DeliveryWindow | undefined {
  return DELIVERY_WINDOWS.find((window) => window.from === from && window.to === to);
}

/**
 * How far apart two consecutive rows of the delivery wheels are, in minutes.
 *
 * The one place the granularity lives: quarter-hour windows are this constant set to 15, with the
 * list below and every span calculation following from it.
 */
export const DELIVERY_WHEEL_STEP_MINUTES = 30;

/** The hours deliveries actually run between, and the two ends the wheels cannot pass. */
export const DELIVERY_OPENING_MINUTES = 8 * 60;
export const DELIVERY_CLOSING_MINUTES = 18 * 60;

/**
 * Every time the delivery wheels can rest on: `08:00` through `18:00`, both ends included.
 *
 * The delivery day and not the clock. Nothing leaves the warehouse before eight or after six, so
 * the hours outside that were never answers a seller could give — offering them only invited a
 * window the round could not serve. Both ends are inclusive because `18:00` has to be reachable
 * as a closing hour, which is why the list is one row longer than the spans it divides.
 */
export const DELIVERY_DAY_HOURS: readonly string[] = Array.from(
  { length: (DELIVERY_CLOSING_MINUTES - DELIVERY_OPENING_MINUTES) / DELIVERY_WHEEL_STEP_MINUTES + 1 },
  (_, index) => {
    const minutes = DELIVERY_OPENING_MINUTES + index * DELIVERY_WHEEL_STEP_MINUTES;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  },
);

/**
 * The rows each end of the range may rest on, and the whole reason an inverted window cannot be
 * built here.
 *
 * `18:00` can never be an opening hour — no delivery day is left after it to receive in — and
 * `08:00` can never be a closing one. Leaving each of those off the wheel that cannot use it makes
 * the boundary a property of the lists instead of a rule the picker has to keep checking: the last
 * hour "Desde" can reach still leaves a row for "Hasta" above it, and the first hour "Hasta" can
 * reach still leaves one for "Desde" below it. There is no end of the day left to special-case.
 */
export const DELIVERY_FROM_HOURS: readonly string[] = DELIVERY_DAY_HOURS.slice(0, -1);
export const DELIVERY_TO_HOURS: readonly string[] = DELIVERY_DAY_HOURS.slice(1);

/** An `HH:MM` hour as minutes since midnight, so two of them can be compared or subtracted. */
export function minutesOfTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** How long the window lasts, spelled the way it is said out loud: "4 h", "1 h 30 min", "30 min". */
export function deliveryWindowSpan(from: string, to: string): string {
  const total = minutesOfTime(to) - minutesOfTime(from);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/**
 * A name for these hours: the matching preset's, or the stretch of the day they fall in.
 *
 * A freely built range still gets a name because the seller reads it back to the client, who
 * answers in "por la tarde" and not in "de 14:30 a 17:00". The hours are what the warehouse
 * loads on; the name is what the two people in the conversation actually agreed on.
 */
export function deliveryWindowLabelFor(from: string, to: string): string {
  const preset = findDeliveryWindow(from, to);
  if (preset) return preset.label;

  const start = minutesOfTime(from);
  const end = minutesOfTime(to);
  const noon = 12 * 60;
  const earlyAfternoon = 14 * 60;

  if (end <= noon) return 'Mañana';
  if (start >= earlyAfternoon) return 'Tarde';
  if (start >= noon && end <= earlyAfternoon) return 'Mediodía';
  return 'Todo el día';
}

/**
 * A date as its `YYYY-MM-DD` key, built from the *local* calendar parts.
 *
 * Not `toISOString().slice(0, 10)`, which is the same thing shifted into UTC: at UTC-4 any
 * local time from 20:00 onwards already belongs to the next UTC day, so an evening visit —
 * routine for a seller closing their round — would have stamped tomorrow's date on a delivery
 * labelled "Hoy".
 */
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A `YYYY-MM-DD` key back as a local midnight `Date`. */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Day and month names, hardcoded rather than read from `toLocaleDateString`.
 *
 * Hermes ships without full Intl locale data on Android, so an `es-BO` weekday or month comes
 * back in English there — the same reason the date picker carries its own month names. A
 * delivery date is read out loud to the client, so it cannot be "Thursday" on half the fleet.
 */
const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * The next few days, as the quick delivery dates worth one tap. Anything else, today included,
 * goes through the calendar beside them.
 *
 * Starts tomorrow rather than today, by request. The calendar is deliberately left
 * unrestricted, so this is which days are worth a shortcut, not which days are allowed.
 */
export function deliveryDateOptions(from: Date = new Date()): { key: string; label: string }[] {
  return [1, 2, 3].map((offset) => {
    const date = new Date(from);
    date.setDate(date.getDate() + offset);
    return {
      key: toDateKey(date),
      label: offset === 1 ? 'Mañana' : `${date.getDate()} ${MONTH_ABBR[date.getMonth()]}`,
    };
  });
}

/** The chosen date spelled out, so the seller reads back a day and not a code. */
export function deliveryDateLabel(key: string): string {
  const date = fromDateKey(key);
  return `${WEEKDAY_NAMES[date.getDay()]} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`;
}
