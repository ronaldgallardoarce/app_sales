import { LinearGradient } from 'expo-linear-gradient';
import { Children, type ReactNode, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { withAlpha } from '@/utils/color';

/** How much of the trailing card the fade covers. Enough to read as "cut off", not as a veil. */
const FADE_WIDTH = 32;

const BAR_HEIGHT = 4;
const BAR_WIDTH = 6;
/** The active bar grows instead of changing color, so the cue survives a glance in either theme. */
const ACTIVE_BAR_WIDTH = 16;

/**
 * A horizontal row of suggestion cards that says it scrolls, with two cues.
 *
 * The first is a short fade over the right edge: the trailing card dissolves instead of ending,
 * which is what tells the seller there is more to the right. The native indicator is not an
 * option — on Android it is a permanent bar that belongs to no other surface in this app.
 *
 * The second is a row of bars under the strip, one per card, telling the seller how many there
 * are and roughly where they stand. The strip does not snap, so the bars map the scroll *range*
 * onto the cards rather than pretending each card is a page: resting at the start lights the
 * first bar, resting at the end lights the last, and nothing in between ever claims more
 * precision than free scrolling has. That also keeps the component from having to know how wide
 * a `SuggestionCard` is.
 *
 * Both cues hide themselves when there is nothing to scroll to. The bars need the measurements
 * to know that; the fade gets it for free, because with few enough cards it lands on the
 * container's own background, which is exactly the color it fades to.
 */
export function SuggestionStrip({ children, fadeTo }: { children: ReactNode; fadeTo: string }) {
  const theme = useTheme();
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const count = Children.count(children);
  const travel = contentWidth - viewportWidth;
  // A single card, or cards that already fit, have nothing to indicate.
  const showBars = count > 1 && travel > 1;

  const handleLayout = (event: LayoutChangeEvent) => setViewportWidth(event.nativeEvent.layout.width);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (travel <= 1) return;
    const progress = Math.min(Math.max(event.nativeEvent.contentOffset.x / travel, 0), 1);
    const next = Math.round(progress * (count - 1));
    if (next !== activeIndex) setActiveIndex(next);
  };

  return (
    <View>
      <View style={styles.track}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
          onLayout={handleLayout}
          onContentSizeChange={setContentWidth}
          onScroll={handleScroll}
          scrollEventThrottle={32}>
          {children}
        </ScrollView>

        {/* Alpha-zero `fadeTo` rather than `'transparent'`: Android interpolates that keyword
            through transparent *black*, which smears a grey haze over the cards instead of
            fading them out. Which color to land on is why this is a prop — only the caller
            knows what surface the strip is sitting on. */}
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(fadeTo, 0), fadeTo]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.fade}
        />
      </View>

      {showBars ? (
        <View pointerEvents="none" style={styles.bars}>
          {Children.map(children, (_, index) => (
            <View
              style={[
                styles.bar,
                index === activeIndex && styles.barActive,
                {
                  backgroundColor:
                    index === activeIndex ? theme.textSecondary : withAlpha(theme.textSecondary, 0.3),
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
  },
  cardsRow: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
    paddingTop: Spacing.one,
  },
  fade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: FADE_WIDTH,
  },
  bars: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  bar: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: Radius.pill,
  },
  barActive: {
    width: ACTIVE_BAR_WIDTH,
  },
});
