import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ProductVariant } from '@/types/catalog';
import { formatBs } from '@/utils/currency';

export function VariantChip({
  variant,
  familyLabel,
  selected,
  onPress,
}: {
  variant: ProductVariant;
  familyLabel: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}>
      <ThemedText style={[styles.family, { color: theme.textSecondary }]} numberOfLines={1}>
        {familyLabel}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
        {variant.flavor}
      </ThemedText>
      <ThemedText style={[styles.price, { color: theme.accent }]}>{formatBs(variant.priceUnidad)}</ThemedText>

      {selected ? (
        <View style={[styles.checkBadge, { backgroundColor: theme.accent, borderColor: theme.backgroundElement }]}>
          <Icon name="checkmark" size={11} color={theme.onAccent} />
        </View>
      ) : (
        <View style={[styles.addBadge, { backgroundColor: theme.accentSoft }]}>
          <Icon name="plus" size={13} color={theme.accent} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 132,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    padding: Spacing.two,
    gap: 4,
  },
  family: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  checkBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBadge: {
    position: 'absolute',
    bottom: Spacing.two,
    right: Spacing.two,
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
