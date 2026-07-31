import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { VisitTimer } from '@/components/client/visit-timer';
import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useClientVisits } from '@/context/client-visit-context';
import { useTheme } from '@/hooks/use-theme';

/**
 * Card under the header naming what is still open, and the one-tap way to end it.
 *
 * It exists because an order no longer has to be the end of the visit: the seller can confirm one
 * and stay inside for a task. That freedom is what creates the failure it guards against — the
 * seller walks out, the visit never closes, and a twelve-minute call is recorded as a four-hour
 * one. A running clock under the header of every screen they pass through is a cheaper fix than
 * any amount of geofencing, and the only one that works with the phone in a pocket and no signal.
 *
 * Placed by the screen rather than mounted once at the root, which is the price of sitting under
 * a header: headers belong to screens and no two are the same height. The screens that show it are
 * the ones the seller passes through *between* clients — a client's own screens leave it out,
 * because the visit is the thing they are already about and their header carries the same timer.
 *
 * Renders nothing when there is no visit open, so a screen can drop it in unconditionally.
 */
export function ActiveVisitBar() {
  const theme = useTheme();
  const router = useRouter();
  const { clients, openVisits, markVisitDone } = useClientVisits();
  const [listOpen, setListOpen] = useState(false);

  const rows = openVisits.map(({ clientId, visit }) => ({
    clientId,
    name: clients.find((c) => c.id === clientId)?.name ?? 'Cliente',
    /** A visit that sold or worked can be closed from here; one that did neither owes a reason. */
    productive: visit.activity.ordered || visit.activity.tasksDone,
  }));

  const visible = rows.length > 0;
  const many = rows.length > 1;
  // Closes itself the moment it is down to one visit: the card underneath already names that one,
  // and a sheet listing a single row says strictly less than the thing that opened it.
  const sheetOpen = listOpen && many;

  // Breathing ring around the dot. Runs off the native driver and stops with the card, so a closed
  // visit leaves no animation looping behind an unmounted view.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  if (!visible) return null;

  /**
   * Ends the visit where it stands when it earned that, and otherwise hands the seller to the
   * client's own screen with the reason-and-photo sheet already up. It never closes silently, and
   * it never does nothing.
   */
  const finish = (clientId: string, productive: boolean) => {
    if (productive) {
      markVisitDone(clientId);
      return;
    }
    setListOpen(false);
    router.push({ pathname: '/client/[id]', params: { id: clientId, exit: '1' } } as Href);
  };

  const openClient = (clientId: string) => {
    setListOpen(false);
    router.push({ pathname: '/client/[id]', params: { id: clientId } } as Href);
  };

  const single = rows[0];

  return (
    <>
      <View style={styles.wrap}>
        {many ? (
          /* No clock on this one. The elapsed time belongs to a visit, and this card stands for
             several — a single figure here would have to pick one of them and would read as if it
             described all. The count is what the seller needs to know at a glance; the times are
             one tap away, next to the client each belongs to. */
          <Pressable
            onPress={() => setListOpen(true)}
            style={[
              styles.card,
              { backgroundColor: theme.accentAltSoft, borderColor: theme.accentAlt },
            ]}>
            <Pulse pulse={pulse} />
            <ThemedText type="smallBold" numberOfLines={1} style={[styles.name, { color: theme.accentAlt }]}>
              {rows.length} clientes en visita
            </ThemedText>
            <Icon name="chevron.down" size={15} color={theme.accentAlt} />
          </Pressable>
        ) : (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.accentAltSoft, borderColor: theme.accentAlt },
            ]}>
            <Pulse pulse={pulse} />
            <Pressable onPress={() => openClient(single.clientId)} style={styles.identity}>
              <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={[styles.nameInline, { color: theme.accentAlt }]}>
                {single.name}
              </ThemedText>
            </Pressable>
            <VisitTimer clientId={single.clientId} compact />
            <FinishButton
              productive={single.productive}
              onPress={() => finish(single.clientId, single.productive)}
            />
          </View>
        )}
      </View>

      {/* One row per open visit, each with the only two things that differ between them: how long
          it has been running, and what it will take to close it. */}
      <BottomSheet visible={sheetOpen} onClose={() => setListOpen(false)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { backgroundColor: theme.accentAltSoft }]}>
              <Icon name="clock.fill" size={22} color={theme.accentAlt} />
            </View>
            <View style={styles.sheetHeaderText}>
              <ThemedText type="smallBold" style={styles.sheetTitle}>
                Visitas abiertas
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {rows.length} clientes sin cerrar
              </ThemedText>
            </View>
          </View>

          <View style={styles.sheetRows}>
            {rows.map((row) => (
              <View
                key={row.clientId}
                style={[styles.sheetRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Pressable onPress={() => openClient(row.clientId)} style={styles.identity}>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.sheetName}>
                    {row.name}
                  </ThemedText>
                </Pressable>
                <VisitTimer clientId={row.clientId} compact />
                <FinishButton
                  productive={row.productive}
                  onPress={() => finish(row.clientId, row.productive)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </BottomSheet>
    </>
  );
}

/** The live dot: a solid centre with a ring breathing out of it. */
function Pulse({ pulse }: { pulse: Animated.Value }) {
  const theme = useTheme();
  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: theme.accentAlt,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          },
        ]}
      />
      <View style={[styles.dot, { backgroundColor: theme.accentAlt }]} />
    </View>
  );
}

/**
 * Green and immediate once the visit earned its close, red and owing an explanation until then.
 * The colour is the whole message: the seller learns in one visit which kind of exit this is.
 */
function FinishButton({ productive, onPress }: { productive: boolean; onPress: () => void }) {
  const theme = useTheme();
  const tone = productive ? theme.success : theme.danger;

  return (
    <Pressable onPress={onPress} style={[styles.finish, { backgroundColor: tone }]}>
      <Icon name={productive ? 'checkmark' : 'door.exit'} size={13} color={theme.onAccent} />
      <ThemedText type="smallBold" style={[styles.finishLabel, { color: theme.onAccent }]}>
        {productive ? 'Finalizar' : 'Salir'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: 6,
    // Tight on purpose: this card sits between the header and the screen's own controls on every
    // screen outside a visit, and every point it takes is a point the content below does not get.
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  identity: {
    flex: 1,
    // Centres its text against the taller things beside it — the timer chip and the button both
    // stand higher than a 16pt line, and without this the name sits at the top of the gap.
    justifyContent: 'center',
  },
  /** The name as a direct child of the row: takes the slack itself. */
  name: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  /** The name inside `identity`, which already took the slack — flexing again would stretch the
      text box to the row's height and strand the glyphs at the top of it. */
  nameInline: {
    fontSize: 12,
    lineHeight: 16,
  },
  pulseWrap: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
  },
  finish: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    // A fixed height rather than padding around the label: the button was the tallest thing in
    // the row and so it, not the text, was setting how much of the screen the card took.
    height: 24,
    paddingHorizontal: 9,
    borderRadius: Radius.sm,
  },
  finishLabel: {
    fontSize: 11,
  },
  sheet: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    gap: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderText: {
    flex: 1,
    gap: 1,
  },
  sheetTitle: {
    fontSize: 15,
  },
  sheetRows: {
    gap: 4,
    paddingTop: Spacing.one,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.two,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  sheetName: {
    fontSize: 13,
    lineHeight: 17,
  },
});
