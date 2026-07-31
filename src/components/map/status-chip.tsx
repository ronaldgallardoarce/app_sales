import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PulseDot } from '@/components/ui/pulse-dot';
import { ChipPadding, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One visit-status filter. Shared by the map and the client list, which offer the same row of
 * them over the same clients — they had a copy each, and the second one silently stopped matching
 * the first the moment either grew a feature.
 *
 * `count` and `live` answer two different questions and are deliberately not wired to the same
 * number. The count says how many clients this filter would show, which is a fact about the
 * status. The pulse says a visit is running right now, which is a fact about where the seller is —
 * and after an order stopped closing visits, a client can be both "visitado" and still being
 * stood in. Numbers describe the list; motion describes the moment.
 */
export function StatusChip({
  label,
  active,
  color,
  soft,
  count,
  live = false,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  soft: string;
  /** Rendered after the label when there is anything to count. */
  count?: number;
  live?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? soft : theme.backgroundElement,
          borderColor: active ? color : theme.border,
        },
      ]}>
      <PulseDot color={color} size={6} live={live} />
      <ThemedText
        type="smallBold"
        style={[styles.text, { color: active ? color : theme.textSecondary }]}>
        {label}
      </ThemedText>
      {count !== undefined && count > 0 ? (
        <View style={[styles.count, { backgroundColor: soft }]}>
          <ThemedText type="smallBold" style={[styles.countText, { color }]}>
            {count}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
  },
  count: {
    minWidth: 16,
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  countText: {
    fontSize: 10,
    lineHeight: 13,
    fontVariant: ['tabular-nums'],
  },
});
