import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function AlphabetIndex({
  availableLetters,
  onSelect,
}: {
  availableLetters: Set<string>;
  onSelect: (letter: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.container} pointerEvents="box-none">
      {LETTERS.map((letter) => {
        const active = availableLetters.has(letter);
        return (
          <Pressable
            key={letter}
            disabled={!active}
            hitSlop={2}
            onPress={() => onSelect(letter)}
            style={styles.letterHit}>
            <ThemedText
              style={[
                styles.letter,
                { color: active ? theme.accent : theme.textSecondary, opacity: active ? 1 : 0.35 },
              ]}>
              {letter}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterHit: {
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  letter: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
