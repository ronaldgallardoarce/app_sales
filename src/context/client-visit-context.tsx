import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { mapClients, type MapClient, type VisitStatus } from '@/data/mock-clients';

/** Justification captured when the seller leaves without placing an order. */
export type ExitRecord = { reason: string; photos: string[] };

/** What the seller did during the current visit — drives the exit status. */
export type VisitActivity = { entered: boolean; tasksDone: boolean; ordered: boolean };

interface ClientVisitContextValue {
  /** `mapClients` with each client's live (possibly overridden) status applied. */
  clients: MapClient[];
  statusOf: (clientId: string) => VisitStatus;
  activityOf: (clientId: string) => VisitActivity;
  exitOf: (clientId: string) => ExitRecord | undefined;
  /** Epoch ms when the on-site visit started, or undefined if not started. */
  startedAtOf: (clientId: string) => number | undefined;
  /** Epoch ms when the visit was closed (order or exceptional exit), or undefined if still open. */
  endedAtOf: (clientId: string) => number | undefined;
  /** Start the visit timer once (no-op if already running for this client). */
  startVisitTimer: (clientId: string) => void;
  /** Seller checked in on-site → client becomes "iniciado". */
  markEntry: (clientId: string) => void;
  /** Seller completed at least one task during the visit. */
  markTasksDone: (clientId: string) => void;
  /** Seller placed an order → client becomes "visitado" (happy-path close). */
  markOrder: (clientId: string) => void;
  /** Exceptional exit → "trabajado" if tasks were done, else "cerrado-observado". */
  markExceptionalExit: (clientId: string, record: ExitRecord) => void;
}

const EMPTY_ACTIVITY: VisitActivity = { entered: false, tasksDone: false, ordered: false };

/** Seed statuses from the mock data, indexed for O(1) lookup. */
const BASE_STATUS: Record<string, VisitStatus> = Object.fromEntries(
  mapClients.map((c) => [c.id, c.status]),
);

/** Whether each client belongs to today's planned route, indexed for O(1) lookup. */
const VISIT_TODAY: Record<string, boolean> = Object.fromEntries(
  mapClients.map((c) => [c.id, c.visitToday]),
);

/**
 * The status a client shows before any in-session visit action. A client that
 * is NOT on today's route reads as "no-visitado" regardless of its seeded
 * status: that status belongs to another day's visit and does not apply to
 * today's workflow. On-route clients keep their seeded status.
 */
function defaultStatusFor(clientId: string): VisitStatus {
  if (VISIT_TODAY[clientId]) return BASE_STATUS[clientId] ?? 'no-visitado';
  return 'no-visitado';
}

const MINUTE = 60_000;

/** Deterministic pseudo-random in [0, 1) from a string seed, stable across renders. */
function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Seed visit timestamps so clients that already start in a visited state show a
 * realistic timer without any in-session interaction. Computed once at module
 * load: "iniciado" clients get an open timer that keeps ticking; closed clients
 * get a fixed start/end pair.
 */
function seedVisitTimestamps(): {
  started: Record<string, number>;
  ended: Record<string, number>;
} {
  const started: Record<string, number> = {};
  const ended: Record<string, number> = {};
  const now = Date.now();

  mapClients.forEach((c) => {
    // Off-route clients read as "no-visitado" until touched in-session, so their
    // seeded status carries no timer.
    if (!c.visitToday) return;
    if (c.status === 'iniciado') {
      const elapsed = (3 + Math.floor(seededUnit(`${c.id}:e`) * 37)) * MINUTE;
      started[c.id] = now - elapsed;
    } else if (
      c.status === 'trabajado' ||
      c.status === 'visitado' ||
      c.status === 'cerrado-observado'
    ) {
      const duration = (8 + Math.floor(seededUnit(`${c.id}:d`) * 40)) * MINUTE;
      const endedAgo = (10 + Math.floor(seededUnit(`${c.id}:a`) * 180)) * MINUTE;
      ended[c.id] = now - endedAgo;
      started[c.id] = ended[c.id] - duration;
    }
  });

  return { started, ended };
}

const SEED_TIMESTAMPS = seedVisitTimestamps();

const ClientVisitContext = createContext<ClientVisitContextValue | null>(null);

