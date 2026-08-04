import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { mapClients, type MapClient, type VisitStatus } from '@/data/mock-clients';

/** Justification captured when the seller leaves without placing an order. */
export type ExitRecord = { reason: string; photos: string[] };

/** What the seller did during one visit — drives how it closed. */
export type VisitActivity = { tasksDone: boolean; ordered: boolean };

/**
 * Whether a visit may be closed with one tap and no explanation.
 *
 * Only an order earns that. A completed task is real work and stays on the record as such — an
 * exceptional exit from a visit with tasks still leaves the client "trabajado", not
 * "cerrado-observado" — but it is not what the seller came to do. "I left without selling because
 * I did a task" is precisely the sentence supervision needs to read in the seller's own words,
 * and a green button that closes the visit silently is what stops it ever being written.
 *
 * Exported and used by every caller instead of each screen spelling the condition out: this rule
 * used to live in three places, and the exit bar and the client screen could disagree about which
 * of the two exits the seller was owed.
 */
export function visitEarnedClose(activity: VisitActivity | undefined): boolean {
  return activity?.ordered ?? false;
}

/**
 * One on-site visit: opened by a check-in, closed by an order or an exceptional exit.
 *
 * A list of these per client rather than a single pair of timestamps, because a seller can come
 * back the same day — the owner was out, a document was missing, the client called again — and the
 * second call is a second visit, not a continuation of the first. Folding it into the first one
 * rewrote a record the supervisor reads: a twelve-minute visit became a three-hour one because the
 * seller walked past again after lunch.
 */
export type Visit = {
  startedAt: number;
  /** Epoch ms when it closed, or null while the seller is still inside. */
  endedAt: number | null;
  activity: VisitActivity;
  /** Present only on a visit that ended without an order. */
  exit?: ExitRecord;
};

interface ClientVisitContextValue {
  /** `mapClients` with each client's live (possibly overridden) status applied. */
  clients: MapClient[];
  statusOf: (clientId: string) => VisitStatus;
  /** Every visit to this client today, oldest first. */
  visitsOf: (clientId: string) => Visit[];
  /**
   * Every visit open right now, oldest first, each with the client it belongs to — what a screen
   * needs when it has no client of its own to ask about. The map, the orders list and the home
   * screen all want the same answer ("is the seller inside anyone?") and none of them knows whose
   * id to pass to `openVisitOf`.
   *
   * A list and not a single visit even though one at a time is the only sane state: check-in can
   * leave a second one open behind the seller's back, and until something can show those they are
   * invisible and un-closable. Oldest first because that is the order they need attention in — the
   * one that has been running longest is the one most likely to be a visit nobody is inside.
   */
  openVisits: { clientId: string; visit: Visit }[];
  /** The visit the seller is inside right now, or null when they are not in one. */
  openVisitOf: (clientId: string) => Visit | null;
  /** The one worth showing: the open visit, or the last closed one. */
  currentVisitOf: (clientId: string) => Visit | null;
  /** The current visit's activity, or an empty one when the client has never been visited. */
  activityOf: (clientId: string) => VisitActivity;
  exitOf: (clientId: string) => ExitRecord | undefined;
  /** Seller checked in on-site → opens a visit and the client reads "iniciado". */
  markEntry: (clientId: string) => void;
  /** Seller completed at least one task during the open visit. */
  markTasksDone: (clientId: string) => void;
  /**
   * Seller placed an order → the client becomes "visitado".
   *
   * Leaves the visit open unless asked to close it. An order used to end the visit on its own,
   * which meant a seller who still had a task to do had to check in all over again — and, worse,
   * that the record put the end of the visit at the order rather than at the door: ten more
   * minutes on site simply vanished.
   *
   * `closeVisit` is part of this call and not a second one because the two happen together, from
   * one button, and a separate close would read the visit before this update had landed — finding
   * no order on it and refusing.
   */
  markOrder: (clientId: string, options?: { closeVisit?: boolean }) => void;
  /**
   * Ordinary end of a productive visit: closes it on the strength of what it already achieved,
   * with no reason and no photo. Refuses a visit that achieved nothing — that one is an
   * exceptional exit and owes a justification, and enforcing it here rather than only in the
   * screen means no future caller can route around the rule.
   */
  markVisitDone: (clientId: string) => void;
  /** Exceptional exit → "trabajado" if tasks were done, else "cerrado-observado". */
  markExceptionalExit: (clientId: string, record: ExitRecord) => void;
}

