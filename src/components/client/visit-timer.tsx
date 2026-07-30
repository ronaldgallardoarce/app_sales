import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useClientVisits, visitDuration } from '@/context/client-visit-context';
import { useTheme } from '@/hooks/use-theme';

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
 * Shows the duration of the client's current visit: a live counter while the seller is inside,
 * or the final elapsed time once it closed. Renders nothing for a client with no visits.
 *
 * Reads the visit rather than the status, which is what lets it tell a returning seller's second
 * visit from the first one it replaced: the status is a summary of the day, the visit is the
 * thing being timed.
 *
 * `compact` drops the icon and caption so the timer fits a screen header row
 * without competing with the title.
 */
export function VisitTimer({ clientId, compact = false }: { clientId: string; compact?: boolean }) {
  const theme = useTheme();
  const { currentVisitOf } = useClientVisits();

  const visit = currentVisitOf(clientId);
  const live = visit !== null && visit.endedAt === null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  if (!visit) return null;

  const duration = visitDuration(visit, now);
  const tone = live ? theme.accentAlt : theme.textSecondary;
  const soft = live ? theme.accentAltSoft : theme.backgroundSelected;

  if (compact) {
    return (
      <View style={[styles.compactChip, { backgroundColor: soft }]}>
        <ThemedText type="smallBold" style={[styles.compactValue, { color: tone }]}>
          {formatDuration(duration)}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.chip, { backgroundColor: soft }]}>
      <Icon name="clock.fill" size={13} color={tone} />
      <ThemedText type="small" style={[styles.label, { color: tone }]}>
        {live ? 'En visita' : 'Duración'}
      </ThemedText>
      <ThemedText type="smallBold" style={[styles.value, { color: live ? tone : theme.text }]}>
        {formatDuration(duration)}
      </ThemedText>
    </View>
  );
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
  compactChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  compactValue: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
