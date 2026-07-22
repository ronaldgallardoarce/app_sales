import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon, type IconName } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TravelMode } from '@/utils/routing';

type OriginMode = 'current' | 'custom';

export function RouteSheet({
  visible,
  onClose,
  originMode,
  hasCustomStart,
  travelMode,
  routeActive,
  onSelectOrigin,
  onConfirm,
  onClear,
}: {
  visible: boolean;
  onClose: () => void;
  /** Pending origin choice — set as soon as the user picks it, even before confirming. */
  originMode: OriginMode | null;
  hasCustomStart: boolean;
  travelMode: TravelMode;
  routeActive: boolean;
  onSelectOrigin: (origin: OriginMode) => void;
  onConfirm: (mode: TravelMode) => void;
  onClear: () => void;
}) {
  const theme = useTheme();
  const [draftMode, setDraftMode] = useState<TravelMode>(travelMode);

  useEffect(() => {
    if (visible) setDraftMode(travelMode);
  }, [visible, travelMode]);

  const canConfirm = originMode === 'current' || (originMode === 'custom' && hasCustomStart);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      footer={
        <View style={styles.footerRow}>
          {routeActive ? (
            <Pressable onPress={onClear} style={styles.clearButton}>
              <Icon name="xmark.circle.fill" size={13} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                Quitar ruta
              </ThemedText>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable
            disabled={!canConfirm}
            onPress={() => onConfirm(draftMode)}
            style={[
              styles.confirmButton,
              { backgroundColor: canConfirm ? theme.accent : theme.backgroundSelected },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: canConfirm ? theme.onAccent : theme.textSecondary }}>
              Calcular ruta
            </ThemedText>
          </Pressable>
        </View>
      }>
      <View style={styles.container}>
        <ThemedText type="smallBold" style={styles.title}>
          Ruta óptima
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Elige desde dónde empezar y cómo te desplazas.
        </ThemedText>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          Punto de partida
        </ThemedText>
        <OptionRow
          icon="mappin"
          label="Mi ubicación actual"
          active={originMode === 'current'}
          onPress={() => onSelectOrigin('current')}
        />
        <OptionRow
          icon="hand.tap"
          label={
            hasCustomStart && originMode === 'custom' ? 'Punto elegido en el mapa ✓' : 'Elegir un punto en el mapa'
          }
          active={originMode === 'custom'}
          onPress={() => onSelectOrigin('custom')}
        />

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          Modo de desplazamiento
        </ThemedText>
        <View style={[styles.modeGroup, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <ModeOption
            label="Caminando"
            icon="figure.walk"
            active={draftMode === 'walking'}
            onPress={() => setDraftMode('walking')}
          />
          <ModeOption
            label="Moto"
            icon="moto.fill"
            active={draftMode === 'motorcycle'}
            onPress={() => setDraftMode('motorcycle')}
          />
          <ModeOption
            label="Vehículo"
            icon="car.fill"
            active={draftMode === 'driving'}
            onPress={() => setDraftMode('driving')}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

function OptionRow({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: active ? theme.accentSoft : theme.background, borderColor: theme.border }]}>
      <Icon name={icon} size={16} color={active ? theme.accent : theme.textSecondary} />
      <ThemedText
        type="small"
        numberOfLines={1}
        style={[styles.rowLabel, { color: active ? theme.accent : theme.text, fontWeight: active ? '700' : '500' }]}>
        {label}
      </ThemedText>
      {active ? <Icon name="checkmark" size={14} color={theme.accent} /> : null}
    </Pressable>
  );
}

function ModeOption({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeOption, active ? { backgroundColor: theme.accent } : null]}>
      <Icon name={icon} size={16} color={active ? theme.onAccent : theme.text} />
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={[styles.modeOptionLabel, { color: active ? theme.onAccent : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  rowLabel: {
    flex: 1,
  },
  modeGroup: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
    borderRadius: Radius.sm,
  },
  modeOptionLabel: {
    fontSize: 11,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confirmButton: {
    height: ControlHeight.input,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
