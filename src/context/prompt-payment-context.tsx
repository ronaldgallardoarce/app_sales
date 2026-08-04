import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import {
  createPaymentIntent,
  fetchPaymentState,
  releaseReservation,
  subscribeToPayment,
  type PaymentEvent,
  type PaymentIntent,
} from '@/data/mock-prompt-payment';

/**
 * Where one prompt payment is.
 *
 * A union rather than a flag plus a bag of optional fields, because each state genuinely knows
 * different things: only a live reservation has a deadline, only a completed one has an instant it
 * was paid at, and only a rejected one has a reason. Written the other way, every screen reading
 * this would have to check fields that cannot be set yet.
 *
 * There is no separate `invoiced`: an invoiced payment is a `paid` one whose `invoiceId` has
 * arrived. Two states would be two places to ask the same question, and they could disagree.
 */
export type PromptPaymentSession =
  | { state: 'idle' }
  /** The request that reserves the stock is in flight. Nothing is held yet. */
  | { state: 'starting' }
  /** Stock is held and the client is being asked to pay. `deadlineMs` is local — see `start`. */
  | { state: 'awaiting'; intent: PaymentIntent; deadlineMs: number }
  /**
   * The countdown ran out, or the app just came back, and sales is being asked what actually
   * happened. Deliberately its own state and not a silent branch of `awaiting`: the seller is
   * standing in front of the client, and "verificando" is a different thing to say than "quedan
   * 0:00" — which is what the screen said before this existed.
   */
  | {
      state: 'verifying';
      intent: PaymentIntent;
      /**
       * Whether the last attempt to ask came back with nothing. Losing signal mid-collection is the
       * ordinary way that happens, and it is not the same as a payment that failed — nothing is
       * known either way — so it stays inside this state as something retryable rather than becoming
       * an ending.
       */
      failed: boolean;
    }
  /** The money arrived. `invoiceId` is null until the invoicing service catches up. */
  | { state: 'paid'; intent: PaymentIntent; paidAtMs: number; invoiceId: string | null }
  /** The reservation is gone and nothing was collected. */
  | { state: 'expired'; intent: PaymentIntent }
  /** The seller gave up and the stock went back before the clock ran out. */
  | { state: 'cancelled' }
  /** The payment was refused. `intent` is null when opening the payment is what failed. */
  | { state: 'failed'; intent: PaymentIntent | null; reason: string };

/** The intent a session is about, or null for the three states that are not about one. */
export function intentOf(session: PromptPaymentSession): PaymentIntent | null {
  return 'intent' in session ? session.intent : null;
}

interface PromptPaymentContextValue {
  session: PromptPaymentSession;
  /**
   * What is left of the reservation, in milliseconds, and 0 whenever nothing is held. Recomputed
   * every second while the clock runs.
   */
  remainingMs: number;
  /** Open a prompt payment: reserves the stock and returns the link and QR to collect against. */
  start: (amountBs: number) => Promise<void>;
  /** Give up, handing the stock back instead of leaving it held for the rest of the window. */
  cancel: () => Promise<void>;
  /** Ask sales what actually happened. Safe to call at any time; a no-op with nothing in flight. */
  reconcile: () => Promise<void>;
  /** Drop the session. Releases the reservation if one is somehow still live. */
  reset: () => void;
}

const PromptPaymentContext = createContext<PromptPaymentContextValue | null>(null);

/**
 * Owns the prompt payment for the order being closed: the reservation, its clock, and the single
 * subscription that tells the app how it ends.
 *
 * Lives in a provider and not on the confirm screen because the screen is the wrong lifetime for
 * it. A reservation outlives a render, has to survive the seller opening a sheet over it, and must
 * be released deliberately rather than by a component happening to unmount — a screen-owned
 * reservation is ten minutes of stock held for an order nobody is looking at.
 *
 * No screen ever touches the stream. Everything below is here so that they cannot.
 */
