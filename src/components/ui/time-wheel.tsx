import { useEffect, useRef, useState } from 'react';
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

/** Padding above and below the rows, so the first and last one can still reach the centre line. */
const EDGE_PADDING = ITEM_HEIGHT * ((VISIBLE_ROWS - 1) / 2);

/**
 * The share of the remaining distance the wheel covers each frame while catching up.
 *
 * A proportion rather than a speed, which is what makes the movement ease out on its own: the
 * wheel leaves quickly and arrives gently, and a target that moves further away mid-chase is
 * simply chased harder.
 *
 * Closing a proportion each frame means the time barely grows with the distance — at 60fps this
 * value crosses one row in ~150ms and the whole day in ~270ms — so a nudge and a preset both take
 * about as long as they look like they should. It is also tuned against the flick: while the other
 * end is being thrown across the day this wheel stays under one row behind it, close enough to
 * read as being shoved rather than as a second wheel moving on its own.
 */
const CHASE = 0.35;

/** Close enough to stop pretending: below one pixel there is nothing left to animate. */
const ARRIVED = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * An iOS-style value wheel over a short list, with ends it stops at.
 *
 * An earlier version of this wheel looped forever, from a list repeated five times with a silent
 * correction back to the middle copy. That paid for itself when the list was the 48 half hours of
 * the clock, where crossing it was a journey. It stopped paying when the list became the twenty
 * half hours of the delivery day: the longest trip a seller can take is one flick, so the looping
 * bought half a gesture and charged a wheel with no ends — which a range with two of them cannot
 * use, because there is no honest value on the far side of the last row.
 *
 * Nothing in here knows about ranges. Whatever the wheel must not land on is simply not in
 * `values`, which is why an out-of-range row cannot be scrolled to, dimmed, or bounced off: it was
 * never handed over.
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

  /**
   * The last value this wheel handed to `onChange`.
   *
   * The parent owns `value`, so every emission comes back down as a prop. Without this the echo
   * would read as an outside change, scroll the wheel to where it already is, and emit again.
   */
  const lastEmittedRef = useRef(value);

  const [centredRow, setCentredRow] = useState(() => Math.max(values.indexOf(value), 0));

  /** Mirrors `centredRow` for the scroll handlers, which run far more often than renders commit. */
  const centredRowRef = useRef(centredRow);

  /** Where the wheel is and where it is headed. Only the chase below writes them both. */
  const offsetRef = useRef(centredRow * ITEM_HEIGHT);
  const targetOffsetRef = useRef(centredRow * ITEM_HEIGHT);

  /** The running catch-up, if there is one, and the flag that tells the scroll handler so. */
  const frameRef = useRef<number | null>(null);
  const chasingRef = useRef(false);

  const commitCentredRow = () => {
    const row = clamp(Math.round(offsetRef.current / ITEM_HEIGHT), 0, values.length - 1);
    if (row === centredRowRef.current) return;
    centredRowRef.current = row;
    setCentredRow(row);
  };

  const stopChase = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    chasingRef.current = false;
  };

  /** Put the wheel somewhere with no travel at all: first layout, and nothing else. */
  const settleOn = (row: number) => {
    stopChase();
    centredRowRef.current = row;
    setCentredRow(row);
    offsetRef.current = row * ITEM_HEIGHT;
    targetOffsetRef.current = offsetRef.current;
    scrollRef.current?.scrollTo({ y: offsetRef.current, animated: false });
  };

  const step = () => {
    const distance = targetOffsetRef.current - offsetRef.current;

    if (Math.abs(distance) < ARRIVED) {
      offsetRef.current = targetOffsetRef.current;
      scrollRef.current?.scrollTo({ y: offsetRef.current, animated: false });
      commitCentredRow();
      stopChase();
      return;
    }

    offsetRef.current += distance * CHASE;
    scrollRef.current?.scrollTo({ y: offsetRef.current, animated: false });
    commitCentredRow();
    frameRef.current = requestAnimationFrame(step);
  };

  /**
   * The pushed end travelling to where it was shoved, instead of appearing there.
   *
   * One chase, re-aimed — and that is the whole reason this is hand-driven rather than a
   * `scrollTo({ animated: true })`. While the seller flicks one end through the other, this wheel
   * is pushed a row at a time, several times a second. Each animated `scrollTo` would cancel the
   * one still in flight, so the wheel would restart its easing on every push and crawl behind the
   * finger, arriving long after the gesture died. Here there is a single loop that reads the
   * target fresh on every frame: a push that lands mid-flight moves the destination, not the
   * animation, so the wheel just keeps rolling and only settles once it is no longer being shoved.
   *
   * That lag is not a defect to tune away either. The wheel trailing the one under the finger by a
   * fraction of a second is what a push looks like — the far end is not choosing an hour, it is
   * being pushed out of the way, and it should read as the thing being moved.
   */
  const chaseTo = (row: number) => {
    targetOffsetRef.current = row * ITEM_HEIGHT;
    if (frameRef.current !== null) return;
    chasingRef.current = true;
    frameRef.current = requestAnimationFrame(step);
  };

  /**
   * Where the wheel starts: the mounted offset cannot be set until the rows have been measured,
   * so it is done on the first content-size report rather than on mount.
   */
  const mountedRef = useRef(false);
  const handleContentSizeChange = () => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    settleOn(centredRowRef.current);
  };

  /**
   * The value under the centre line, reported live rather than on release.
   *
   * The other end of the range is pushed by this one, so waiting for the gesture to finish would
   * mean the seller drags "Desde" through "Hasta" and only finds out where "Hasta" ended up once
   * they let go. Emitting per row keeps the readback above the wheels true the whole way.
   *
   * Silent while the chase is running, because the rows crossing the centre line then are ones
   * this wheel is being carried past, not ones the seller picked. Emitting them would send the
   * far end's own travel back to the parent as a choice, and the two wheels would push each other
   * across the day.
   */
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (chasingRef.current) return;

    offsetRef.current = event.nativeEvent.contentOffset.y;
    commitCentredRow();

    const next = values[centredRowRef.current];
    if (next === lastEmittedRef.current) return;
    lastEmittedRef.current = next;
    onChange(next);
  };

  /** A hand on the wheel outranks a push: the chase gives up rather than fight the gesture. */
  const handleScrollBeginDrag = () => {
    stopChase();
  };

  useEffect(() => {
    if (value === lastEmittedRef.current) return;

    const index = values.indexOf(value);
    if (index < 0) return;
    lastEmittedRef.current = value;

    // Before the rows are measured there is nothing to travel across, and the wheel would be
    // animating from a position it has not taken up yet.
    if (mountedRef.current) chaseTo(index);
    else settleOn(index);
    // Both helpers are rebuilt every render and touch nothing but refs, so listing them would only
    // re-run this on renders where the selection did not move. The guard above already makes that
    // a no-op, but the effect is meant to fire on a new value and nothing else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, values]);

  /** A chase outliving its wheel would scroll a ref that is no longer on screen. */
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

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
        onScrollBeginDrag={handleScrollBeginDrag}
        onContentSizeChange={handleContentSizeChange}
        contentContainerStyle={styles.rows}>
        {values.map((row, index) => {
          const distance = Math.abs(index - centredRow);
          return (
            <View key={row} style={styles.row}>
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
