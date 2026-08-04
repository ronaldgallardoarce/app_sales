/**
 * Stands in for the prompt-payment endpoints on the **sales** service.
 *
 * Sales is the orchestrator. The app asks it to open a prompt payment and sales reserves the stock,
 * opens the payment intent against the payment service and later has the invoice issued — the app
 * never talks to those services and never learns they exist. That is why this is one flat set of
 * functions against one service instead of a client per concern: the moment the app subscribes to
 * two services it becomes the thing deciding whether they agree, and it is the worst placed
 * component in the system to decide that.
 *
 * Everything here derives its answers from one timeline per intent, so the stream and the
 * reconciliation fetch cannot disagree about what happened. The real services have to hold that
 * property too, and building the mock any other way would hide the day they stop.
 */

/**
 * How long a reservation holds. The rule and not a demo value: stock is held for ten minutes, and
 * the countdown the seller reads to the client has to be the real one.
 */
export const PROMPT_PAYMENT_TTL_MS = 10 * 60 * 1000;

/** What sales returns when a prompt payment is opened. */
export type PaymentIntent = {
  id: string;
  /**
   * Where the client is sent. Opening it puts them in a chat that hands them the QR — the seller
   * shares this link rather than a QR image, because the chat is also where the receipt lands and
   * where the client can ask what went wrong.
   */
  chatUrl: string;
  /** The same payment as a QR payload, for the client standing in front of the seller. */
  qrPayload: string;
  amountBs: number;
  /**
   * How long the reservation holds *from the moment this reply arrived* — a duration, never an
   * instant. An absolute `expiresAt` would have to be read against the phone's clock, and a device
   * an hour fast shows a countdown that already ran out on an order nobody has paid yet.
   */
  ttlMs: number;
};

/**
 * Something sales says happened to a payment.
 *
 * Every event names its intent and carries a sequence, because a stream repeats and reorders. The
 * intent id is what stops an event about a reservation the seller already abandoned from landing on
 * the one they started after it — a late "paid" from a cancelled intent would otherwise confirm an
 * order nobody paid for.
 */
export type PaymentEventMeta = { intentId: string; sequence: number };

export type PaymentEvent =
  | (PaymentEventMeta & { kind: 'paid'; paidAtMs: number; invoiceId: string | null })
  | (PaymentEventMeta & { kind: 'invoiced'; invoiceId: string })
  | (PaymentEventMeta & { kind: 'expired' })
  | (PaymentEventMeta & { kind: 'failed'; reason: string });

/**
 * The resolved state of one payment, as answered by a plain request.
 *
 * This is the half that makes the stream safe to rely on. A dropped connection sends nothing, and
 * nothing is indistinguishable from "the client has not paid yet" — so no part of the app may
 * conclude anything from silence. It asks instead, and this is the answer.
 */
export type PaymentSnapshot =
  | { state: 'awaiting'; expiresInMs: number }
  | { state: 'paid'; paidAtMs: number; invoiceId: string | null }
  | { state: 'expired' }
  | { state: 'failed'; reason: string };

/** A live subscription. Closing it is the caller's job; reconnecting is not. */
export type PaymentSubscription = { close: () => void };

/**
 * Which way the simulated payment goes.
 *
 * A mock needs every branch reachable by hand — the expiry and rejection screens are the ones worth
 * showing to whoever is reviewing this, and they are the ones a happy-path demo never reaches.
 */
export type SimulatedOutcome = 'paid' | 'expired' | 'failed';

let simulatedOutcome: SimulatedOutcome = 'paid';

/** Point the next opened payment at a different ending. Mock-only; no real endpoint behind it. */
export function setSimulatedOutcome(outcome: SimulatedOutcome) {
  simulatedOutcome = outcome;
}

/** How long the fake round trip to open the payment takes. */
const SIMULATED_LATENCY_MS = 900;

/**
 * When each simulated ending lands, measured from the moment the intent was opened.
 *
 * `expired` deliberately does not wait out `PROMPT_PAYMENT_TTL_MS`. The ten minutes are the real
 * rule and the countdown honours them, but nobody reviewing a mockup is going to sit through them
 * to see the fallback screen — so the simulated service reports the reservation gone early, which
 * exercises the same code path the real timeout would.
 */
const OUTCOME_DELAYS_MS: Record<SimulatedOutcome, number> = {
  paid: 6_000,
  expired: 12_000,
  failed: 7_000,
};

/** How long after the payment the invoice shows up — long enough to see "factura en camino". */
const INVOICE_DELAY_MS = 3_000;

/**
 * One opened payment, as the simulated sales service remembers it.
 *
 * The endings are timestamps fixed when the intent is opened, not flags flipped by timers. Both the
 * stream and the reconciliation fetch read this same timeline, which is what makes them agree even
 * when the app was asleep for the part where it happened.
 */
type IntentRecord = {
  amountBs: number;
  deadlineMs: number;
  outcome: SimulatedOutcome;
  /** When the outcome lands. */
  outcomeAtMs: number;
  /** When the invoice lands, for a payment that goes through. */
  invoiceAtMs: number;
  invoiceId: string;
  /** Set when the seller gave up: the stock went back and nothing further can happen. */
  released: boolean;
  /** Last sequence handed out for this intent, so events are ordered the way a real stream's are. */
  sequence: number;
};

const intents = new Map<string, IntentRecord>();

let intentCounter = 0;

/**
 * Opens a prompt payment: one call that reserves the stock and returns everything the seller needs
 * to collect. Deliberately not three calls — the app is not the one sequencing a reservation
 * against a payment intent, sales is.
 */
