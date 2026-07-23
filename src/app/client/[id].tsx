import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon, type IconName } from '@/components/ui/icon';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import { CHANNEL_META, CLIENT_STATE_META, EXIT_REASONS, REMOTE_REASONS, STATUS_META } from '@/data/mock-clients';
import { mockSeller } from '@/data/mock-user';
import { useClientVisits } from '@/context/client-visit-context';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';
import type { ThemeColor } from '@/constants/theme';
import { distanceKm, formatDistance } from '@/utils/geo';

type TravelMode = 'walking' | 'driving';
type VisitStep = 'none' | 'entrada' | 'tarea' | 'remoto';

/** Geofence radius (meters) within which the seller is allowed to check in on-site. */
const MIN_CHECKIN_DISTANCE_M = 300;

const VISIT_STEPS: { key: string; label: string; icon: IconName }[] = [
  { key: 'entrada', label: 'Entrada', icon: 'mappin' },
  { key: 'tarea', label: 'Tarea', icon: 'clipboard' },
  { key: 'salida', label: 'Salida', icon: 'checkmark' },
];

export default function ClientDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useContentInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clients, activityOf, startedAtOf, startVisitTimer, markEntry, markExceptionalExit } =
    useClientVisits();
  const [visitStep, setVisitStep] = useState<VisitStep>('none');
  const [exitVisible, setExitVisible] = useState(false);
  const [exitReason, setExitReason] = useState<string | null>(null);
  const [exitPhotos, setExitPhotos] = useState<string[]>([]);
  const [remoteReason, setRemoteReason] = useState<string | null>(null);
  const [remoteSheetVisible, setRemoteSheetVisible] = useState(false);

  const client = clients.find((c) => c.id === id) ?? null;

  // Only 'no-visitado' clients still need to check in; the rest already did, so
  // "In situ" takes them straight to the task step.
  const needsCheckIn = client?.status === 'no-visitado';

  const goBack = () => {
    if (visitStep === 'tarea') {
      setVisitStep(needsCheckIn ? 'entrada' : 'none');
      return;
    }
    if (visitStep === 'entrada' || visitStep === 'remoto') {
      setVisitStep('none');
      return;
    }
    router.canGoBack() ? router.back() : router.replace('/map' as Href);
  };

  if (!client) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: theme.background }]}>
        <Icon name="person.2.fill" size={28} color={theme.textSecondary} />
        <ThemedText type="smallBold">Cliente no encontrado</ThemedText>
        <Pressable onPress={goBack} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Volver
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const state = CLIENT_STATE_META[client.clientState];
  const visit = STATUS_META[client.status];
  const soon = () => Alert.alert('Próximamente', 'Esta opción estará disponible pronto.');

  const distanceM = Math.round(distanceKm(mockSeller.location, client) * 1000);
  const withinRange = distanceM <= MIN_CHECKIN_DISTANCE_M;

  // Exceptional exit → "trabajado" if any task was done during the visit, else "cerrado-observado".
  const willBeWorked = activityOf(client.id).tasksDone;
  const canConfirmExit = exitReason !== null && exitPhotos.length > 0;

  const confirmEntry = () => {
    if (!withinRange) return;
    markEntry(client.id); // client becomes "iniciado"
    setVisitStep('tarea');
  };

  const confirmExit = () => {
    if (!exitReason || exitPhotos.length === 0) return;
    markExceptionalExit(client.id, { reason: exitReason, photos: exitPhotos });
    setExitVisible(false);
    setExitReason(null);
    setExitPhotos([]);
    setVisitStep('none');
  };

  const openDirections = (mode: TravelMode) =>
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${client.lat},${client.lng}&travelmode=${mode}`,
    );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable
            hitSlop={8}
            onPress={goBack}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="chevron.left" size={18} color={theme.text} />
          </Pressable>

          <View style={styles.titleColumn}>
            <ThemedText type="smallBold" style={styles.headerTitle}>
              {visitStep === 'none' ? 'Cliente' : visitStep === 'remoto' ? 'Pedido remoto' : 'Visita in situ'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {client.code}-{client.name}
            </ThemedText>
          </View>

          <Chip icon="clock.fill" label={visit.label} color={theme[visit.color]} soft={theme[visit.soft]} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.three }]}>
        {/* Summary — identity, metrics and purchase limit in one compact card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.identityRow}>
            <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
              <Icon name="person.crop.circle" size={22} color={theme.accent} />
            </View>
            <View style={styles.identityText}>
              <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
                {client.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Código {client.code}
              </ThemedText>
            </View>
          </View>

          <View style={styles.chipsRow}>
            <Chip icon="tag.fill" label={CHANNEL_META[client.channel].label} color={theme.textSecondary} soft={theme.backgroundSelected} />
            <Chip icon="hand.tap" label={state.label} color={theme[state.color]} soft={theme[state.soft]} />
            <Chip
              icon="creditcard"
              label={client.hasCreditLine ? 'Con crédito' : 'Sin crédito'}
              color={client.hasCreditLine ? theme.success : theme.textSecondary}
              soft={client.hasCreditLine ? theme.successSoft : theme.backgroundSelected}
            />
            <Chip
              icon="scope"
              label={client.isPareto ? 'Pareto' : 'No Pareto'}
              color={client.isPareto ? theme.accent : theme.textSecondary}
              soft={client.isPareto ? theme.accentSoft : theme.backgroundSelected}
            />
          </View>

          <View style={[styles.hr, { backgroundColor: theme.border }]} />

          <View style={styles.grid}>
            <StatTile label="Deuda total" value={`Bs ${client.balance}`} />
            <StatTile
              label="Deuda mora"
              value={`Bs ${client.overdueDebt}`}
              tone={client.overdueDebt > 0 ? theme.danger : undefined}
            />
            <StatTile
              label="Días rest."
              value={client.daysRemaining > 0 ? `${client.daysRemaining} días` : 'Vencido'}
              tone={client.daysRemaining === 0 ? theme.danger : undefined}
            />
            <StatTile label="Últ. compra" value={client.lastPurchase} />
            <StatTile label="Ticket prom." value={`Bs ${client.avgTicket}`} />
            <StatTile label="Drop size" value={`Bs ${client.dropSize}`} />
          </View>

          {visitStep !== 'entrada' ? (
            <>
              <View style={[styles.hr, { backgroundColor: theme.border }]} />

              <View style={styles.limitHeader}>
                <ThemedText type="small" themeColor="textSecondary">
                  Límite de compras
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: client.purchaseLimitPct >= 85 ? theme.danger : theme.accent }}>
                  {client.purchaseLimitPct}%
                </ThemedText>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(client.purchaseLimitPct, 100)}%`,
                      backgroundColor: client.purchaseLimitPct >= 85 ? theme.danger : theme.accent,
                    },
                  ]}
                />
              </View>
            </>
          ) : null}
        </View>

        {visitStep === 'entrada' ? (
          <>
            {/* Visit progress */}
            <Stepper currentIndex={0} />

            {/* Distance / geofence */}
            <View style={[styles.card, styles.distanceCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={styles.distanceTop}>
                <View style={[styles.distanceIcon, { backgroundColor: theme.accentSoft }]}>
                  <Icon name="mappin" size={20} color={theme.accent} />
                </View>
                <View style={styles.distanceText}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Distancia al cliente
                  </ThemedText>
                  <ThemedText type="smallBold" style={styles.distanceValue}>
                    {formatDistance(distanceM / 1000)}
                  </ThemedText>
                </View>
                <View style={[styles.rangeChip, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.rangeChipText}>
                    Rango {MIN_CHECKIN_DISTANCE_M} m
                  </ThemedText>
                </View>
              </View>

              <View
                style={[
                  styles.statusBanner,
                  { backgroundColor: withinRange ? theme.successSoft : theme.dangerSoft },
                ]}>
                <Icon
                  name={withinRange ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
                  size={16}
                  color={withinRange ? theme.success : theme.danger}
                />
                <ThemedText
                  type="smallBold"
                  style={[styles.statusBannerText, { color: withinRange ? theme.success : theme.danger }]}>
                  {withinRange
                    ? 'Estás dentro del rango para marcar entrada'
                    : 'Estás demasiado lejos para marcar entrada'}
                </ThemedText>
              </View>
            </View>

            <Pressable
              onPress={confirmEntry}
              disabled={!withinRange}
              style={[
                styles.primaryButton,
                { backgroundColor: withinRange ? theme.accent : theme.backgroundSelected },
              ]}>
              <Icon name="mappin" size={16} color={withinRange ? theme.onAccent : theme.textSecondary} />
              <ThemedText type="smallBold" style={{ color: withinRange ? theme.onAccent : theme.textSecondary }}>
                Marcar entrada
              </ThemedText>
            </Pressable>
          </>
        ) : visitStep === 'remoto' ? (
          <>
            {/* Remote-order card — no stepper: this is not an on-site visit */}
            <View style={[styles.card, styles.distanceCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={styles.distanceTop}>
                <View style={[styles.distanceIcon, { backgroundColor: theme.violetSoft }]}>
                  <Icon name="smartphone" size={20} color={theme.violet} />
                </View>
                <View style={styles.distanceText}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Pedido remoto
                  </ThemedText>
                  <ThemedText type="smallBold" style={styles.remoteHeading}>
                    Solo casos especiales
                  </ThemedText>
                </View>
              </View>

              {/* Semi-transparent warning badge with border */}
              <View
                style={[
                  styles.warningBadge,
                  {
                    backgroundColor: withAlpha(theme.accentAlt, 0.12),
                    borderColor: withAlpha(theme.accentAlt, 0.4),
                  },
                ]}>
                <Icon name="exclamationmark.circle" size={15} color={theme.accentAlt} />
                <ThemedText type="small" style={[styles.warningBadgeText, { color: theme.accentAlt }]}>
                  El pedido remoto solo debe hacerse en casos especiales, no en cualquier momento.
                </ThemedText>
              </View>
            </View>

            {/* Reason — opens a picker sheet */}
            <SectionLabel>Motivo del pedido remoto</SectionLabel>
            <Pressable
              onPress={() => setRemoteSheetVisible(true)}
              style={[
                styles.selectRow,
                { backgroundColor: theme.backgroundElement, borderColor: remoteReason ? theme.violet : theme.border },
              ]}>
              <Icon name="list.bullet" size={16} color={remoteReason ? theme.violet : theme.textSecondary} />
              <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={[styles.selectText, { color: remoteReason ? theme.text : theme.textSecondary }]}>
                {remoteReason ?? 'Seleccionar motivo'}
              </ThemedText>
              <Icon name="chevron.down" size={14} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              onPress={() => router.push({ pathname: '/catalog', params: { clientId: client.id } } as Href)}
              disabled={!remoteReason}
              style={[
                styles.primaryButton,
                { backgroundColor: remoteReason ? theme.violet : theme.backgroundSelected },
              ]}>
              <Icon name="cart" size={16} color={remoteReason ? theme.onAccent : theme.textSecondary} />
              <ThemedText type="smallBold" style={{ color: remoteReason ? theme.onAccent : theme.textSecondary }}>
                Continuar al catálogo
              </ThemedText>
            </Pressable>
          </>
        ) : visitStep === 'tarea' ? (
          <>
            {/* Visit progress */}
            <Stepper currentIndex={1} />

            {/* Elapsed time since check-in */}
            <VisitTimer startedAt={startedAtOf(client.id)} />

            {/* Primary action — the whole point of the visit: open the product catalog */}
            <Pressable
              onPress={() => router.push({ pathname: '/catalog', params: { clientId: client.id } } as Href)}
              style={[styles.orderCard, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
              <View style={[styles.orderIcon, { backgroundColor: theme.accent }]}>
                <Icon name="cart" size={20} color={theme.onAccent} />
              </View>
              <View style={styles.orderText}>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  Realizar pedido
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  Ir al catálogo de productos
                </ThemedText>
              </View>
              <Icon name="chevron.right" size={18} color={theme.accent} />
            </Pressable>

            {/* Secondary visit actions */}
            <SectionLabel>Durante la visita</SectionLabel>
            <View style={styles.optionsRow}>
              <OptionButton icon="shippingbox.slash" label="Devolución" color="accentAlt" soft="accentAltSoft" onPress={soon} />
              <OptionButton
                icon="list.bullet"
                label="Tareas"
                color="violet"
                soft="violetSoft"
                onPress={() => router.push({ pathname: '/client/tasks', params: { id: client.id } } as Href)}
              />
            </View>

            {/* Close the visit without an order — only while "iniciado" (no order
                and no exceptional exit yet); every other state already implies a
                closed visit, so no exit is offered. */}
            {client.status === 'iniciado' ? (
              <>
                <SectionLabel>Cerrar visita</SectionLabel>
                <Pressable
                  onPress={() => setExitVisible(true)}
                  style={[styles.orderCard, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
                  <View style={[styles.orderIcon, { backgroundColor: theme.danger }]}>
                    <Icon name="door.exit" size={20} color={theme.onAccent} />
                  </View>
                  <View style={styles.orderText}>
                    <ThemedText type="smallBold" style={{ color: theme.danger }}>
                      Marcar salida
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      Salida excepcional · requiere justificación
                    </ThemedText>
                  </View>
                  <Icon name="chevron.right" size={18} color={theme.danger} />
                </Pressable>
              </>
            ) : null}

            {/* More actions */}
            <SectionLabel>Más opciones</SectionLabel>
            <View style={[styles.card, styles.actionCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ActionRow icon="clipboard" label="Más información" sub="Ficha completa del cliente" color="accent" soft="accentSoft" onPress={soon} />
              <Divider />
              <ActionRow icon="creditcard" label="Línea de crédito" sub="Detalle y condiciones" color="success" soft="successSoft" onPress={soon} />
              <Divider />
              <ActionRow icon="cash" label="Estado de cuenta" sub="Pagos, deuda e historial de ventas" color="violet" soft="violetSoft" onPress={soon} />
            </View>
          </>
        ) : (
          <>
            {/* Visit options */}
            <SectionLabel>Visitas y pedidos</SectionLabel>
            <View style={styles.optionsRow}>
              <OptionButton
                icon="mappin"
                label="In situ"
                color="accent"
                soft="accentSoft"
                onPress={() => {
                  if (needsCheckIn) {
                    setVisitStep('entrada');
                  } else {
                    startVisitTimer(client.id);
                    setVisitStep('tarea');
                  }
                }}
              />
              <OptionButton icon="smartphone" label="Remoto" color="violet" soft="violetSoft" onPress={() => setVisitStep('remoto')} />
              <OptionButton icon="shippingbox.slash" label="Devoluciones" color="accentAlt" soft="accentAltSoft" onPress={soon} />
            </View>

            {/* Directions */}
            <SectionLabel>Cómo llegar</SectionLabel>
            <View style={styles.optionsRow}>
              <OptionButton icon="figure.walk" label="Caminando" color="success" soft="successSoft" onPress={() => openDirections('walking')} />
              <OptionButton icon="moto.fill" label="Moto" color="accentAlt" soft="accentAltSoft" onPress={() => openDirections('driving')} />
              <OptionButton icon="car.fill" label="Vehículo" color="accent" soft="accentSoft" onPress={() => openDirections('driving')} />
            </View>

            {/* More actions */}
            <SectionLabel>Más opciones</SectionLabel>
            <View style={[styles.card, styles.actionCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ActionRow icon="clipboard" label="Más información" sub="Ficha completa del cliente" color="accent" soft="accentSoft" onPress={soon} />
              <Divider />
              <ActionRow icon="creditcard" label="Línea de crédito" sub="Detalle y condiciones" color="success" soft="successSoft" onPress={soon} />
              <Divider />
              <ActionRow icon="cash" label="Estado de cuenta" sub="Pagos, deuda e historial de ventas" color="violet" soft="violetSoft" onPress={soon} />
            </View>
          </>
        )}
      </ScrollView>

      {/* Exceptional exit — reason + photo evidence */}
      <BottomSheet
        visible={exitVisible}
        onClose={() => setExitVisible(false)}
        footer={
          <Pressable
            onPress={confirmExit}
            disabled={!canConfirmExit}
            style={[
              styles.primaryButton,
              { backgroundColor: canConfirmExit ? theme.danger : theme.backgroundSelected },
            ]}>
            <Icon name="door.exit" size={16} color={canConfirmExit ? theme.onAccent : theme.textSecondary} />
            <ThemedText type="smallBold" style={{ color: canConfirmExit ? theme.onAccent : theme.textSecondary }}>
              Confirmar salida
            </ThemedText>
          </Pressable>
        }>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.exitSheet}>
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { backgroundColor: theme.dangerSoft }]}>
              <Icon name="door.exit" size={22} color={theme.danger} />
            </View>
            <View style={styles.sheetHeaderText}>
              <ThemedText type="smallBold" style={styles.sheetTitle}>
                Marcar salida
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Salida excepcional
              </ThemedText>
            </View>
          </View>

          <View style={[styles.statusBanner, { backgroundColor: theme.background }]}>
            <Icon name="exclamationmark.circle" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.statusBannerText}>
              El cliente quedará como {willBeWorked ? '“Trabajado”' : '“Cerrado / observado”'}, según las
              tareas realizadas en esta visita.
            </ThemedText>
          </View>

          <SectionLabel>Motivo</SectionLabel>
          <View style={styles.reasonGroup}>
            {EXIT_REASONS.map((reason) => {
              const on = exitReason === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => setExitReason(reason)}
                  style={[
                    styles.reasonRow,
                    { backgroundColor: theme.background, borderColor: on ? theme.danger : theme.border },
                  ]}>
                  <View style={[styles.radio, { borderColor: on ? theme.danger : theme.border }]}>
                    {on ? <View style={[styles.radioDot, { backgroundColor: theme.danger }]} /> : null}
                  </View>
                  <ThemedText type="small" style={styles.reasonLabel}>
                    {reason}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>Evidencia fotográfica</SectionLabel>
          <PhotoPicker uris={exitPhotos} onChange={setExitPhotos} max={3} />
        </ScrollView>
      </BottomSheet>

      {/* Remote-order reason picker */}
      <BottomSheet visible={remoteSheetVisible} onClose={() => setRemoteSheetVisible(false)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.exitSheet}>
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { backgroundColor: theme.violetSoft }]}>
              <Icon name="smartphone" size={22} color={theme.violet} />
            </View>
            <View style={styles.sheetHeaderText}>
              <ThemedText type="smallBold" style={styles.sheetTitle}>
                Motivo del pedido remoto
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Elegí una opción
              </ThemedText>
            </View>
          </View>

          <View style={styles.reasonGroup}>
            {REMOTE_REASONS.map((reason) => {
              const on = remoteReason === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => {
                    setRemoteReason(reason);
                    setRemoteSheetVisible(false);
                  }}
                  style={[
                    styles.reasonRow,
                    { backgroundColor: theme.background, borderColor: on ? theme.violet : theme.border },
                  ]}>
                  <View style={[styles.radio, { borderColor: on ? theme.violet : theme.border }]}>
                    {on ? <View style={[styles.radioDot, { backgroundColor: theme.violet }]} /> : null}
                  </View>
                  <ThemedText type="small" style={styles.reasonLabel}>
                    {reason}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

/** Adds an alpha channel to a `#rrggbb` color so it can render semi-transparent. */
function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Live-updating elapsed-time counter since the on-site visit started. */
function VisitTimer({ startedAt }: { startedAt: number | undefined }) {
  const theme = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === undefined) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (startedAt === undefined) return null;

  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;

  return (
    <View style={[styles.timerCard, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
      <View style={[styles.timerIcon, { backgroundColor: theme.accent }]}>
        <Icon name="clock.fill" size={16} color={theme.onAccent} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.timerLabel}>
        Tiempo en visita
      </ThemedText>
      <ThemedText type="smallBold" style={[styles.timerValue, { color: theme.accent }]}>
        {label}
      </ThemedText>
    </View>
  );
}

function Chip({
  icon,
  label,
  color,
  soft,
}: {
  icon: IconName;
  label: string;
  color: string;
  soft: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: soft }]}>
      <Icon name={icon} size={11} color={color} />
      <ThemedText type="smallBold" style={[styles.chipText, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statTile, { backgroundColor: theme.background }]}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.statTileLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1} style={[styles.statTileValue, tone ? { color: tone } : null]}>
        {value}
      </ThemedText>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
      {children}
    </ThemedText>
  );
}

function OptionButton({
  icon,
  label,
  color,
  soft,
  onPress,
}: {
  icon: IconName;
  label: string;
  color: ThemeColor;
  soft: ThemeColor;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.optionButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={[styles.optionIcon, { backgroundColor: theme[soft] }]}>
        <Icon name={icon} size={17} color={theme[color]} />
      </View>
      <ThemedText type="smallBold" numberOfLines={1} style={styles.optionLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ActionRow({
  icon,
  label,
  sub,
  color,
  soft,
  onPress,
}: {
  icon: IconName;
  label: string;
  sub: string;
  color: ThemeColor;
  soft: ThemeColor;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.actionRow}>
      <View style={[styles.actionIcon, { backgroundColor: theme[soft] }]}>
        <Icon name={icon} size={16} color={theme[color]} />
      </View>
      <View style={styles.actionText}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {sub}
        </ThemedText>
      </View>
      <Icon name="chevron.right" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

function Stepper({ currentIndex }: { currentIndex: number }) {
  const theme = useTheme();
  const current = VISIT_STEPS[currentIndex];

  return (
    <View style={styles.stepper}>
      <View style={styles.stepperHeader}>
        <ThemedText type="small" themeColor="textSecondary">
          Paso {currentIndex + 1} de {VISIT_STEPS.length}
        </ThemedText>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {current.label}
        </ThemedText>
      </View>
      <View style={styles.segmentsRow}>
        {VISIT_STEPS.map((step, i) => (
          <View
            key={step.key}
            style={[styles.segment, { backgroundColor: i <= currentIndex ? theme.accent : theme.backgroundSelected }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  summaryCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 15,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  chipText: {
    fontSize: 11,
  },
  hr: {
    height: 1,
    marginVertical: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '30%',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    gap: 1,
  },
  statTileLabel: {
    fontSize: 11,
  },
  statTileValue: {
    fontSize: 14,
  },
  limitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 7,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: 7,
    borderRadius: Radius.pill,
  },
  sectionLabel: {
    fontSize: 12,
    marginBottom: -Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  optionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 12,
  },
  actionCard: {
    padding: 0,
    gap: 0,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    gap: 1,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.three + 34 + Spacing.two,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
  },
  stepper: {
    gap: 6,
    paddingHorizontal: 2,
  },
  stepperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segmentsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: Radius.pill,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  orderIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    flex: 1,
    gap: 1,
  },
  distanceCard: {
    gap: Spacing.two,
  },
  distanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  distanceIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceText: {
    flex: 1,
    gap: 1,
  },
  distanceValue: {
    fontSize: 20,
  },
  rangeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  rangeChipText: {
    fontSize: 11,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 12,
  },
  exitSheet: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderText: {
    flex: 1,
    gap: 1,
  },
  sheetTitle: {
    fontSize: 17,
  },
  reasonGroup: {
    gap: 6,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
  },
  reasonLabel: {
    flex: 1,
  },
  remoteHeading: {
    fontSize: 15,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  warningBadgeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  selectText: {
    flex: 1,
    fontSize: 14,
  },
  timerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    paddingRight: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  timerIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerLabel: {
    flex: 1,
    fontSize: 13,
  },
  timerValue: {
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
});
