import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { UnitCode } from '@/types/catalog';

export function QuantityStepper({
  unit,
  unitLabel,
  qty,
  onChange,
}: {
  unit: UnitCode;
  /** This product's name for the unit, e.g. "Caja" or "Botella". */
  unitLabel: string;
  qty: number;
  onChange: (qty: number) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(String(qty));
  const isCaja = unit === 'CAJA';

  // qty can change from outside (switching variant, committing to cart) — keep the field in sync.
  useEffect(() => {
    setText(String(qty));
  }, [qty]);

  const commit = (value: string) => {
    const parsed = Math.max(0, Math.floor(Number(value.replace(/[^0-9]/g, '')) || 0));
    setText(String(parsed));
    onChange(parsed);
  };

  return (
    <View style={[styles.row, { backgroundColor: theme.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
        <Icon name={isCaja ? 'shippingbox.fill' : 'cube.box.fill'} size={16} color={theme.accent} />
      </View>

      <View style={styles.labelCol}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {unitLabel}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.roleLabel} numberOfLines={1}>
          {isCaja ? 'Unidad máxima' : 'Unidad mínima'}
        </ThemedText>
      </View>

      <View style={styles.stepper}>
        <Pressable
          hitSlop={8}
          onPress={() => {
            const next = Math.max(0, qty - 1);
            setText(String(next));
            onChange(next);
          }}
          style={[styles.stepButton, { backgroundColor: theme.accentSoft }]}>
          <Icon name="minus" size={14} color={theme.accent} />
        </Pressable>

        <TextInput
          value={text}
          onChangeText={setText}
          onEndEditing={(e) => commit(e.nativeEvent.text)}
          onBlur={() => commit(text)}
          keyboardType="number-pad"
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />

        <Pressable
          hitSlop={8}
          onPress={() => {
            const next = qty + 1;
            setText(String(next));
            onChange(next);
          }}
          style={[styles.stepButton, { backgroundColor: theme.accentSoft }]}>
          <Icon name="plus" size={14} color={theme.accent} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    gap: Spacing.two,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelCol: {
    // Takes the slack instead of a fixed width, so the stepper lands on the right
    // edge rather than leaving dead space beside it.
    flex: 1,
    gap: 1,
  },
  roleLabel: {
    fontSize: 11,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepButton: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    width: 42,
    height: 26,
    borderRadius: Radius.sm,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
});