const EMPTY_ACTIVITY: VisitActivity = { tasksDone: false, ordered: false };

/** Shared empty list, so `visitsOf` on an unvisited client returns a stable identity. */
const NO_VISITS: Visit[] = [];

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
 * Seed one visit for the clients that already start in a visited state, so they show a realistic
 * timer and history without any in-session interaction. Computed once at module load: "iniciado"
 * clients get an open visit that keeps ticking, closed clients get a finished one whose activity
 * matches the status they were seeded with.
 *
 * Three clients seed as "iniciado", so the app starts with three visits open at once. That is not
 * a state a seller should be able to reach — they are inside one client at a time — but it is the
 * state the in-visit bar exists to make visible and closable, so the seed keeps it.
 */
function seedVisits(): Record<string, Visit[]> {
  const seeded: Record<string, Visit[]> = {};
  const now = Date.now();

  mapClients.forEach((c) => {
    // Off-route clients read as "no-visitado" until touched in-session, so their
    // seeded status carries no visit.
    if (!c.visitToday) return;

    if (c.status === 'iniciado') {
      const elapsed = (3 + Math.floor(seededUnit(`${c.id}:e`) * 37)) * MINUTE;
      seeded[c.id] = [{ startedAt: now - elapsed, endedAt: null, activity: EMPTY_ACTIVITY }];
      return;
    }

    if (c.status === 'trabajado' || c.status === 'visitado' || c.status === 'cerrado-observado') {
      const duration = (8 + Math.floor(seededUnit(`${c.id}:d`) * 40)) * MINUTE;
      const endedAgo = (10 + Math.floor(seededUnit(`${c.id}:a`) * 180)) * MINUTE;
      const endedAt = now - endedAgo;
      seeded[c.id] = [
        {
          startedAt: endedAt - duration,
          endedAt,
          activity: {
            tasksDone: c.status === 'trabajado',
            ordered: c.status === 'visitado',
          },
        },
      ];
    }
  });

  return seeded;
}

const SEED_VISITS = seedVisits();

const ClientVisitContext = createContext<ClientVisitContextValue | null>(null);

