import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { useColorScheme as useSystemColorScheme } from '@/hooks/use-color-scheme';

export type Scheme = 'light' | 'dark';

interface ThemeSchemeContextValue {
  scheme: Scheme;
  toggleScheme: () => void;
}

const ThemeSchemeContext = createContext<ThemeSchemeContextValue | null>(null);

export function ThemeSchemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [override, setOverride] = useState<Scheme | null>(null);
  const scheme: Scheme = override ?? (systemScheme === 'dark' ? 'dark' : 'light');

  const value = useMemo<ThemeSchemeContextValue>(
    () => ({
      scheme,
      toggleScheme: () => setOverride(scheme === 'dark' ? 'light' : 'dark'),
    }),
    [scheme],
  );

  return <ThemeSchemeContext.Provider value={value}>{children}</ThemeSchemeContext.Provider>;
}

export function useThemeSchemeContext() {
  const ctx = useContext(ThemeSchemeContext);
  if (!ctx) throw new Error('useThemeSchemeContext must be used within a ThemeSchemeProvider');
  return ctx;
}
