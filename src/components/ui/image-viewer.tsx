import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Full-screen viewer for a set of images, opened on one of them.
 *
 * It takes the whole set rather than a single uri on purpose: someone checking evidence
 * photos wants to look through all of them, and a one-image viewer forces a close-and-tap
 * round trip between each. Paging is horizontal, and the counter tells the viewer how many
 * there are — without it, a swipeable surface gives no hint that anything else exists.
 */
export function ImageViewer({
  visible,
  uris,
  initialIndex = 0,
  onClose,
}: {
  visible: boolean;
  uris: string[];
  /** Which image to open on — the one that was tapped. */
  initialIndex?: number;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(initialIndex);

  // Jump to the tapped image without animating: the viewer should open already showing it,
  // not scroll there in front of the viewer. Re-runs on `width` so a rotation keeps the
  // current page aligned instead of leaving it mid-gutter.
  useEffect(() => {
    if (!visible) return;
    setIndex(initialIndex);
    // The ScrollView has to be laid out before it can be scrolled, hence the frame delay.
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: initialIndex * width, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, initialIndex, width]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(Math.max(0, Math.min(uris.length - 1, page)));
  };

  if (uris.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}>
          {uris.map((uri) => (
            // Each page is a full-screen tap target that dismisses: the backdrop around a
            // contained image is part of the page, so a tap beside the photo has to close
            // rather than land on nothing.
            <Pressable key={uri} onPress={onClose} style={{ width, height }}>
              <Image source={{ uri }} style={styles.image} contentFit="contain" transition={150} />
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          onPress={onClose}
          style={[styles.close, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="xmark" size={18} color={theme.text} />
        </Pressable>

        {/* Only worth showing when there is somewhere to swipe to. */}
        {uris.length > 1 ? (
          <View style={[styles.counter, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" style={styles.counterText}>
              {index + 1}/{uris.length}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Overlay,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  close: {
    position: 'absolute',
    top: 60,
    right: Spacing.four,
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    bottom: Spacing.six,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  counterText: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
