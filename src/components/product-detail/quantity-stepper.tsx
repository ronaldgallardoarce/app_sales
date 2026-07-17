import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { UnitCode } from '@/types/catalog';

export function QuantityStepper({
  unit,
  qty,
  unitsPerCase,
  onChange,
}: {
  unit: UnitCode;
  qty: number;
  unitsPerCase: number;
  onChange: (qty: number) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(String(qty));
  const isCaja = unit === 'CAJA';

  // qty can change from outside (switching variant, committing to cart) — keep the field in sync.
  useEffect(() => {
    setText(String(qty));
  }, [qty]);
  const totalUnits = isCaja ? qty * unitsPerCase : qty;

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
        <ThemedText type="smallBold">{isCaja ? 'Cajas' : 'Unidades sueltas'}</ThemedText>
        <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
          {isCaja ? `1 CAJA = ${unitsPerCase} UNIDADES` : 'UNIDAD'}
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

      {/* <ThemedText themeColor="textSecondary" type="small" style={styles.equivalence}>
        = {totalUnits} uds
      </ThemedText> */}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelCol: {
    width: 100,
    gap: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    width: 40,
    height: 28,
    borderRadius: Radius.sm,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  equivalence: {
    flex: 1,
    textAlign: 'right',
  },
});
