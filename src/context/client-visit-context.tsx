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

const ClientVisitContext = createContext<ClientVisitContextValue | null>(null);

export function ClientVisitProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<Record<string, VisitStatus>>({});
  const [activity, setActivity] = useState<Record<string, VisitActivity>>({});
  const [exits, setExits] = useState<Record<string, ExitRecord>>({});
  const [startedAt, setStartedAt] = useState<Record<string, number>>({});

  const startedAtOf = useCallback((clientId: string) => startedAt[clientId], [startedAt]);

  const startVisitTimer = useCallback((clientId: string) => {
    setStartedAt((prev) => (prev[clientId] ? prev : { ...prev, [clientId]: Date.now() }));
  }, []);

  const statusOf = useCallback(
    (clientId: string): VisitStatus => statuses[clientId] ?? BASE_STATUS[clientId] ?? 'no-visitado',
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
        const current = prev[clientId] ?? BASE_STATUS[clientId];
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
      setStatuses((prev) => ({ ...prev, [clientId]: 'visitado' }));
    },
    [updateActivity],
  );

  const markExceptionalExit = useCallback(
    (clientId: string, record: ExitRecord) => {
      setExits((prev) => ({ ...prev, [clientId]: record }));
      setStatuses((prev) => {
        const tasksDone = activity[clientId]?.tasksDone ?? false;
        return { ...prev, [clientId]: tasksDone ? 'trabajado' : 'cerrado-observado' };
      });
    },
    [activity],
  );

  const clients = useMemo(
    () => mapClients.map((c) => (statuses[c.id] ? { ...c, status: statuses[c.id] } : c)),
    [statuses],
  );

  const value = useMemo(
    () => ({
      clients,
      statusOf,
      activityOf,
      exitOf,
      startedAtOf,
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
