import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { TimeWheel } from '@/components/ui/time-wheel';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import {
  DELIVERY_DAY_HOURS,
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
const LAST_MINUTES = minutesOfTime(DELIVERY_DAY_HOURS[DELIVERY_DAY_HOURS.length - 1]);

/** The range being built. Both ends are always set, which is what makes it always applicable. */
type DraftRange = { from: string; to: string };

/** The wheel row nearest a minute-of-day, clamped to the day the wheels actually cover. */
function hourAt(minutes: number): string {
  const index = Math.round((minutes - FIRST_MINUTES) / DELIVERY_WHEEL_STEP_MINUTES);
  return DELIVERY_DAY_HOURS[Math.min(Math.max(index, 0), DELIVERY_DAY_HOURS.length - 1)];
}

/** The current length of the range, never below one wheel step. */
function spanOf(range: DraftRange): number {
  return Math.max(minutesOfTime(range.to) - minutesOfTime(range.from), DELIVERY_WHEEL_STEP_MINUTES);
}

/**
 * The coupling rule, and the only reason an inverted range cannot be produced here.
 *
 * Two wheels spin independently and neither one knows about the other, so nothing stops the
 * seller from parking "Hasta" before "Desde". Rather than let that happen and then refuse it,
 * moving one end carries the other along at the same distance — the way the start and end
 * pickers of the iOS calendar behave. Validity becomes a property of the control instead of a
 * rule applied to its output, which is why there is no error copy, no disabled end and no
 * rejected gesture anywhere in this sheet: there is no invalid state left to report.
 *
 * At the ends of the day the range cannot keep sliding, so it stops and the moved end gives way
 * instead — one step of separation is always kept, because a zero-length window is not an answer
 * anyone means to give.
 */
function coupleFrom(range: DraftRange, next: string): DraftRange {
  const span = spanOf(range);
  const from = minutesOfTime(next);

  if (from + span > LAST_MINUTES) {
    return { from: hourAt(LAST_MINUTES - span), to: hourAt(LAST_MINUTES) };
  }
  return { from: next, to: hourAt(from + span) };
}

/** The mirror of `coupleFrom`: the closing end leads and the opening end follows it. */
function coupleTo(range: DraftRange, next: string): DraftRange {
  const span = spanOf(range);
  const to = minutesOfTime(next);

  if (to - span < FIRST_MINUTES) {
    return { from: hourAt(FIRST_MINUTES), to: hourAt(FIRST_MINUTES + span) };
  }
  return { from: hourAt(to - span), to: next };
}

/**
 * Picker for the window the client is able to receive in: two looping wheels, one per end, with
 * the handful of usual windows as chips above them.
 *
 * This replaced a grid of hours the seller tapped twice to build a range. The grid worked, but it
 * asked for a gesture nobody has anywhere else on their phone, it had to explain itself in a line
 * of copy under the chips, and it could only ever show the hours it had room for — a client who
 * receives at 06:30 or at 21:00 was out of its vocabulary. Wheels are the gesture every seller
 * already knows from every other time picker they own, they reach the whole 24 hours without
 * putting 48 options on screen, and because each wheel carries a single value there is nothing
 * half-built to explain: the range is complete from the moment the sheet opens.
 *
 * What the grid bought with its two-tap order — an end that could not land before its start — the
 * coupling above buys structurally instead: the ends move together, so the seller drags whichever
 * one they are thinking about and the range follows without ever being wrong. The chips remain
 * for the four windows worth naming, and `Aplicar horario` remains the single commit point.
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

  // One piece of state rather than two: every change reads both ends to preserve the span, and
  // splitting them would mean computing the new span from a value the other setter has not
  // committed yet.
  const [range, setRange] = useState<DraftRange>({ from: selectedFrom, to: selectedTo });

  // Re-seeded every time it opens, so closing without applying discards the draft: the sheet
  // stays mounted between openings, and without this it would come back holding hours the seller
  // had already walked away from.
  useEffect(() => {
    if (!visible) return;
    setRange({ from: selectedFrom, to: selectedTo });
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
          O deslizá las ruedas: cubren las 24 horas del día.
        </ThemedText>

        <View style={styles.wheels}>
          <View style={styles.wheelColumn}>
            <ThemedText themeColor="textSecondary" style={styles.fieldCaption}>
              Desde
            </ThemedText>
            <TimeWheel
              values={DELIVERY_DAY_HOURS}
              value={range.from}
              onChange={(next) => setRange((current) => coupleFrom(current, next))}
            />
          </View>

          <View style={styles.wheelColumn}>
            <ThemedText themeColor="textSecondary" style={styles.fieldCaption}>
              Hasta
            </ThemedText>
            <TimeWheel
              values={DELIVERY_DAY_HOURS}
              value={range.to}
              onChange={(next) => setRange((current) => coupleTo(current, next))}
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
