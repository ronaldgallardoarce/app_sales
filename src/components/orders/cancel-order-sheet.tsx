import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { CANCEL_REASONS, orderNumberLabel, type CancelReason } from '@/data/mock-orders';
import { useTheme } from '@/hooks/use-theme';

/**
 * Why an order is being annulled, asked before it is.
 *
 * A sheet and not a confirmation dialog, because it is not a yes/no: annulling costs the office a
 * sale it had already counted, and "the client changed their mind" and "we loaded it wrong" are
 * two different conversations for whoever reads the report. Picking from a list rather than typing
 * keeps those answers countable — see `CANCEL_REASONS`.
 *
 * Choosing a reason does not annul: the seller picks, then presses. One tap away from withdrawing
 * a confirmed order would make the list itself the destructive control, and a mis-tap on a row
 * would be unrecoverable — nothing here can be undone.
 *
 * Rendered inside the order detail sheet's own tree, never beside it. `BottomSheet` is a `Modal`,
 * and a second one raised as a sibling of the open sheet is presented underneath it and never
 * becomes visible.
 */
export function CancelOrderSheet({
  visible,
  onClose,
  orderId,
  clientName,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  orderId: number;
  clientName: string;
  onConfirm: (reason: CancelReason) => void;
}) {
  const theme = useTheme();
  const [reason, setReason] = useState<CancelReason | null>(null);

  // Reopening starts blank rather than on whatever was picked and abandoned last time: the reason
  // belongs to this annulment, and a pre-filled one is the seller confirming someone else's answer.
  useEffect(() => {
    if (visible) setReason(null);
  }, [visible]);

  const confirm = () => {
    if (!reason) return;
    onConfirm(reason);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight={520}
      footer={
        <View style={styles.footer}>
          <Pressable
            onPress={onClose}
            style={[styles.footerButton, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <ThemedText type="smallBold" style={styles.footerLabel}>
              Volver
            </ThemedText>
          </Pressable>

          <Pressable
            disabled={!reason}
            onPress={confirm}
            style={[
              styles.footerButton,
              { backgroundColor: theme.danger, borderColor: theme.danger, opacity: reason ? 1 : 0.4 },
            ]}>
            <Icon name="xmark" size={14} color={theme.onDanger} />
            <ThemedText type="smallBold" numberOfLines={1} style={[styles.footerLabel, { color: theme.onDanger }]}>
              Anular pedido
            </ThemedText>
          </Pressable>
        </View>
      }>
      <View style={styles.container}>
        <ThemedText type="smallBold" style={styles.title}>
          Anular el pedido {orderNumberLabel(orderId)}
        </ThemedText>
        {/* Names the client, because the sheet can be reached from a list where several orders
            look alike, and this is the last screen before the order is withdrawn. */}
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {clientName}. Elegí el motivo: queda guardado en el pedido y no se puede deshacer.
        </ThemedText>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {CANCEL_REASONS.map((option) => {
            const active = option === reason;
            return (
              <Pressable
                key={option}
                onPress={() => setReason(option)}
                style={[
                  styles.row,
                  {
                    backgroundColor: active ? theme.dangerSoft : theme.background,
                    borderColor: active ? theme.danger : theme.border,
                  },
                ]}>
                {/* Danger-coloured selection, not the usual accent: what is being chosen here is
                    the grounds for destroying the order, and it should not look like picking a
                    delivery window. */}
                {active ? (
                  <Icon name="checkmark.circle.fill" size={17} color={theme.danger} />
                ) : (
                  <View style={[styles.radio, { borderColor: theme.border }]} />
                )}
                <ThemedText
                  type="smallBold"
                  numberOfLines={2}
                  style={[styles.rowLabel, active ? { color: theme.danger } : null]}>
                  {option}
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
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: ControlHeight.input,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
  // The unpicked half of the marker. Same 17 points the checkmark takes, so choosing a reason
  // swaps the glyph without the label beside it moving.
  radio: {
    width: 17,
    height: 17,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  footerLabel: {
    flexShrink: 1,
    fontSize: 13,
  },
});
