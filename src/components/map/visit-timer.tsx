import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useClientVisits } from '@/context/client-visit-context';
import type { VisitStatus } from '@/data/mock-clients';
import { useTheme } from '@/hooks/use-theme';

/** Visit workflow states where the visit has been closed and its total time is final. */
const TERMINAL_STATUSES: VisitStatus[] = ['trabajado', 'visitado', 'cerrado-observado'];

/** Formats an elapsed duration as `mm:ss`, or `h:mm:ss` once it passes an hour. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Shows the visit duration for a client: a live counter while the visit is
 * "iniciado", or the final elapsed time once the seller has checked out.
 * Renders nothing when there is no timing data for the client.
 */
export function VisitTimer({ clientId, status }: { clientId: string; status: VisitStatus }) {
  const theme = useTheme();
  const { startedAtOf, endedAtOf } = useClientVisits();

  const startedAt = startedAtOf(clientId);
  const endedAt = endedAtOf(clientId);
  const live = status === 'iniciado' && startedAt != null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  if (live) {
    const elapsed = now - (startedAt as number);
    return (
      <View style={[styles.chip, { backgroundColor: theme.accentAltSoft }]}>
        <Icon name="clock.fill" size={13} color={theme.accentAlt} />
        <ThemedText type="small" style={[styles.label, { color: theme.accentAlt }]}>
          En visita
        </ThemedText>
        <ThemedText type="smallBold" style={[styles.value, { color: theme.accentAlt }]}>
          {formatDuration(elapsed)}
        </ThemedText>
      </View>
    );
  }

  if (TERMINAL_STATUSES.includes(status) && startedAt != null && endedAt != null) {
    return (
      <View style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
        <Icon name="clock.fill" size={13} color={theme.textSecondary} />
        <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
          Duración
        </ThemedText>
        <ThemedText type="smallBold" style={[styles.value, { color: theme.text }]}>
          {formatDuration(endedAt - startedAt)}
        </ThemedText>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  label: {
    fontSize: 11,
  },
  value: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
