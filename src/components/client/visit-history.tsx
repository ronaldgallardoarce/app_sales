import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { visitDuration, type Visit } from '@/context/client-visit-context';
import { useTheme } from '@/hooks/use-theme';
import type { ThemeColor } from '@/constants/theme';

/** The clock time a visit started or ended, e.g. "09:24". */
function clockLabel(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** How long it lasted, in the units a seller says out loud: "12 min", "1 h 05 min". */
function durationLabel(ms: number): string {
  const minutes = Math.max(Math.floor(ms / 60_000), 0);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')} min`;
}

/** How a visit ended, which is the only thing that distinguishes one row from the next. */
function outcomeOf(visit: Visit): { label: string; icon: IconName; color: ThemeColor } {
  // An open visit keeps the in-progress amber whatever it has achieved — the row is about how the
  // visit ended, and this one has not — but it says what it already has, because an order no
  // longer closes the visit and "En curso" alone would hide the sale it already made.
  if (visit.endedAt === null) {
    if (visit.activity.ordered) return { label: 'En curso · con pedido', icon: 'cart', color: 'accentAlt' };
    if (visit.activity.tasksDone) {
      return { label: 'En curso · tareas realizadas', icon: 'list.bullet', color: 'accentAlt' };
    }
    return { label: 'En curso', icon: 'clock.fill', color: 'accentAlt' };
  }
  if (visit.activity.ordered) return { label: 'Con pedido', icon: 'cart', color: 'success' };
  if (visit.exit) {
    return {
      // The reason itself, not "salida excepcional": the seller wrote it down precisely so the
      // next person reading the day knows which of the reasons it was.
      label: visit.exit.reason,
      icon: 'door.exit',
      color: visit.activity.tasksDone ? 'violet' : 'danger',
    };
  }
  if (visit.activity.tasksDone) return { label: 'Tareas realizadas', icon: 'list.bullet', color: 'violet' };
  return { label: 'Sin actividad', icon: 'minus', color: 'textSecondary' };
}

/**
 * Today's visits to this client, oldest first.
 *
 * Exists because a second visit is now a second record rather than an extension of the first, and
 * a seller about to open one should be able to see what the earlier ones already achieved — coming
 * back for a task that was done at nine in the morning is the mistake this prevents. It also makes
 * the rule visible: the moment an order closes a visit, the visit shows up here as closed.
 */
export function VisitHistory({ visits }: { visits: Visit[] }) {
  const theme = useTheme();
  if (visits.length === 0) return null;

  return (
    <View style={styles.list}>
      {visits.map((visit, index) => {
        const outcome = outcomeOf(visit);
        const tone = theme[outcome.color];
        return (
          <View
            key={visit.startedAt}
            style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" style={styles.badgeText}>
                {index + 1}
              </ThemedText>
            </View>

            <View style={styles.texts}>
              <ThemedText type="smallBold" numberOfLines={1} style={styles.hours}>
                {clockLabel(visit.startedAt)}
                {visit.endedAt !== null ? ` – ${clockLabel(visit.endedAt)}` : ''}
                {'  ·  '}
                {durationLabel(visitDuration(visit))}
              </ThemedText>
              <View style={styles.outcomeRow}>
                <Icon name={outcome.icon} size={11} color={tone} />
                <ThemedText numberOfLines={1} style={[styles.outcomeText, { color: tone }]}>
                  {outcome.label}
                </ThemedText>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
  },
  texts: {
    flex: 1,
    gap: 1,
  },
  hours: {
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  outcomeText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
});
