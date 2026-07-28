import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ControlHeight, FloatingShadow, Overlay, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Header month names, hardcoded instead of read from `toLocaleDateString`: the label has
 * to read the same on every engine, and Hermes ships without full Intl locale data on
 * Android, where the month would come back in English.
 */
const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** Weekday initials, Monday-first — the week as it reads on a wall calendar. */
const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Monday-first index of the weekday a month opens on. `getDay()` counts from Sunday. */
function firstWeekdayOffset(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

/**
 * A date picker as a centered dialog over a dimmed backdrop — the platform's own shape for
 * this, and it floats above whatever raised it instead of pushing the form open.
 *
 * It is a `Modal` nested inside the caller's tree, which is presented *above* an already
 * open `BottomSheet` — the same thing `ImageViewer` does from inside the photo picker.
 * What does not work is a second sheet raised as a *sibling* from the screen: that one is
 * presented below the open sheet and never becomes visible, which is why the product
 * picker in the tasks screen is a view swap instead.
 *
 * Picking a day commits and closes on the spot rather than waiting for an OK. The field
 * that opened this is right underneath showing the result, and this is a control the seller
 * fills many times a day — a confirm step would be a second tap on every single record.
 * Dismissing (backdrop, Cancelar, or the hardware back button) leaves the value untouched.
 *
 * No minimum date on purpose: slow-moving stock is often already expired, and that is
 * exactly the case worth recording.
 */
export function DatePickerDialog({
  visible,
  value,
  onSelect,
  onClose,
  title = 'Elegir fecha',
}: {
  visible: boolean;
  /** The currently recorded date, or null when the field is empty or half-typed. */
  value: Date | null;
  onSelect: (date: Date) => void;
  onClose: () => void;
  title?: string;
}) {
  const theme = useTheme();
  const today = useMemo(() => new Date(), []);
  // The month on screen. Opens on the recorded date's month when there is one, so reaching
  // for the calendar after typing does not drop the seller back into the current month.
  const [cursor, setCursor] = useState(() => value ?? today);

  // Re-anchor every time it opens: the dialog stays mounted between openings, so without
  // this it would come back showing whatever month was last paged to.
  const valueTime = value ? value.getTime() : null;
  useEffect(() => {
    if (!visible) return;
    setCursor(valueTime !== null ? new Date(valueTime) : new Date());
  }, [visible, valueTime]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // Leading nulls are the days belonging to the previous month, rendered as gaps so the
  // 1st lands under its real weekday.
  const cells = useMemo<(number | null)[]>(() => {
    const blanks: null[] = Array.from({ length: firstWeekdayOffset(year, month) }, () => null);
    const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
    return [...blanks, ...days];
  }, [year, month]);

  // Day 1 of an out-of-range month rolls into the next year on its own, so December →
  // January needs no special case.
  const shiftMonth = (delta: number) => setCursor(new Date(year, month + delta, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* The backdrop is the dismiss target, so the card sits inside it as a non-pressable
          child rather than beside it — a tap anywhere around the calendar closes. */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          // Swallows taps that land on the card so they do not reach the backdrop below.
          onPress={() => {}}
          style={[styles.card, { backgroundColor: theme.backgroundElement }, FloatingShadow]}>
          <ThemedText type="smallBold" style={styles.title}>
            {title}
          </ThemedText>

          <View style={styles.header}>
            <Pressable
              hitSlop={8}
              onPress={() => shiftMonth(-1)}
              style={[styles.nav, { backgroundColor: theme.background }]}>
              <Icon name="chevron.left" size={16} color={theme.text} />
            </Pressable>

            <ThemedText type="smallBold" style={styles.month}>
              {MONTH_NAMES[month]} {year}
            </ThemedText>

            <Pressable
              hitSlop={8}
              onPress={() => shiftMonth(1)}
              style={[styles.nav, { backgroundColor: theme.background }]}>
              <Icon name="chevron.right" size={16} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.week}>
            {WEEKDAY_INITIALS.map((initial, index) => (
              <ThemedText
                // Two weekdays share the initial M, so the position is the identity here.
                key={index}
                themeColor="textSecondary"
                style={styles.weekday}>
                {initial}
              </ThemedText>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, index) => {
              if (day === null) return <View key={`blank-${index}`} style={styles.cell} />;

              const date = new Date(year, month, day);
              const isSelected = value !== null && isSameDay(date, value);
              // Today is outlined rather than filled: the fill means "this is the recorded
              // date", and two solid days would read as two answers.
              const isToday = isSameDay(date, today);

              return (
                <Pressable key={day} onPress={() => onSelect(date)} style={styles.cell}>
                  <View
                    style={[
                      styles.day,
                      isSelected
                        ? { backgroundColor: theme.accent }
                        : isToday
                          ? { borderWidth: 1.5, borderColor: theme.accent }
                          : null,
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={[styles.dayText, { color: isSelected ? theme.onAccent : theme.text }]}>
                      {day}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            {/* Paging back from a date years out is the slow path this avoids. */}
            <Pressable hitSlop={6} onPress={() => setCursor(new Date())} style={styles.footerButton}>
              <ThemedText type="smallBold" style={[styles.footerText, { color: theme.accent }]}>
                Hoy
              </ThemedText>
            </Pressable>

            <Pressable hitSlop={6} onPress={onClose} style={styles.footerButton}>
              <ThemedText type="smallBold" style={[styles.footerText, { color: theme.textSecondary }]}>
                Cancelar
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    // Wide enough for seven 36pt day circles and no wider: a stretched calendar on a
    // tablet would leave the grid swimming in its own card.
    maxWidth: 330,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 15,
    // Explicit alongside every reduced font size in the app: the `smallBold` type carries
    // lineHeight 20, so a smaller font on its own keeps the old row height.
    lineHeight: 19,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  nav: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 18,
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    // The default ThemedText type carries lineHeight 24, which would push the weekday row
    // twice as tall as the letters in it.
    lineHeight: 14,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    // A literal, not `100 / 7`: RN types percentages as `${number}%`, and a computed
    // template string widens to `string` and stops type-checking.
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: 1,
  },
  day: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.one,
  },
  footerButton: {
    height: ControlHeight.input,
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  footerText: {
    fontSize: 13,
  },
});
