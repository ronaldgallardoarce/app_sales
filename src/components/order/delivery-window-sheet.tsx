import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { TimeWheel } from '@/components/ui/time-wheel';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import {
  DELIVERY_DAY_HOURS,
  DELIVERY_FROM_HOURS,
  DELIVERY_TO_HOURS,
  DELIVERY_WHEEL_STEP_MINUTES,
  DELIVERY_WINDOWS,
  deliveryWindowLabelFor,
  deliveryWindowSpan,
  minutesOfTime,
  type DeliveryWindow,
} from '@/data/mock-order-details';
import { useTheme } from '@/hooks/use-theme';

/** The presets worth a single tap, filtered once: the list itself never changes. */
const QUICK_WINDOWS = DELIVERY_WINDOWS.filter((window) => window.quick);

const FIRST_MINUTES = minutesOfTime(DELIVERY_DAY_HOURS[0]);
/** The last hour the "Desde" wheel carries — one step short of closing, by construction. */
const LAST_FROM_MINUTES = minutesOfTime(DELIVERY_FROM_HOURS[DELIVERY_FROM_HOURS.length - 1]);

/** The range being built. Both ends are always set, which is what makes it always applicable. */
type DraftRange = { from: string; to: string };

/** The hour nearest a minute-of-day, on the full grid and clamped to the delivery day. */
function hourAt(minutes: number): string {
  const index = Math.round((minutes - FIRST_MINUTES) / DELIVERY_WHEEL_STEP_MINUTES);
  return DELIVERY_DAY_HOURS[Math.min(Math.max(index, 0), DELIVERY_DAY_HOURS.length - 1)];
}

/**
 * The rule that keeps the range valid, and it is a push rather than a limit.
 *
 * Two wheels spin independently and neither one knows about the other, so nothing stops the seller
 * from dragging "Desde" through "Hasta". Rather than refuse the gesture there, the end being
 * dragged goes wherever it is taken and shoves the other one out of the way by a single step.
 * Nothing is ever rejected, and the only moment the far end moves at all is the moment it would
 * otherwise have been crossed.
 *
 * Two alternatives were tried and are worth naming, because both are worse for the same reason.
 * Carrying the far end along to preserve the *length* of the window means a seller nudging the
 * opening half an hour later silently gets a closing half an hour later too — a change they did
 * not ask for and would not read back to the client. Stopping the dragged end one step short of
 * the other keeps the hours honest but refuses the gesture, so rebuilding 08:00–10:00 into
 * 14:00–16:00 forces the ends to be moved in the right order. The push has neither cost: the far
 * end holds still until it is actually in the way, and no drag is ever turned down.
 */
function withFrom(range: DraftRange, next: string): DraftRange {
  const floor = minutesOfTime(next) + DELIVERY_WHEEL_STEP_MINUTES;
  return { from: next, to: minutesOfTime(range.to) < floor ? hourAt(floor) : range.to };
}

/** The mirror of `withFrom`: the closing end leads and shoves the opening end down before it. */
function withTo(range: DraftRange, next: string): DraftRange {
  const ceiling = minutesOfTime(next) - DELIVERY_WHEEL_STEP_MINUTES;
  return { from: minutesOfTime(range.from) > ceiling ? hourAt(ceiling) : range.from, to: next };
}

/**
 * The hours the sheet opens on, dragged onto the rows the wheels actually carry.
 *
 * An order saved before the day was narrowed to 08:00–18:00 — or off the half-hour grid entirely —
 * would otherwise hand a wheel a value that is not one of its rows: the wheel would find nothing to
 * scroll to and sit on its first hour while the readback above it claimed something else. Rounding
 * on the way in means what the sheet shows is always what applying it would save.
 *
 * The opening hour is capped before anything else, because `18:00` is the one hour the "Desde"
 * wheel does not carry; the push then lifts the closing hour above it, which also covers a stored
 * range that was inverted or empty to begin with.
 */
function seedRange(from: string, to: string): DraftRange {
  const opening = hourAt(Math.min(minutesOfTime(from), LAST_FROM_MINUTES));
  return withFrom({ from: opening, to: hourAt(minutesOfTime(to)) }, opening);
}

/**
 * Picker for the window the client is able to receive in: two looping wheels, one per end, with
 * the handful of usual windows as chips above them.
 *
 * This replaced a grid of hours the seller tapped twice to build a range. The grid worked, but it
 * asked for a gesture nobody has anywhere else on their phone, it had to explain itself in a line
 * of copy under the chips, and it could only ever show the hours it had room for — 09:30 to 11:00
 * was out of its vocabulary. Wheels are the gesture every seller already knows from every other
 * time picker they own, they reach every half hour of the delivery day, and because each wheel
 * carries a single value there is nothing half-built to explain: the range is complete from the
 * moment the sheet opens.
 *
 * What the grid bought with its two-tap order — an end that could not land before its start — the
 * push above buys structurally instead: the seller drags whichever end they are thinking about,
 * the other gets shoved along only if it is in the way, and the two lists have no rows on them
 * that could produce an inverted range. The chips remain for the four windows worth naming, and
 * `Aplicar horario` remains the single commit point.
 */
