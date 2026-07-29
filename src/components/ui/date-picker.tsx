import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import DateTimePicker, { useDefaultStyles, type DateType } from 'react-native-ui-datepicker';

import { ThemedText } from '@/components/themed-text';
import { ControlHeight, FloatingShadow, Overlay, Radius, Spacing } from '@/constants/theme';
import { useTheme, useThemeScheme } from '@/hooks/use-theme';

/** Largest the day circle is allowed to get, however much room the card has. */
const MAX_DAY_SIZE = 36;

/** Smallest it may shrink to before legibility goes, on the narrowest phones. */
const MIN_DAY_SIZE = 26;

/** Breathing room between one day circle and the next, horizontally and vertically. */
const DAY_GAP = 4;

/** The library's own default, restated because the row height is derived from it below. */
const WEEKDAYS_HEIGHT = 25;

/**
 * Side of the day circle, as an explicit number.
 *
 * It has to be explicit, and it has to be square, because the library applies `styles.day` to
 * a `flex: 1` element inside a cell that is a seventh of the card's width by a sixth of the
 * calendar's height — roughly 42 by 46 — so a border radius on its own rounds a rectangle
 * into an oval. Deriving both sides from the width here is what guarantees a circle:
 * `aspectRatio: 1` is not reliable for this, since Yoga does not consistently resolve it
 * against a percentage width that also carries a `maxWidth`, and the height falls back to
 * the row's, which is the taller of the two — a vertical oval.
 *
 * Mirrors this component's own layout: the backdrop's padding, then the card's own maximum
 * width and gutters, then a seventh of what is left.
 */
function dayCircleSize(windowWidth: number): number {
  const cardWidth = Math.min(windowWidth - Spacing.four * 2, 330);
  const cellWidth = ((cardWidth - Spacing.three * 2) * 99.9) / 7 / 100;
  return Math.max(MIN_DAY_SIZE, Math.min(MAX_DAY_SIZE, Math.floor(cellWidth) - DAY_GAP));
}

/**
 * Whatever the calendar hands back, as a plain `Date`. The library types its value as
 * `DateType`, which is a Dayjs instance in practice but is declared wide enough to also
 * be a string, a number or a `Date` — narrowing here keeps that union from leaking into
 * the `onSelect` contract callers already depend on.
 */
