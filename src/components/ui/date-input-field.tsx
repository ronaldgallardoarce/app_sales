import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DatePickerDialog } from '@/components/ui/date-picker';
import { Icon } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** `DD/MM/AAAA`. */
export const DATE_INPUT_LENGTH = 10;

/**
 * Whether the masked field holds a full date, regardless of it being a valid one. Only
 * for deciding when to start judging the input — a half-typed date is not yet wrong.
 */
export function isDateInputComplete(value: string): boolean {
  return value.length === DATE_INPUT_LENGTH;
}

/**
 * Whether a complete `DD/MM/AAAA` value is a date that exists. This is the reason the
 * field stays a string: `new Date(2027, 1, 31)` does not fail, it silently rolls over
 * to 3 March, so a `Date` would have accepted `31/02/2027` and quietly recorded the
 * wrong day. Comparing the parts back against what the date produced is what catches it.
 */
function isRealDate(value: string): boolean {
  const [day, month, year] = value.split('/').map(Number);
  if (!day || !month || !year) return false;
  const date = new Date(year, month - 1, day);
  return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
}

/**
 * Whether the field holds a usable date. This, not `isDateInputComplete`, is what gates
 * saving: a full-length value can still be a date that does not exist, and a record
 * carrying `31/02/2027` is worse than an empty one because it looks answered.
 */
export function isDateInputValid(value: string): boolean {
  return isDateInputComplete(value) && isRealDate(value);
}

/**
 * Keeps only digits and re-inserts the separators, so the seller types eight numbers
 * and never a slash. Anything past the eighth digit is dropped instead of shifting
 * the earlier groups.
 */
export function maskDateInput(input: string): string {
  const digits = input.replace(/[^0-9]/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter((part) => part.length > 0)
    .join('/');
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** A picked day back into the masked field's own `DD/MM/AAAA` shape. */
export function formatDateInput(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * The typed value as a `Date`, or null while it is incomplete or impossible. Built on
 * `isDateInputValid` so the calendar can never highlight a day the field itself rejects.
 */
export function parseDateInput(value: string): Date | null {
  if (!isDateInputValid(value)) return null;
  const [day, month, year] = value.split('/').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * A date the seller can type, with the calendar beside it as the second way in.
 *
 * Typing stays the primary path — eight digits read off a package or off a delivery plan beat
 * paging a calendar — so the button is an alternative, not the only door. Which is also why the
 * value is a string and not a `Date`: a half-typed date is a normal state of this field, and
 * anything holding a `Date` would have to invent something to mean "still typing".
 *
 * Extracted from the low-rotation task form, which is where the shape was worked out; the returns
 * flow asks for the same two dates, and a second copy of the masking and the rollover check is
 * exactly the kind of duplication that ends with the two disagreeing about `31/02`.
 */
export function DateInputField({
  value,
  onChange,
  title,
  placeholder = 'DD/MM/AAAA',
}: {
  /** The masked `DD/MM/AAAA` string, empty while unanswered. */
  value: string;
  onChange: (value: string) => void;
  /** Heading for the calendar dialog, e.g. "Fecha de vencimiento". */
  title: string;
  placeholder?: string;
}) {
  const theme = useTheme();
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Only complain once the seller finished typing: "31/0" is on its way to a valid date,
  // so warning mid-entry would flag every keystroke.
  const invalid = isDateInputComplete(value) && !isRealDate(value);

  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <TextInput
          value={value}
          onChangeText={(input) => onChange(maskDateInput(input))}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          maxLength={DATE_INPUT_LENGTH}
          style={[
            styles.input,
            {
              backgroundColor: theme.background,
              borderColor: invalid ? theme.danger : theme.border,
              color: theme.text,
            },
          ]}
        />

        <Pressable
          onPress={() => {
            // The keyboard would otherwise stay up over the dialog, and on a short screen
            // it covers the very rows the seller came here to tap.
            Keyboard.dismiss();
            setCalendarOpen(true);
          }}
          style={[
            styles.button,
            {
              backgroundColor: calendarOpen ? theme.accentSoft : theme.background,
              borderColor: calendarOpen ? theme.accent : theme.border,
            },
          ]}>
          <Icon name="calendar" size={17} color={theme.accent} />
        </Pressable>
      </View>

      <DatePickerDialog
        visible={calendarOpen}
        value={parseDateInput(value)}
        title={title}
        onSelect={(date) => {
          onChange(formatDateInput(date));
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />

      {invalid ? (
        <View style={[styles.notice, { backgroundColor: theme.dangerSoft }]}>
          <Icon name="exclamationmark.circle" size={13} color={theme.danger} />
          <ThemedText style={[styles.noticeText, { color: theme.danger }]}>
            Esa fecha no existe en el calendario. Revisá el día y el mes.
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  input: {
    flex: 1,
    height: ControlHeight.input,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
    // 13 matches every other field. Bold and tabular-nums stay — the value is eight digits
    // read back at a glance.
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  button: {
    width: ControlHeight.input,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
});