export function PromptPaymentProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PromptPaymentSession>({ state: 'idle' });

  /**
   * The intent every late answer is checked against.
   *
   * A ref and not the session, because the checks happen inside callbacks that were created before
   * the answer arrived: a stream repeats, a fetch resolves after the seller moved on, and both need
   * to know what is current *now* rather than what was current when they started.
   */
  const activeIntentIdRef = useRef<string | null>(null);
  /** The highest sequence already applied, so a replayed or reordered event is dropped. */
  const lastSequenceRef = useRef(0);
  /** Mirrors `session.state` for the callbacks that need it without being rebuilt on every change. */
  const stateRef = useRef<PromptPaymentSession['state']>('idle');
  /** The deadline the clock has already been checked for, so a stuck clock cannot loop on it. */
  const expiryCheckedForRef = useRef<number | null>(null);

  /** Ticks the clock. Only meaningful while a reservation is live, so only then is it updated. */
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    stateRef.current = session.state;
  }, [session.state]);

  const activeIntentId =
    session.state === 'awaiting' || session.state === 'verifying' ? session.intent.id : null;

  const remainingMs =
    session.state === 'awaiting' ? Math.max(0, session.deadlineMs - nowMs) : 0;

  /**
   * Applies one event from sales.
   *
   * Every branch here is a refusal of something the stream is allowed to do. It repeats events, it
   * delivers them out of order, and it keeps talking about intents the seller has already walked
   * away from — so the guards are the feature, not defensive noise around it.
   */
  const applyEvent = useCallback((event: PaymentEvent) => {
    if (event.intentId !== activeIntentIdRef.current) return;
    if (event.sequence <= lastSequenceRef.current) return;
    lastSequenceRef.current = event.sequence;

    setSession((prev) => {
      const intent = intentOf(prev);
      if (!intent) return prev;

      switch (event.kind) {
        case 'paid':
          // Not re-applied to a session already paid: a repeated `paid` carries `invoiceId: null`,
          // so believing it twice would take back an invoice that had already arrived.
          return prev.state === 'paid'
            ? prev
            : { state: 'paid', intent, paidAtMs: event.paidAtMs, invoiceId: event.invoiceId };

        case 'invoiced':
          // An invoice only means anything once the money has landed. Arriving against a session
          // still collecting, it is a claim about an order this one is not, and it is dropped.
          return prev.state === 'paid' ? { ...prev, invoiceId: event.invoiceId } : prev;

        case 'expired':
        case 'failed':
          // Neither may undo a payment that already arrived. An `expired` after `paid` is a late
          // note about a reservation that got consumed — not money coming back out of the till —
          // and acting on it would send the seller to collect a payment they already took.
          if (prev.state !== 'awaiting' && prev.state !== 'verifying') return prev;
          return event.kind === 'expired'
            ? { state: 'expired', intent }
            : { state: 'failed', intent, reason: event.reason };
      }
    });
  }, []);

  /**
   * Asks sales what happened, and is the reason the stream is safe to depend on at all.
   *
   * A dropped connection produces silence, and silence is indistinguishable from a client who has
   * not paid yet — so nothing in this provider concludes anything from not hearing. It asks. Called
   * when the clock runs out and whenever the app returns to the foreground having missed whatever
   * was said while it was away.
   */
  const reconcile = useCallback(async () => {
    const intentId = activeIntentIdRef.current;
    if (!intentId) return;

    setSession((prev) =>
      prev.state === 'awaiting' || prev.state === 'verifying'
        ? { state: 'verifying', intent: prev.intent, failed: false }
        : prev,
    );

    let snapshot;
    try {
      snapshot = await fetchPaymentState(intentId);
    } catch {
      /**
       * No answer, which is not an answer. The reservation is not declared gone and the payment is
       * not declared failed, because neither is known — the session stays on `verifying`, now marked
       * retryable, and the seller can ask again once they have signal.
       *
       * Concluding anything here is the mistake this whole path exists to avoid: a lost connection
       * reported as an expiry would send a seller to collect a payment the client may already have
       * made.
       */
      if (activeIntentIdRef.current !== intentId) return;
      setSession((prev) =>
        prev.state === 'verifying' ? { ...prev, failed: true } : prev,
      );
      return;
    }

    // The seller cancelled, or started another payment, while sales was answering about this one.
    if (activeIntentIdRef.current !== intentId) return;

    setSession((prev) => {
      const intent = intentOf(prev);
      if (!intent) return prev;

      // `paid` is terminal. Money that arrived does not un-arrive, and a stale snapshot must never
      // be able to send the seller back to collecting something they have already collected.
      if (prev.state === 'paid' && snapshot.state !== 'paid') return prev;

      switch (snapshot.state) {
        case 'awaiting':
          // Re-anchored on the window the service just quoted, not on the one the intent came with:
          // this reply is the only thing that knows how much of the reservation is actually left.
          return { state: 'awaiting', intent, deadlineMs: Date.now() + snapshot.expiresInMs };
        case 'paid':
          return {
            state: 'paid',
            intent,
            paidAtMs: snapshot.paidAtMs,
            invoiceId: snapshot.invoiceId,
          };
        case 'expired':
          return { state: 'expired', intent };
        case 'failed':
          return { state: 'failed', intent, reason: snapshot.reason };
      }
    });
  }, []);

  const start = useCallback(async (amountBs: number) => {
    setSession({ state: 'starting' });
    try {
      const intent = await createPaymentIntent(amountBs);
      activeIntentIdRef.current = intent.id;
      lastSequenceRef.current = 0;
      expiryCheckedForRef.current = null;
      /**
       * The deadline is anchored here, on the instant the reply arrived plus the window the service
       * quoted — never on an absolute time sent by the server. The phone's clock is not the
       * server's, and a device an hour fast would open on a countdown that had already run out.
       */
      const arrivedAtMs = Date.now();
      setNowMs(arrivedAtMs);
      setSession({ state: 'awaiting', intent, deadlineMs: arrivedAtMs + intent.ttlMs });
    } catch {
      activeIntentIdRef.current = null;
      setSession({
        state: 'failed',
        intent: null,
        reason: 'No se pudo abrir el cobro. Revisá la conexión y volvé a intentarlo.',
      });
    }
  }, []);

  const cancel = useCallback(async () => {
    const intentId = activeIntentIdRef.current;
    // Cleared before the release is even asked for, so whatever the stream is about to say about
    // this intent lands on a session that has stopped listening for it.
    activeIntentIdRef.current = null;
    setSession({ state: 'cancelled' });
    if (intentId) await releaseReservation(intentId);
  }, []);

  const reset = useCallback(() => {
    const intentId = activeIntentIdRef.current;
    const wasLive = stateRef.current === 'awaiting' || stateRef.current === 'verifying';
    activeIntentIdRef.current = null;
    setSession({ state: 'idle' });
    // Only when something was actually held, and nothing waits for the answer — there is no screen
    // left to tell. Without this, a session dropped mid-countdown would leave the rest of the
    // window's stock reserved against an order that no longer exists.
    if (intentId && wasLive) void releaseReservation(intentId);
  }, []);

  /** One subscription per intent, opened for as long as there is something to hear about. */
  useEffect(() => {
    if (!activeIntentId) return;
    const subscription = subscribeToPayment(activeIntentId, applyEvent);
    return () => subscription.close();
  }, [activeIntentId, applyEvent]);

  /** The clock. Runs only while a reservation is live, and re-reads the wall clock each tick. */
  useEffect(() => {
    if (session.state !== 'awaiting') return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session.state]);

  /**
   * The clock running out asks a question; it does not answer one.
   *
   * Reaching 0:00 locally means the app believes the window closed, which is not the same as the
   * reservation having closed — the client may have paid in the last second, and the event may
   * still be in flight. So this reconciles, and only what sales says moves the session.
   *
   * Guarded by the deadline it already checked, so a service that keeps replying "awaiting" with no
   * time left cannot turn this into a request loop.
   */
  useEffect(() => {
    if (session.state !== 'awaiting' || remainingMs > 0) return;
    if (expiryCheckedForRef.current === session.deadlineMs) return;
    expiryCheckedForRef.current = session.deadlineMs;
    void reconcile();
  }, [session, remainingMs, reconcile]);

  /**
   * Coming back from the background.
   *
   * The app was not listening while it was away — sockets do not survive being backgrounded — so
   * whatever happened to the payment in the meantime has to be asked for rather than waited on.
   */
  useEffect(() => {
    if (!activeIntentId) return;
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active') void reconcile();
    });
    return () => listener.remove();
  }, [activeIntentId, reconcile]);

  const value = useMemo(
    () => ({ session, remainingMs, start, cancel, reconcile, reset }),
    [session, remainingMs, start, cancel, reconcile, reset],
  );

  return <PromptPaymentContext.Provider value={value}>{children}</PromptPaymentContext.Provider>;
}

export function usePromptPayment() {
  const context = useContext(PromptPaymentContext);
  if (!context) throw new Error('usePromptPayment must be used inside PromptPaymentProvider');
  return context;
}

/** The remaining window as `M:SS`, the shape a countdown in front of a client has to be read in. */
export function countdownLabel(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