export function ClientVisitProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<Record<string, VisitStatus>>({});
  const [activity, setActivity] = useState<Record<string, VisitActivity>>({});
  const [exits, setExits] = useState<Record<string, ExitRecord>>({});
  const [startedAt, setStartedAt] = useState<Record<string, number>>(SEED_TIMESTAMPS.started);
  const [endedAt, setEndedAt] = useState<Record<string, number>>(SEED_TIMESTAMPS.ended);

  const startedAtOf = useCallback((clientId: string) => startedAt[clientId], [startedAt]);

  const endedAtOf = useCallback((clientId: string) => endedAt[clientId], [endedAt]);

  const markVisitEnd = useCallback((clientId: string) => {
    setEndedAt((prev) => (prev[clientId] ? prev : { ...prev, [clientId]: Date.now() }));
  }, []);

  const startVisitTimer = useCallback((clientId: string) => {
    setStartedAt((prev) => (prev[clientId] ? prev : { ...prev, [clientId]: Date.now() }));
  }, []);

  const statusOf = useCallback(
    (clientId: string): VisitStatus => statuses[clientId] ?? defaultStatusFor(clientId),
    [statuses],
  );

  const activityOf = useCallback(
    (clientId: string): VisitActivity => activity[clientId] ?? EMPTY_ACTIVITY,
    [activity],
  );

  const exitOf = useCallback((clientId: string): ExitRecord | undefined => exits[clientId], [exits]);

  const updateActivity = useCallback((clientId: string, patch: Partial<VisitActivity>) => {
    setActivity((prev) => ({
      ...prev,
      [clientId]: { ...(prev[clientId] ?? EMPTY_ACTIVITY), ...patch },
    }));
  }, []);

  const markEntry = useCallback(
    (clientId: string) => {
      updateActivity(clientId, { entered: true });
      startVisitTimer(clientId);
      // Starting a visit moves a not-yet-visited client to "iniciado"; never
      // downgrade a client that already reached a terminal state.
      setStatuses((prev) => {
        const current = prev[clientId] ?? defaultStatusFor(clientId);
        return current === 'no-visitado' ? { ...prev, [clientId]: 'iniciado' } : prev;
      });
    },
    [updateActivity, startVisitTimer],
  );

  const markTasksDone = useCallback(
    (clientId: string) => updateActivity(clientId, { tasksDone: true }),
    [updateActivity],
  );

  const markOrder = useCallback(
    (clientId: string) => {
      updateActivity(clientId, { ordered: true });
      markVisitEnd(clientId);
      setStatuses((prev) => ({ ...prev, [clientId]: 'visitado' }));
    },
    [updateActivity, markVisitEnd],
  );

  const markExceptionalExit = useCallback(
    (clientId: string, record: ExitRecord) => {
      setExits((prev) => ({ ...prev, [clientId]: record }));
      markVisitEnd(clientId);
      setStatuses((prev) => {
        const tasksDone = activity[clientId]?.tasksDone ?? false;
        return { ...prev, [clientId]: tasksDone ? 'trabajado' : 'cerrado-observado' };
      });
    },
    [activity, markVisitEnd],
  );

  const clients = useMemo(
    () =>
      mapClients.map((c) => {
        const status = statuses[c.id] ?? defaultStatusFor(c.id);
        return status === c.status ? c : { ...c, status };
      }),
    [statuses],
  );

  const value = useMemo(
    () => ({
      clients,
      statusOf,
      activityOf,
      exitOf,
      startedAtOf,
      endedAtOf,
      startVisitTimer,
      markEntry,
      markTasksDone,
      markOrder,
      markExceptionalExit,
    }),
    [
      clients,
      statusOf,
      activityOf,
      exitOf,
      startedAtOf,
      endedAtOf,
      startVisitTimer,
      markEntry,
      markTasksDone,
      markOrder,
      markExceptionalExit,
    ],
  );

  return <ClientVisitContext.Provider value={value}>{children}</ClientVisitContext.Provider>;
}

export function useClientVisits() {
  const ctx = useContext(ClientVisitContext);
  if (!ctx) throw new Error('useClientVisits must be used within a ClientVisitProvider');
  return ctx;
}