export function DeliveryWindowSheet({
  visible,
  onClose,
  selectedFrom,
  selectedTo,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selectedFrom: string;
  selectedTo: string;
  onSelect: (window: DeliveryWindow) => void;
}) {
  const theme = useTheme();

  // One piece of state rather than two: each end is clamped against the other, and splitting them
  // would mean clamping against a value the other setter has not committed yet.
  const [range, setRange] = useState<DraftRange>(() => seedRange(selectedFrom, selectedTo));

  // Re-seeded every time it opens, so closing without applying discards the draft: the sheet
  // stays mounted between openings, and without this it would come back holding hours the seller
  // had already walked away from.
  useEffect(() => {
    if (!visible) return;
    setRange(seedRange(selectedFrom, selectedTo));
  }, [visible, selectedFrom, selectedTo]);

  const apply = () => {
    onSelect({ from: range.from, to: range.to, label: deliveryWindowLabelFor(range.from, range.to) });
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      // Sized to hold both wheels, the readback, the chips and the footer at once. The body below
      // is deliberately not scrollable: a vertical scroll around the wheels would swallow the
      // gesture they are made of, so the sheet has to be tall enough to never need one.
      maxHeight={620}
      footer={
        /**
         * The single commit point, and always available: the coupling leaves a complete range at
         * every moment, so there is no state in which applying would be premature. A preset chip
         * deliberately does not close the sheet — it is a starting point the seller often nudges
         * by half an hour, and closing on the chip tap would mean reopening to do it.
         */
        <Pressable onPress={apply} style={[styles.applyButton, { backgroundColor: theme.accent }]}>
          <Icon name="checkmark" size={16} color={theme.onAccent} />
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Aplicar horario
          </ThemedText>
        </Pressable>
      }>
      <View style={styles.container}>
        <ThemedText type="smallBold" style={styles.title}>
          ¿En qué horario recibe el cliente?
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Es el rango en que habrá alguien para recibir la entrega.
        </ThemedText>

        {/* The draft read back before it is applied, because this is the sentence the seller
            says out loud to the client — the hours for the warehouse, the name and the length
            underneath them for the conversation. */}
        <View style={[styles.readback, { backgroundColor: theme.accentSoft }]}>
          <Icon name="clock.fill" size={17} color={theme.accent} />
          <View style={styles.readbackTexts}>
            <ThemedText type="smallBold" numberOfLines={1} style={[styles.readbackRange, { color: theme.accent }]}>
              {`${range.from} a ${range.to}`}
            </ThemedText>
            <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.readbackMeta}>
              {`${deliveryWindowLabelFor(range.from, range.to)} · ${deliveryWindowSpan(range.from, range.to)}`}
            </ThemedText>
          </View>
        </View>

        <View style={styles.chipRow}>
          {QUICK_WINDOWS.map((window) => {
            const active = window.from === range.from && window.to === range.to;
            return (
              <Pressable
                key={`${window.from}-${window.to}`}
                onPress={() => setRange({ from: window.from, to: window.to })}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.accent : theme.background,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  numberOfLines={1}
                  style={[styles.chipText, { color: active ? theme.onAccent : theme.text }]}>
                  {window.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText themeColor="textSecondary" style={styles.caption}>
          O deslizá las ruedas: de 08:00 a 18:00, cada media hora.
        </ThemedText>

        <View style={styles.wheels}>
          <View style={styles.wheelColumn}>
            <ThemedText themeColor="textSecondary" style={styles.fieldCaption}>
              Desde
            </ThemedText>
            {/* Runs to 17:30 and no further, because there is no window that opens at closing
                time. That missing row is what lets the push above never run out of day. */}
            <TimeWheel
              values={DELIVERY_FROM_HOURS}
              value={range.from}
              onChange={(next) => setRange((current) => withFrom(current, next))}
            />
          </View>

          <View style={styles.wheelColumn}>
            <ThemedText themeColor="textSecondary" style={styles.fieldCaption}>
              Hasta
            </ThemedText>
            {/* Starts at 08:30, the mirror of the same idea: nothing closes at opening time. */}
            <TimeWheel
              values={DELIVERY_TO_HOURS}
              value={range.to}
              onChange={(next) => setRange((current) => withTo(current, next))}
            />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 15,
    lineHeight: 19,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  readback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  readbackTexts: {
    flex: 1,
    gap: 1,
  },
  readbackRange: {
    fontSize: 16,
    // Explicit alongside every reduced font size in the app: `smallBold` carries lineHeight 20
    // whatever the fontSize is.
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  readbackMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    lineHeight: 15,
  },
  caption: {
    fontSize: 10,
    lineHeight: 14,
  },
  wheels: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  /** Equal shares of the sheet's width, so neither end reads as the more important one. */
  wheelColumn: {
    flex: 1,
    gap: Spacing.one,
  },
  fieldCaption: {
    fontSize: 10,
    lineHeight: 14,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
});
