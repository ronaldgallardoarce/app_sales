import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { PAYMENT_METHODS, type PaymentMethod } from '@/data/mock-incentives';
import { useTheme } from '@/hooks/use-theme';

/**
 * Picker for the order's payment terms.
 *
 * A sheet and not a segmented control, because the terms come from the backend: two of them fitted
 * side by side, five would not, and each one would have shrunk to an unreadable sliver as the list
 * grew. A sheet costs one tap and is the same control whether it holds two options or ten.
 *
 * Raised from inside the order sheet, which only works because `BottomSheet` is a `Modal` nested in
 * the caller's own tree — the same thing the gift picker does from the confirm screen. A second
 * sheet raised as a *sibling* of the open one is presented underneath it and never appears.
 *
 * Names only, no note under each one: these are terms the seller already knows, and what "Pronto
 * pago" costs the client is spelled out by the panel's own notice once it is the chosen one.
 */
export function PaymentMethodSheet({
  visible,
  onClose,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}) {
  const theme = useTheme();

  const select = (method: PaymentMethod) => {
    onSelect(method);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={420}>
      <View style={styles.container}>
        <ThemedText type="smallBold" style={styles.title}>
          Método de pago
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Define las condiciones del pedido y el descuento que se calcula sobre él.
        </ThemedText>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {PAYMENT_METHODS.map((method) => {
            const active = method === selected;
            return (
              <Pressable
                key={method}
                onPress={() => select(method)}
                style={[
                  styles.row,
                  {
                    backgroundColor: active ? theme.accentSoft : theme.background,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}>
                <Icon
                  name={active ? 'checkmark.circle.fill' : 'cash'}
                  size={17}
                  color={active ? theme.accent : theme.textSecondary}
                />
                <ThemedText
                  type="smallBold"
                  numberOfLines={1}
                  style={[styles.rowLabel, active ? { color: theme.accent } : null]}>
                  {method}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 15,
    lineHeight: 19,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  list: {
    gap: 6,
    paddingTop: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
});