function toJsDate(value: DateType): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  // Dayjs instances are objects carrying toDate(); strings and numbers are not.
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
 * The calendar itself is `react-native-ui-datepicker`, not a hand-rolled grid: tapping the
 * month or the year in its header opens a grid of months and of years, so a date years out
 * is two taps instead of paging a chevron once per month. It is pure JS with no native
 * module, so it needs no rebuild, and its month and weekday names come from bundled dayjs
 * locale data rather than `Intl` — which matters because Hermes ships without full Intl
 * locale data on Android, where `Intl`-derived month names come back in English.
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
  // Handed the app's own scheme rather than letting the library read the OS: the app has a
  // manual toggle, so the two would disagree the moment the seller overrides the system.
  const defaultStyles = useDefaultStyles(useThemeScheme());

  const { width: windowWidth } = useWindowDimensions();
  const daySize = dayCircleSize(windowWidth);
  /**
   * Height for the whole calendar body, chosen so the six day rows come out just tall enough
   * for the circles. The library divides this by six for the row height, so leaving it at its
   * 300 default made each row ~46 tall around a 36 circle, which read as a stretched grid.
   */
  const containerHeight = WEEKDAYS_HEIGHT + (daySize + DAY_GAP) * 6;

  /**
   * The month the calendar opens on. Deliberately NOT kept in sync with where the seller
   * pages to afterwards: the library resets its own view to the day grid whenever the
   * `month` or `year` prop changes, so feeding its `onMonthChange`/`onYearChange` back in
   * here would slam the month and year grids shut the instant they were used. Left
   * uncontrolled, the calendar owns which of the three views is on screen, and its header
   * toggles back to the days on its own.
   */
  const [anchor, setAnchor] = useState(() => value ?? new Date());

  // Re-anchor every time it opens: the dialog stays mounted between openings, so without
  // this it would come back showing whatever month was last paged to. Opens on the
  // recorded date's month when there is one, so reaching for the calendar after typing
  // does not drop the seller back into the current month.
  const valueTime = value ? value.getTime() : null;
  useEffect(() => {
    if (!visible) return;
    setAnchor(valueTime !== null ? new Date(valueTime) : new Date());
  }, [visible, valueTime]);

  /**
   * The app's own palette mapped onto the calendar's parts, spread over the library's
   * defaults so anything not named here still has a sane value. Keyed off the theme
   * rather than frozen at module scope, because these colors change with dark mode.
   */
  const calendarStyles = useMemo(
    () => ({
      ...defaultStyles,
      // Header — the month and year are the buttons that open their own grids, so they
      // read as pressable rather than as a caption.
      month_selector_label: { fontSize: 14, fontWeight: '700' as const, color: theme.text },
      year_selector_label: { fontSize: 14, fontWeight: '700' as const, color: theme.text },
      button_prev: { backgroundColor: theme.background, borderRadius: Radius.pill, padding: 6 },
      button_next: { backgroundColor: theme.background, borderRadius: Radius.pill, padding: 6 },
      button_prev_image: { tintColor: theme.text },
      button_next_image: { tintColor: theme.text },

      weekday_label: { fontSize: 10, fontWeight: '700' as const, color: theme.textSecondary },

      // What makes the day a circle instead of an oval: both sides the same explicit number.
      // `flex: 0` is load bearing — the library's own day style is `flex: 1`, which stretches
      // this to the full row height and is what produced the oval in the first place.
      day: {
        flex: 0,
        width: daySize,
        height: daySize,
        borderRadius: daySize / 2,
        alignSelf: 'center' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
      // The cell can still be taller than the circle, so it does the centering — otherwise
      // every circle hangs from the top of its row.
      day_cell: { alignItems: 'center' as const, justifyContent: 'center' as const },
      day_label: { fontSize: 13, color: theme.text },
      // Today is outlined rather than filled: the fill means "this is the recorded date",
      // and two solid days would read as two answers. Both of these inherit the circle
      // from `day` above — they only carry color.
      today: { borderWidth: 1.5, borderColor: theme.accent },
      today_label: { color: theme.text },
      selected: { backgroundColor: theme.accent },
      selected_label: { color: theme.onAccent, fontWeight: '700' as const },
      // No `outside_label`: `showOutsideDays` defaults to false, so the neighbouring
      // months' days are never rendered and styling them would be dead weight. The 1st
      // still lands under its real weekday, same as before.
      disabled_label: { color: theme.textSecondary, opacity: 0.4 },

      // Month and year grids — the whole point of the swap, so they get the same
      // selected treatment as a day instead of the library's default.
      month_label: { fontSize: 13, color: theme.text },
      year_label: { fontSize: 13, color: theme.text },
      selected_month: { backgroundColor: theme.accent, borderRadius: Radius.sm },
      selected_month_label: { color: theme.onAccent, fontWeight: '700' as const },
      selected_year: { backgroundColor: theme.accent, borderRadius: Radius.sm },
      selected_year_label: { color: theme.onAccent, fontWeight: '700' as const },
      // The year the grid is currently paged to, which is not necessarily the recorded
      // one — softly marked so it does not compete with the actual selection.
      active_year: { backgroundColor: theme.accentSoft, borderRadius: Radius.sm },
      active_year_label: { color: theme.accent, fontWeight: '700' as const },
    }),
    [defaultStyles, theme, daySize],
  );

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

          <DateTimePicker
            // Remounted when the anchor changes, which is the only way to re-anchor a
            // calendar whose view state is its own: the month and year props are read when
            // it builds its initial state, and paging afterwards leaves them untouched.
            key={anchor.getTime()}
            mode="single"
            date={value ?? undefined}
            onChange={({ date }) => {
              const picked = toJsDate(date);
              if (!picked) return;
              onSelect(picked);
              onClose();
            }}
            // The month to open on, not a live binding — see `anchor`. No
            // `onMonthChange`/`onYearChange` on purpose; they default to no-ops.
            month={anchor.getMonth()}
            year={anchor.getFullYear()}
            // Both passed explicitly: the row height the library derives is
            // `(containerHeight - weekdaysHeight) / 6`, so leaving either to its default
            // would put the rows back out of step with the circles.
            containerHeight={containerHeight}
            weekdaysHeight={WEEKDAYS_HEIGHT}
            // Spanish names from bundled dayjs locale data, and the week as it reads on a
            // wall calendar here: Monday first, weekdays as single initials.
            locale="es"
            firstDayOfWeek={1}
            weekdaysFormat="min"
            styles={calendarStyles}
          />

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            {/* Still worth its own button next to the month and year grids: the current
                month is the one date that needs no navigating to at all. A fresh `Date`
                every time, so the key changes and the calendar re-anchors even when the
                seller had only paged away within the current month's year. */}
            <Pressable hitSlop={6} onPress={() => setAnchor(new Date())} style={styles.footerButton}>
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
    // Wide enough for seven day cells and no wider: a stretched calendar on a tablet
    // would leave the grid swimming in its own card.
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
