import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FloatingShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const RAIL_WIDTH = 18;
const BUBBLE_SIZE = 40;

/**
 * Jump-to-letter rail pinned to the right of the product list.
 *
 * Works like the index bar in contact apps: the alphabet is spread evenly over the
 * rail's height, so the letter under the finger is the letter it jumps to. Press
 * and drag to scrub — a bubble echoes the current letter beside the finger.
 *
 * Dividing the height between the letters (rather than giving them a fixed size
 * and scrolling the overflow) is what keeps the drag exact: every position maps to
 * one letter, nothing accumulates across events, and the rail can never overflow
 * the list it belongs to.
 */
export function AlphabetIndex({
  availableLetters,
  onSelect,
  bottomInset = 0,
  reversed = false,
}: {
  availableLetters: Set<string>;
  onSelect: (letter: string) => void;
  /** Space to keep clear at the bottom, e.g. for the floating cart bar. */
  bottomInset?: number;
  /** Mirror the rail so it follows a Z-A sorted list. */
  reversed?: boolean;
}) {
  const theme = useTheme();
  /** Rail geometry in window coordinates — the drag works in that space. */
  const railTopRef = useRef(0);
  const railHeightRef = useRef(0);
  const lastLetterRef = useRef<string | null>(null);

  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [bubbleTop, setBubbleTop] = useState(0);

  /** Rail order: top-to-bottom, mirrored when the list is sorted Z-A. */
  const letters = useMemo(() => (reversed ? [...LETTERS].reverse() : LETTERS), [reversed]);

  // The PanResponder is built once, so it would capture the first render's props.
  // Reading these through refs keeps the drag on the current order and results.
  const lettersRef = useRef(letters);
  lettersRef.current = letters;
  const availableLettersRef = useRef(availableLetters);
  availableLettersRef.current = availableLetters;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  /**
   * Map the finger to the letter drawn at that spot. Takes a *window* Y: touch
   * events report `locationY` against whatever element they hit, which changes
   * between the initial press and the moves that follow, so the drag would jump.
   * Window coordinates minus the rail's own offset stay in one frame of reference.
   */
  const handleTouch = (pageY: number) => {
    const railHeight = railHeightRef.current;
    if (railHeight <= 0) return;

    const railLetters = lettersRef.current;
    const localY = Math.min(Math.max(pageY - railTopRef.current, 0), railHeight);
    const slotHeight = railHeight / railLetters.length;
    const index = Math.min(Math.floor(localY / slotHeight), railLetters.length - 1);
    const letter = railLetters[index];

    setActiveLetter(letter);
    setBubbleTop(localY);

    // Only jump when the letter actually changes: a drag fires many move events.
    if (letter !== lastLetterRef.current) {
      lastLetterRef.current = letter;
      if (availableLettersRef.current.has(letter)) onSelectRef.current(letter);
    }
  };

  const endTouch = () => {
    lastLetterRef.current = null;
    setActiveLetter(null);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event, gesture) => {
        // Calibrate the window→rail offset from the press itself. On the initial
        // touch `locationY` *is* measured against the rail, so the difference
        // between the two is exactly where the rail sits in window space. Deriving
        // it here beats measuring: no mismatch between how touches and layout
        // measurements each treat the status bar under edge-to-edge.
        railTopRef.current = gesture.y0 - event.nativeEvent.locationY;
        handleTouch(gesture.y0);
      },
      // moveY is in the same window space as y0, so the frame never changes mid-drag.
      onPanResponderMove: (_event, gesture) => handleTouch(gesture.moveY),
      onPanResponderRelease: endTouch,
      onPanResponderTerminate: endTouch,
    }),
  ).current;

  const onRailLayout = (event: LayoutChangeEvent) => {
    // Height only — a size has no coordinate space to disagree about.
    railHeightRef.current = event.nativeEvent.layout.height;
  };

  return (
    <View style={[styles.root, { paddingBottom: bottomInset }]} pointerEvents="box-none">
      {activeLetter ? (
        <View
          pointerEvents="none"
          style={[
            styles.bubble,
            FloatingShadow,
            { backgroundColor: theme.accent, top: Spacing.three + bubbleTop - BUBBLE_SIZE / 2 },
          ]}>
          <ThemedText style={[styles.bubbleText, { color: theme.onAccent }]}>{activeLetter}</ThemedText>
        </View>
      ) : null}

      {/* box-only keeps the rail itself the touch target: `locationY` is measured
          against the touched element, so letter-sized children would report a
          position inside their own slot instead of along the rail. */}
      <View
        style={styles.rail}
        pointerEvents="box-only"
        onLayout={onRailLayout}
        {...panResponder.panHandlers}>
        {letters.map((letter) => {
          const available = availableLetters.has(letter);
          return (
            <View key={letter} style={styles.letterSlot}>
              <ThemedText
                style={[
                  styles.letter,
                  {
                    color: available ? theme.accent : theme.textSecondary,
                    opacity: available ? 1 : 0.35,
                  },
                ]}>
                {letter}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    // Wide enough to hold the bubble beside the rail without it being clipped.
    width: BUBBLE_SIZE + RAIL_WIDTH + Spacing.two,
    alignItems: 'flex-end',
    // Matches the product list's top padding so the rail starts at the first row.
    paddingTop: Spacing.three,
  },
  rail: {
    // flex (not content height) is what gives the rail a definite, bounded height.
    flex: 1,
    width: RAIL_WIDTH,
    marginRight: 2,
  },
  letterSlot: {
    // Equal share of the rail, so position maps to letter with no leftover space.
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  bubble: {
    position: 'absolute',
    right: RAIL_WIDTH + Spacing.two,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
});