export function createPaymentIntent(amountBs: number): Promise<PaymentIntent> {
  // Read now rather than when the round trip resolves: which ending was asked for is a property of
  // the call, and reading it later would make it a property of whatever was set while the request
  // was in flight.
  const outcome = simulatedOutcome;
  intentCounter += 1;
  const id = `pi-${Date.now().toString(36)}-${intentCounter}`;

  return new Promise((resolve) => {
    setTimeout(() => {
      const openedAtMs = Date.now();

      intents.set(id, {
        amountBs,
        deadlineMs: openedAtMs + PROMPT_PAYMENT_TTL_MS,
        outcome,
        outcomeAtMs: openedAtMs + OUTCOME_DELAYS_MS[outcome],
        invoiceAtMs: openedAtMs + OUTCOME_DELAYS_MS[outcome] + INVOICE_DELAY_MS,
        invoiceId: `F-${String(90_000 + intentCounter)}`,
        released: false,
        sequence: 0,
      });

      resolve({
        id,
        // The host belongs to the service in production; what matters to the app is that the link
        // arrives ready to forward and is never assembled here.
        chatUrl: `https://pagos.grupovenado.com/c/${id}`,
        qrPayload: `VENADO|${id}|${amountBs.toFixed(2)}`,
        amountBs,
        ttlMs: PROMPT_PAYMENT_TTL_MS,
      });
    }, SIMULATED_LATENCY_MS);
  });
}

/** What this intent's timeline says has happened by `now`. The one place the answer is decided. */
function snapshotOf(record: IntentRecord, now: number): PaymentSnapshot {
  if (record.outcome === 'paid' && now >= record.outcomeAtMs) {
    return {
      state: 'paid',
      paidAtMs: record.outcomeAtMs,
      invoiceId: now >= record.invoiceAtMs ? record.invoiceId : null,
    };
  }

  // A released reservation reads as expired rather than as its own state: the stock is gone either
  // way, and what the seller does next is the same.
  if (record.released) return { state: 'expired' };

  if (record.outcome === 'failed' && now >= record.outcomeAtMs) {
    return { state: 'failed', reason: 'El pago fue rechazado por el banco.' };
  }

  if (record.outcome === 'expired' && now >= record.outcomeAtMs) return { state: 'expired' };

  if (now >= record.deadlineMs) return { state: 'expired' };

  return { state: 'awaiting', expiresInMs: record.deadlineMs - now };
}

/**
 * Asks sales what actually happened to a payment.
 *
 * The call every path takes before concluding anything: when the countdown runs out, and whenever
 * the app comes back to the foreground having missed whatever the stream said while it was away.
 */
export function fetchPaymentState(intentId: string): Promise<PaymentSnapshot> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const record = intents.get(intentId);
      // An intent sales has never heard of cannot be waited on. Reported as expired, which is the
      // safe reading: it sends the seller back to choose terms again rather than leaving them on a
      // countdown for a reservation that does not exist.
      if (!record) {
        resolve({ state: 'expired' });
        return;
      }
      resolve(snapshotOf(record, Date.now()));
    }, 400);
  });
}

/**
 * Hands the reservation back. Called when the seller gives up rather than letting the clock run
 * out, because ten minutes of held stock is ten minutes nobody else can sell it.
 */
export function releaseReservation(intentId: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const record = intents.get(intentId);
      if (record) record.released = true;
      resolve();
    }, 300);
  });
}

/**
 * Subscribes to one payment's events.
 *
 * The seam the transport lives behind. Sales pushes these over a stream, and swapping how — a
 * WebSocket, SSE through a polyfill, or polling on a bad network — is a change to this function and
 * to nothing else in the app. React Native ships a WebSocket but no `EventSource`, so SSE would
 * need `react-native-sse`; neither fact is allowed to reach a screen.
 *
 * **Reconnecting is this function's job, not the caller's.** A caller that had to notice a dropped
 * socket and re-subscribe would be a caller reimplementing the transport, and every caller would
 * get it slightly differently wrong.
 */
export function subscribeToPayment(
  intentId: string,
  onEvent: (event: PaymentEvent) => void,
): PaymentSubscription {
  const record = intents.get(intentId);
  if (!record) return { close: () => {} };

  const timers: ReturnType<typeof setTimeout>[] = [];

  /** Sequenced on the way out, the way a stream that can repeat and reorder has to be. */
  const emit = (build: (meta: PaymentEventMeta) => PaymentEvent) => {
    record.sequence += 1;
    onEvent(build({ intentId, sequence: record.sequence }));
  };

  const at = (whenMs: number, send: () => void) => {
    const delay = whenMs - Date.now();
    // Already due: a subscription opened after the fact still reports it, since a stream the app
    // reconnected to late is the normal case and not an error.
    timers.push(setTimeout(send, Math.max(0, delay)));
  };

  if (record.outcome === 'paid') {
    at(record.outcomeAtMs, () =>
      emit((meta) => ({ ...meta, kind: 'paid', paidAtMs: record.outcomeAtMs, invoiceId: null })),
    );
    // A second event, because the invoice is a different service's work and arrives when it
    // arrives. Modelling it as part of the payment would mean promising an invoice the moment the
    // money lands, and then rendering a button that opens nothing.
    at(record.invoiceAtMs, () =>
      emit((meta) => ({ ...meta, kind: 'invoiced', invoiceId: record.invoiceId })),
    );
  } else if (record.outcome === 'failed') {
    at(record.outcomeAtMs, () =>
      emit((meta) => ({
        ...meta,
        kind: 'failed',
        reason: 'El pago fue rechazado por el banco.',
      })),
    );
  } else {
    at(record.outcomeAtMs, () => emit((meta) => ({ ...meta, kind: 'expired' })));
  }

  return {
    close: () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
    },
  };
}
