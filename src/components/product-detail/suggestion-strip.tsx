import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

/** How much of the trailing card the fade covers. Enough to read as "cut off", not as a veil. */
const FADE_WIDTH = 32;

/**
 * A horizontal row of suggestion cards that says it scrolls. The cue is a short fade over the
 * right edge: the trailing card dissolves instead of ending, which is what tells the seller
 * there is more to the right. The native indicator is not an option — on Android it is a
 * permanent bar that belongs to no other surface in this app.
 *
 * It hides itself when there is nothing to scroll to. With few enough cards the fade lands on
 * the container's own background, which is exactly the color it fades to, so it disappears
 * without measuring content width or tracking the scroll offset.
 */
export function SuggestionStrip({ children, fadeTo }: { children: ReactNode; fadeTo: string }) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsRow}>
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
  );
}

const styles = StyleSheet.create({
  wrap: {
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
});
