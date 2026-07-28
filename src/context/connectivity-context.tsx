import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Connectivity as the app *believes* it to be. This is a mock: the flag is only
 * ever moved by the seller's own "Modo offline" switch on the home screen, and
 * nothing here listens to the device's real network state. Treat it as a demo of
 * the offline workflow, not as a source of truth about the radio — anything that
 * needs real detection has to be wired to a network API first.
 */
interface ConnectivityContextValue {
  offline: boolean;
  setOffline: (offline: boolean) => void;
}

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(false);

  const value = useMemo(() => ({ offline, setOffline }), [offline]);

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) throw new Error('useConnectivity must be used within a ConnectivityProvider');
  return ctx;
}
