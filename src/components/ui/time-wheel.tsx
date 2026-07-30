import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** One row's height, and the count of rows on screen. Odd, so one row is truly the centre. */
const ITEM_HEIGHT = 36;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

/**
 * How many times the value list is laid out end to end. Odd, so one copy is the middle one the
 * wheel is always brought back to; five leaves two whole copies of slack on either side of it,
 * which is more than the fastest flick can cross before the correction below runs.
 */
const REPEATS = 5;

/** Padding above and below the rows, so the first and last one can still reach the centre line. */
const EDGE_PADDING = ITEM_HEIGHT * ((VISIBLE_ROWS - 1) / 2);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * An iOS-style value wheel that scrolls forever in both directions.
 *
 * A plain `ScrollView` with snapping does all the work; the endlessness is an illusion built from
 * a repeated list and one silent correction, described where it happens.
 */
export function TimeWheel({
  values,
  value,
  onChange,
}: {
  values: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  /** The live scroll offset, kept outside state: the render never needs it, the maths always does. */
  const offsetRef = useRef(0);

  /**
   * The last value this wheel handed to `onChange`.
   *
   * The parent owns `value`, so every emission comes back down as a prop. Without this the echo
   * would read as an outside change, scroll the wheel to where it already is, and emit again.
   */
  const lastEmittedRef = useRef(value);

  const rows = useMemo(
    () => Array.from({ length: values.length * REPEATS }, (_, index) => values[index % values.length]),
    [values],
  );

  const middleCopyStart = Math.floor(REPEATS / 2) * values.length;

  const [centredRow, setCentredRow] = useState(() => middleCopyStart + Math.max(values.indexOf(value), 0));

  /** Mirrors `centredRow` for the scroll handlers, which run far more often than renders commit. */
  const centredRowRef = useRef(centredRow);

  const settleOn = (row: number, animated: boolean) => {
    centredRowRef.current = row;
    setCentredRow(row);
    offsetRef.current = row * ITEM_HEIGHT;
    scrollRef.current?.scrollTo({ y: row * ITEM_HEIGHT, animated });
  };

  /**
   * Where the wheel starts: the mounted offset cannot be set until the rows have been measured,
   * so it is done on the first content-size report rather than on mount.
   */
  const mountedRef = useRef(false);
  const handleContentSizeChange = () => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    settleOn(centredRowRef.current, false);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y;
    offsetRef.current = offset;

    const row = clamp(Math.round(offset / ITEM_HEIGHT), 0, rows.length - 1);
    if (row === centredRowRef.current) return;
    centredRowRef.current = row;
    setCentredRow(row);

    // Guarded on the value and not on the row, because crossing a copy boundary changes the row
    // while the value under the centre line stays the same.
    const next = rows[row];
    if (next === lastEmittedRef.current) return;
    lastEmittedRef.current = next;
    onChange(next);
  };

  /**
   * The whole trick, and the reason the wheel never runs out of list.
   *
   * When the scroll comes to rest inside the first or last copy, the offset is moved by a whole
   * number of copies (`values.length * ITEM_HEIGHT` each) so the same value sits under the centre
   * line in the middle copy. Nothing is animated, no value changes, and the rows either side are
   * identical, so there is nothing on screen to tell the seller apart from before — they are just
   * back in the middle with a full copy of runway in both directions again.
   *
   * On momentum end and nowhere else. Correcting mid-gesture rewrites the offset the finger is
   * still driving, which snaps the content out from under the touch and cancels the deceleration
   * the wheel is entirely made of.
   */
  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y;
    offsetRef.current = offset;

    const row = clamp(Math.round(offset / ITEM_HEIGHT), 0, rows.length - 1);
    const copy = Math.floor(row / values.length);
    if (copy !== 0 && copy !== REPEATS - 1) return;

    settleOn(middleCopyStart + (row % values.length), false);
  };

  /**
   * The row holding `index` in whichever copy is closest to where the wheel already is, so an
   * outside change travels the shortest distance instead of always hauling back to the middle
   * copy — a jump of two whole copies that reads as the list teleporting.
   *
   * The outermost copies are left out on purpose: landing in one leaves no runway on that side,
   * and the correction above only runs after a gesture, not after a programmatic scroll.
   */
  const nearestRow = (index: number) => {
    const current = offsetRef.current / ITEM_HEIGHT;
    let best = values.length + index;
    for (let copy = 1; copy < REPEATS - 1; copy += 1) {
      const row = copy * values.length + index;
      if (Math.abs(row - current) < Math.abs(best - current)) best = row;
    }
    return best;
  };

  /**
   * Outside changes land without animation, and that is not a shortcut.
   *
   * This wheel emits on every row that crosses the centre line, so while one end is being flicked
   * the other end is handed a new value roughly every frame. An animated `scrollTo` takes ~300ms,
   * so each of those would cancel the one still in flight: the following wheel would crawl behind
   * the finger in tiny increments and only catch up once the flick died. Landing instantly instead
   * makes the two ends move in lockstep, which is also the truthful picture of what the coupling
   * does — the span is fixed, so the other end is not deciding anything, it is being carried.
   *
   * The one case where this scroll lands on a wheel that is still under the finger is a clamp at
   * either edge of the day, and there fighting the gesture is the point: it is the day running out.
   */
  useEffect(() => {
    if (value === lastEmittedRef.current) return;

    const index = values.indexOf(value);
    if (index < 0) return;
    lastEmittedRef.current = value;
    settleOn(nearestRow(index), false);
    // `values` is a module constant in every call site, and re-running on the derived helpers
    // would fire this on renders where nothing about the selection moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, values]);

  return (
    <View style={styles.wheel}>
      {/* Behind the rows and deaf to touches: the band is the iOS affordance that says "the row
          in here is the value", so it has to stay put while the rows travel through it. */}
      <View
        pointerEvents="none"
        style={[
          styles.band,
          { backgroundColor: theme.accentSoft, borderColor: theme.border },
        ]}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        // The wheel lives inside a bottom sheet, and Android hands the gesture to the outer
        // scroll container without this.
        nestedScrollEnabled
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        onContentSizeChange={handleContentSizeChange}
        contentContainerStyle={styles.rows}>
        {rows.map((row, index) => {
          const distance = Math.abs(index - centredRow);
          return (
            <View key={`${row}-${index}`} style={styles.row}>
              {/* Stepped down by distance rather than animated: the rows move, the fade belongs to
                  the position they pass through, so it can be plain computed style. */}
              <ThemedText
                numberOfLines={1}
                style={[
                  styles.rowText,
                  distance === 0
                    ? { color: theme.text, fontWeight: '700' }
                    : { color: theme.textSecondary, opacity: distance === 1 ? 0.7 : 0.4 },
                ]}>
                {row}
              </ThemedText>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: {
    height: WHEEL_HEIGHT,
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: EDGE_PADDING,
    height: ITEM_HEIGHT,
    borderRadius: Radius.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rows: {
    paddingVertical: EDGE_PADDING,
  },
  row: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: 15,
    // Explicit because `ThemedText` carries a fixed lineHeight per type, and a wheel row that
    // measures taller than ITEM_HEIGHT drifts off the centre line one row at a time.
    lineHeight: 19,
    // Digits of equal width, so the columns do not shuffle sideways as the hours scroll.
    fontVariant: ['tabular-nums'],
  },
});
