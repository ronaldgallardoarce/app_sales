import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ThemedText } from '@/components/themed-text';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { useTheme } from '@/hooks/use-theme';
import { formatBs } from '@/utils/currency';

const PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Crédito'] as const;
const DISCOUNTS = [0, 5, 10, 15] as const;

export function OrderPanel({ contentPaddingBottom }: { contentPaddingBottom: number }) {
  const theme = useTheme();
  const { lines, removeLine, setLineQty, clearCart, totalAmount } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>('Efectivo');
  const [discountPct, setDiscountPct] = useState<(typeof DISCOUNTS)[number]>(0);
  const [bonification, setBonification] = useState('');

  const discountAmount = (totalAmount * discountPct) / 100;
  const finalTotal = totalAmount - discountAmount;

  const handleSavePreorder = () => {
    Alert.alert('Prepedido guardado', 'El pedido quedó guardado como borrador. Podrás retomarlo más tarde.');
  };

  const handleConfirm = () => {
    Alert.alert('Pedido confirmado', `Se registró el pedido por ${formatBs(finalTotal)}.`, [
      { text: 'OK', onPress: clearCart },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: contentPaddingBottom }]}
      showsVerticalScrollIndicator={false}>
      <ThemedText type="smallBold" style={styles.title}>
        Tu Pedido
      </ThemedText>

      {lines.length === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          Aún no agregaste productos.
        </ThemedText>
      ) : (
        lines.map((line) => (
          <View key={line.id} style={[styles.line, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={styles.lineInfo}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {line.productName}
                {line.flavor ? ` · ${line.flavor}` : ''}
              </ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {line.qty} {line.unit} · {formatBs(line.unitPrice)} c/u
              </ThemedText>
            </View>
            <View style={styles.lineRight}>
              <ThemedText style={styles.lineSubtotal}>{formatBs(line.qty * line.unitPrice)}</ThemedText>
              <Pressable
                hitSlop={8}
                onPress={() => setLineQty(line.id, line.qty - 1)}
                style={[styles.iconButton, { backgroundColor: theme.backgroundSelected }]}>
                <Icon name="minus" size={13} color={theme.textSecondary} />
              </Pressable>
              <Pressable
                hitSlop={8}
                onPress={() => removeLine(line.id)}
                style={[styles.iconButton, { backgroundColor: theme.backgroundSelected }]}>
                <Icon name="trash" size={13} color={theme.danger} />
              </Pressable>
            </View>
          </View>
        ))
      )}

      <View style={[styles.section, { borderTopColor: theme.border }]}>
        <ThemedText type="smallBold">Método de pago</ThemedText>
        <View style={styles.chipsRow}>
          {PAYMENT_METHODS.map((method) => {
            const active = method === paymentMethod;
            return (
              <Pressable
                key={method}
                onPress={() => setPaymentMethod(method)}
                style={[
                  styles.chip,
                  { backgroundColor: active ? theme.accent : theme.backgroundElement, borderColor: active ? theme.accent : theme.border },
                ]}>
                <ThemedText style={[styles.chipText, { color: active ? theme.onAccent : theme.text }]}>
                  {method}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.section, { borderTopColor: theme.border }]}>
        <ThemedText type="smallBold">Descuentos y bonificaciones</ThemedText>
        <View style={styles.chipsRow}>
          {DISCOUNTS.map((pct) => {
            const active = pct === discountPct;
            return (
              <Pressable
                key={pct}
                onPress={() => setDiscountPct(pct)}
                style={[
                  styles.chip,
                  { backgroundColor: active ? theme.accent : theme.backgroundElement, borderColor: active ? theme.accent : theme.border },
                ]}>
                <ThemedText style={[styles.chipText, { color: active ? theme.onAccent : theme.text }]}>
                  {pct === 0 ? 'Sin descuento' : `${pct}%`}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={bonification}
          onChangeText={setBonification}
          placeholder="Bonificación (ej: 2 unidades gratis)"
          placeholderTextColor={theme.textSecondary}
          style={[styles.bonusInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        />
      </View>

      <View style={[styles.totalsSection, { borderTopColor: theme.border }]}>
        <View style={styles.totalRow}>
          <ThemedText themeColor="textSecondary" type="small">
            Subtotal
          </ThemedText>
          <ThemedText type="small">{formatBs(totalAmount)}</ThemedText>
        </View>
        {discountPct > 0 ? (
          <View style={styles.totalRow}>
            <ThemedText themeColor="textSecondary" type="small">
              Descuento ({discountPct}%)
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.danger }}>
              -{formatBs(discountAmount)}
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.totalRow}>
          <ThemedText type="smallBold">Total</ThemedText>
          <ThemedText style={styles.totalValue}>{formatBs(finalTotal)}</ThemedText>
        </View>
      </View>

      <View style={styles.footerButtons}>
        <Pressable
          onPress={handleSavePreorder}
          style={[styles.outlineButton, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <Icon name="tray.and.arrow.down" size={15} color={theme.text} />
          <ThemedText type="smallBold" style={styles.buttonLabel}>
            Guardar Prepedido
          </ThemedText>
        </Pressable>
        <Pressable
          disabled={lines.length === 0}
          onPress={handleConfirm}
          style={[styles.confirmButton, { backgroundColor: theme.success, opacity: lines.length === 0 ? 0.4 : 1 }]}>
          <Icon name="cart" size={15} color={theme.onSuccess} />
          <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onSuccess }]}>
            Confirmar Pedido
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
    marginBottom: Spacing.one,
  },
  empty: {
    paddingVertical: Spacing.five,
    textAlign: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  lineInfo: {
    flex: 1,
    gap: 3,
  },
  lineRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  lineSubtotal: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginRight: 4,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  bonusInput: {
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
  },
  totalsSection: {
    gap: 6,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  footerButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  outlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
  buttonLabel: {
    fontSize: 12,
  },
});