export function ClientVisitProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<Record<string, VisitStatus>>({});
  const [visits, setVisits] = useState<Record<string, Visit[]>>(SEED_VISITS);

  const visitsOf = useCallback((clientId: string) => visits[clientId] ?? NO_VISITS, [visits]);

  const currentVisitOf = useCallback(
    (clientId: string): Visit | null => {
      const list = visits[clientId];
      return list && list.length > 0 ? list[list.length - 1] : null;
    },
    [visits],
  );

  const openVisitOf = useCallback(
    (clientId: string): Visit | null => {
      const current = currentVisitOf(clientId);
      return current && current.endedAt === null ? current : null;
    },
    [currentVisitOf],
  );

  /**
   * The open visits, whoever they belong to. Scans rather than tracking ids in state of its own,
   * so it cannot drift out of sync with the visit list it describes — every close already writes
   * an `endedAt` there, and a second source of truth would need every one of them to remember it.
   */
  const openVisits = useMemo<{ clientId: string; visit: Visit }[]>(() => {
    const open: { clientId: string; visit: Visit }[] = [];
    for (const clientId of Object.keys(visits)) {
      const list = visits[clientId];
      const last = list[list.length - 1];
      if (last && last.endedAt === null) open.push({ clientId, visit: last });
    }
    return open.sort((a, b) => a.visit.startedAt - b.visit.startedAt);
  }, [visits]);

  const activityOf = useCallback(
    (clientId: string): VisitActivity => currentVisitOf(clientId)?.activity ?? EMPTY_ACTIVITY,
    [currentVisitOf],
  );

  const exitOf = useCallback(
    (clientId: string): ExitRecord | undefined => currentVisitOf(clientId)?.exit,
    [currentVisitOf],
  );

  /**
   * Applies a change to the client's open visit, and does nothing when there is none.
   *
   * The no-op case is the remote order: it is placed without ever checking in, so there is no
   * visit for it to belong to. Creating one here to have somewhere to write would invent an
   * on-site call that never happened — the exact record the geofence exists to protect.
   */
  const updateOpenVisit = useCallback((clientId: string, update: (visit: Visit) => Visit) => {
    setVisits((prev) => {
      const list = prev[clientId];
      if (!list || list.length === 0) return prev;
      const last = list[list.length - 1];
      if (last.endedAt !== null) return prev;
      return { ...prev, [clientId]: [...list.slice(0, -1), update(last)] };
    });
  }, []);

  const statusOf = useCallback(
    (clientId: string): VisitStatus => statuses[clientId] ?? defaultStatusFor(clientId),
    [statuses],
  );

  /**
   * Opens a visit, and refuses to open a second one on top of an open one — check-in is reachable
   * from a screen the seller can walk back into, and two visits for one arrival would be a
   * duplicate in the supervisor's count.
   *
   * The status goes back to "iniciado" even for a client that already closed a visit today, and
   * that is not a downgrade: it says the seller is inside right now, which is true and is what the
   * map is for. Whatever the visit ends as overwrites it a moment later.
   */
  const markEntry = useCallback((clientId: string) => {
    setVisits((prev) => {
      const list = prev[clientId] ?? NO_VISITS;
      const last = list[list.length - 1];
      if (last && last.endedAt === null) return prev;
      return {
        ...prev,
        [clientId]: [...list, { startedAt: Date.now(), endedAt: null, activity: EMPTY_ACTIVITY }],
      };
    });
    setStatuses((prev) => ({ ...prev, [clientId]: 'iniciado' }));
  }, []);

  const markTasksDone = useCallback(
    (clientId: string) =>
      updateOpenVisit(clientId, (visit) => ({
        ...visit,
        activity: { ...visit.activity, tasksDone: true },
      })),
    [updateOpenVisit],
  );

  const markOrder = useCallback(
    (clientId: string, options?: { closeVisit?: boolean }) => {
      const closedAt = Date.now();
      updateOpenVisit(clientId, (visit) => ({
        ...visit,
        endedAt: options?.closeVisit ? closedAt : visit.endedAt,
        activity: { ...visit.activity, ordered: true },
      }));
      // Set outside the visit update because it is also the remote order's only effect: no visit
      // was open, nothing closed, and the client still sold something today.
      setStatuses((prev) => ({ ...prev, [clientId]: 'visitado' }));
    },
    [updateOpenVisit],
  );

  /**
   * Ends a visit that already did its job. No reason and no photo, because there is nothing to
   * explain: the order is the evidence, and it is the only thing that counts as one.
   *
   * Refuses anything else. A visit that leaves without an order goes through
   * `markExceptionalExit` and cannot be waved through from a one-tap button.
   */
  const markVisitDone = useCallback(
    (clientId: string) => {
      if (!visitEarnedClose(openVisitOf(clientId)?.activity)) return;
      updateOpenVisit(clientId, (visit) => ({ ...visit, endedAt: Date.now() }));
      setStatuses((prev) => ({ ...prev, [clientId]: 'visitado' }));
    },
    [openVisitOf, updateOpenVisit],
  );

  const markExceptionalExit = useCallback(
    (clientId: string, record: ExitRecord) => {
      const tasksDone = openVisitOf(clientId)?.activity.tasksDone ?? false;
      updateOpenVisit(clientId, (visit) => ({ ...visit, endedAt: Date.now(), exit: record }));
      setStatuses((prev) => ({
        ...prev,
        [clientId]: tasksDone ? 'trabajado' : 'cerrado-observado',
      }));
    },
    [openVisitOf, updateOpenVisit],
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
      visitsOf,
      openVisits,
      openVisitOf,
      currentVisitOf,
      activityOf,
      exitOf,
      markEntry,
      markTasksDone,
      markOrder,
      markVisitDone,
      markExceptionalExit,
    }),
    [
      clients,
      statusOf,
      visitsOf,
      openVisits,
      openVisitOf,
      currentVisitOf,
      activityOf,
      exitOf,
      markEntry,
      markTasksDone,
      markOrder,
      markVisitDone,
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

/** How long a visit lasted, or has lasted so far. */
export function visitDuration(visit: Visit, now: number = Date.now()): number {
  return (visit.endedAt ?? now) - visit.startedAt;
}
