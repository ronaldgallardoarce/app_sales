import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TodayActivity } from '@/components/client/today-activity';
import { ordersPlacedToday } from '@/components/client/today-orders';
import { VisitTimer } from '@/components/client/visit-timer';
import { MiniMap } from '@/components/map/mini-map';
import { OrderDetailSheet } from '@/components/orders/order-detail-sheet';
import { OrderSummarySheet, summaryFromOrder } from '@/components/orders/order-summary-sheet';
import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useDialog } from '@/components/ui/dialog';
import { Icon, type IconName } from '@/components/ui/icon';
import { OfflineBadge } from '@/components/ui/offline-badge';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import { CHANNEL_META, CLIENT_STATE_META, EXIT_REASONS, REMOTE_REASONS, STATUS_META } from '@/data/mock-clients';
import type { PlacedOrder } from '@/data/mock-orders';
import { mockSeller } from '@/data/mock-user';
import { useClientVisits } from '@/context/client-visit-context';
import { useOrders } from '@/context/orders-context';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useHardwareBack } from '@/hooks/use-hardware-back';
import { useOrderActions } from '@/hooks/use-order-actions';
import { useTheme } from '@/hooks/use-theme';
import type { ThemeColor } from '@/constants/theme';
import { formatBs } from '@/utils/currency';
import { distanceKm, formatDistance } from '@/utils/geo';

type TravelMode = 'walking' | 'driving';
type VisitStep = 'none' | 'entrada' | 'tarea' | 'remoto';

/** Geofence radius (meters) within which the seller is allowed to check in on-site. */
const MIN_CHECKIN_DISTANCE_M = 300;

/**
 * Shared height for every option tile, so the visit row and the options grid line up
 * instead of each settling on whatever its own content happened to measure. Matches what
 * the visit buttons used to compute naturally: 16 + 38 icon + 6 gap + 20 label + 16.
 */
const OPTION_TILE_HEIGHT = 96;

/** Travel modes offered for directions. Google Maps has no motorbike mode, so it drives. */
const TRAVEL_OPTIONS: {
  icon: IconName;
  label: string;
  mode: TravelMode;
  color: ThemeColor;
  soft: ThemeColor;
}[] = [
  { icon: 'figure.walk', label: 'Caminando', mode: 'walking', color: 'success', soft: 'successSoft' },
  { icon: 'moto.fill', label: 'Moto', mode: 'driving', color: 'accentAlt', soft: 'accentAltSoft' },
  { icon: 'car.fill', label: 'Vehículo', mode: 'driving', color: 'accent', soft: 'accentSoft' },
];

export default function ClientDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const dialog = useDialog();
  const insets = useContentInsets();
  // `exit` is set by the in-visit bar when the open visit has nothing to show for itself: that
  // close needs a reason and a photo, so the bar sends the seller here with the sheet already up
  // instead of dropping them on a menu with no hint of what it wanted.
  const { id, exit, step: stepParam } = useLocalSearchParams<{
    id: string;
    exit?: string;
    step?: string;
  }>();
  const { clients, visitsOf, openVisitOf, markEntry, markVisitDone, markExceptionalExit } =
    useClientVisits();
  const { orders, find: findOrder } = useOrders();
  const { startEdit, confirmDelete } = useOrderActions();
  const [visitStep, setVisitStep] = useState<VisitStep>('none');
  /** Which of today's orders is open in the detail sheet, by number. */
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  /** The order whose shareable summary is open — held by value, as a snapshot being read aloud. */
  const [summaryOrder, setSummaryOrder] = useState<PlacedOrder | null>(null);
  const [exitVisible, setExitVisible] = useState(false);
  const [exitReason, setExitReason] = useState<string | null>(null);
  const [exitPhotos, setExitPhotos] = useState<string[]>([]);
  const [remoteReason, setRemoteReason] = useState<string | null>(null);
  const [remoteSheetVisible, setRemoteSheetVisible] = useState(false);
  const [travelSheetVisible, setTravelSheetVisible] = useState(false);
  // Open on arrival: the figures are what the seller checks before deciding how to work
  // the client, so hiding them by default would bury the reason the card exists.
  const [summaryOpen, setSummaryOpen] = useState(true);

  // Consumed, not just read: the param is cleared as it opens the sheet, so dismissing the sheet
  // and coming back to this screen does not spring it open again.
  useEffect(() => {
    if (exit !== '1') return;
    setExitVisible(true);
    router.setParams({ exit: undefined });
  }, [exit, router]);

  /**
   * Sent back by a confirmed remote order. This screen was left standing on the reason picker that
   * started it, and returning to a spent form — with its reason still selected, offering to
   * continue to the catalog — reads as if nothing had been placed. The reason is dropped with the
   * step, so the next remote order starts from a blank one.
   */
  useEffect(() => {
    if (stepParam !== 'menu') return;
    setVisitStep('none');
    setRemoteReason(null);
    router.setParams({ step: undefined });
  }, [stepParam, router]);

  const client = clients.find((c) => c.id === id) ?? null;

  /** Today's visits to this client, and the one the seller is inside right now if any. */
  const visits = client ? visitsOf(client.id) : [];
  const openVisit = client ? openVisitOf(client.id) : null;

  /**
   * Check-in is required whenever there is no visit open — including for a client already worked
   * this morning. It used to be asked only of a 'no-visitado' client, which meant a seller
   * returning to a closed client walked straight into the task step from anywhere in the city:
   * a second visit with no proof of location, recorded on top of the first one.
   */
  const needsCheckIn = openVisit === null;
  /** A client with history and no open visit is being returned to, not visited for the first time. */
  const isRevisit = needsCheckIn && visits.length > 0;

  /**
   * The step actually rendered. `tarea` only means anything inside a visit, so an order closing
   * the visit underneath it drops the screen back to the client's own menu instead of leaving the
   * in-visit actions up — which is what used to let a second order be taken on a closed visit.
   */
  const step: VisitStep = visitStep === 'tarea' && !openVisit ? 'none' : visitStep;

  /** What this client already bought today, and which of those orders the sheet is showing. */
  const todaysOrders = client ? ordersPlacedToday(orders, client.id) : [];
  const openOrder = openOrderId === null ? null : findOrder(openOrderId);

  // Inputs for the check-in mini map. They live above the "client not found" guard
  // because hooks cannot sit behind an early return, and they are memoized because
  // MiniMap rebuilds its HTML on identity change — a fresh literal every render would
  // reload the whole Leaflet page, and this screen re-renders on every visit tick.
  const clientPin = useMemo(
    () => (client ? { lat: client.lat, lng: client.lng } : null),
    [client],
  );
  const pinColor = client ? STATUS_META[client.status].color : 'accent';
  const miniMapColors = useMemo(
    () => ({ user: theme.accent, client: theme[pinColor], link: theme.accent }),
    [theme, pinColor],
  );

  /**
   * The one step out of the visit's actions and back to the client's menu — never back into the
   * check-in, which would offer to open a visit that is already open.
   *
   * Returns whether it consumed the gesture, so the phone's back button can share it: the header
   * arrow and the hardware button now collapse the same step and leave at the same moment.
   */
  const stepBack = useCallback(() => {
    if (step === 'tarea' || step === 'entrada' || step === 'remoto') {
      setVisitStep('none');
      return true;
    }
    return false;
  }, [step]);

  useHardwareBack(stepBack);

  const goBack = () => {
    if (stepBack()) return;
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
  const soon = () =>
    dialog.show({
      icon: 'clock.fill',
      tone: 'accent',
      title: 'Próximamente',
      message: 'Esta opción estará disponible pronto.',
    });

  const distanceM = Math.round(distanceKm(mockSeller.location, client) * 1000);
  const withinRange = distanceM <= MIN_CHECKIN_DISTANCE_M;

  // Exceptional exit → "trabajado" if any task was done during the visit, else "cerrado-observado".
  const willBeWorked = openVisit?.activity.tasksDone ?? false;
  const canConfirmExit = exitReason !== null && exitPhotos.length > 0;

  /**
   * Whether the visit has anything to show for itself. It decides which of the two exits the
   * seller gets, and the two are different acts rather than the same one with a shortcut: a visit
   * that sold or worked ends normally and owes no explanation, while one that did neither is the
   * exception supervision reads the reasons for.
   */
  const visitProductive = (openVisit?.activity.ordered || openVisit?.activity.tasksDone) ?? false;

  // Debt tones. Only meaningful when the client actually owes money — a debt-free
  // client shows no alarm color and no due-date gradient.
  const hasDebt = client.balance > 0;
  const dueDateTone = !hasDebt
    ? undefined
    : client.daysRemaining <= 3
      ? theme.danger // vencido o por vencer ya
      : client.daysRemaining <= 7
        ? theme.accentAlt // amber — atención
        : theme.success; // verde — holgado

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
              {step === 'none' ? 'Cliente' : step === 'remoto' ? 'Pedido remoto' : 'Visita presencial'}
            </ThemedText>
            {/* The owner, not the point of sale: the route is organised by who the
                account belongs to, and the header is route-level context. The card
                below names the specific child client being visited. */}
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {client.ownerCode}-{client.owner}
            </ThemedText>
          </View>

          <OfflineBadge />

          {/* Visit counter lives in the header so it never displaces content */}
          <VisitTimer clientId={client.id} compact />

          <Chip label={visit.label} color={theme[visit.color]} soft={theme[visit.soft]} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.three }]}>
        {/* Summary — identity, metrics and purchase limit in one compact card. Collapsible
            because the figures are reference data: worth a look on arrival, then in the way
            of the actions below for the rest of the visit. */}
        <View style={[styles.summaryCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {/* The child client, and the card's toggle. A storefront rather than a person,
              because this identifies a point of sale. Code and name on one line — two
              lines for what is a single identifier only made the card taller. */}
          <Pressable onPress={() => setSummaryOpen((open) => !open)} style={styles.identityRow}>
            <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
              <Icon name="store" size={15} color={theme.accent} />
            </View>
            <ThemedText type="smallBold" style={styles.name} numberOfLines={2}>
              {client.code}-{client.name}
            </ThemedText>
            <Icon name={summaryOpen ? 'chevron.up' : 'chevron.down'} size={15} color={theme.textSecondary} />
          </Pressable>

          {summaryOpen ? (
            <>
              <View style={styles.metaGrid}>
                <MetaItem label="Canal" value={CHANNEL_META[client.channel].label} />
                <MetaItem label="Estado" value={state.label} tone={theme[state.color]} />
                <MetaItem
                  label="Línea de crédito"
                  value={client.hasCreditLine ? 'Sí' : 'No'}
                  tone={client.hasCreditLine ? theme.success : undefined}
                />
                <MetaItem
                  label="Es Pareto"
                  value={client.isPareto ? 'Sí' : 'No'}
                  tone={client.isPareto ? theme.accent : undefined}
                />
              </View>

              <View style={[styles.hr, { backgroundColor: theme.border }]} />

              <View style={styles.grid}>
                <StatTile
                  label="Deuda total"
                  value={formatBs(client.balance)}
                  tone={hasDebt ? theme.danger : undefined}
                />
                <StatTile
                  label="Deuda mora"
                  value={formatBs(client.overdueDebt)}
                  tone={client.overdueDebt > 0 ? theme.danger : undefined}
                />
                <StatTile
                  label="Días rest."
                  value={client.daysRemaining > 0 ? `${client.daysRemaining} días` : 'Vencido'}
                  tone={dueDateTone}
                />
                <StatTile label="Últ. compra" value={client.lastPurchase} />
                <StatTile label="Ticket prom." value={formatBs(client.avgTicket)} />
                <StatTile label="Drop size" value={formatBs(client.dropSize)} />
              </View>

              {step !== 'entrada' ? (
                <>
                  <View style={[styles.hr, { backgroundColor: theme.border }]} />

                  {/* Label, bar and figure on one row: three stacked elements for a single
                      percentage was more vertical space than the fact deserves. */}
                  <View style={styles.limitRow}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.limitLabel}>
                      Límite de compras
                    </ThemedText>
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
                    <ThemedText
                      style={[
                        styles.limitPct,
                        { color: client.purchaseLimitPct >= 85 ? theme.danger : theme.accent },
                      ]}>
                      {client.purchaseLimitPct}%
                    </ThemedText>
                  </View>
                </>
              ) : null}
            </>
          ) : null}
        </View>

        {/* What already happened with this client today, as two counts with the lists one tap
            behind them. It sits outside the step branches on purpose — these are facts about the
            client, not actions of a visit — and it is hidden during check-in, which is a task with
            one question in it. */}
        {step !== 'entrada' ? (
          <TodayActivity
            orders={todaysOrders}
            visits={visits}
            onOpenOrder={(order) => setOpenOrderId(order.id)}
          />
        ) : null}

        {step === 'entrada' ? (
          <>
            {/* Distance / geofence */}
            <View style={[styles.card, styles.distanceCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              {/* Where both parties are, before the numbers describing the gap between
                  them — the figure below reads as a caption to the picture. */}
              {clientPin ? (
                <View style={[styles.miniMapFrame, { borderColor: theme.border }]}>
                  <MiniMap
                    userLocation={mockSeller.location}
                    clientLocation={clientPin}
                    radiusM={MIN_CHECKIN_DISTANCE_M}
                    colors={miniMapColors}
                  />
                </View>
              ) : null}

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
                    Tu ubicación
                  </ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <Icon name="mappin" size={13} color={theme[visit.color]} />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
                    {client.name}
                  </ThemedText>
                </View>
              </View>

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
        ) : step === 'remoto' ? (
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
        ) : step === 'tarea' ? (
          <>
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

            {/* Close the visit without an order. Gated on the visit being open rather than on the
                client's status, which is a summary of the whole day: on a second visit to a client
                already marked "visitado" this morning, the status says closed while the seller is
                standing inside an open one. */}
            {openVisit ? (
              <>
                <SectionLabel>{visitProductive ? 'Terminar visita' : 'Cerrar visita'}</SectionLabel>
                {/* Green and immediate once the visit earned its close, red and owing an
                    explanation until then. Same colour language as the in-visit bar, so the
                    seller reads the same answer wherever they happen to be looking. */}
                <Pressable
                  onPress={() =>
                    visitProductive ? markVisitDone(client.id) : setExitVisible(true)
                  }
                  style={[
                    styles.orderCard,
                    visitProductive
                      ? { backgroundColor: theme.successSoft, borderColor: theme.success }
                      : { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
                  ]}>
                  <View
                    style={[
                      styles.orderIcon,
                      { backgroundColor: visitProductive ? theme.success : theme.danger },
                    ]}>
                    <Icon
                      name={visitProductive ? 'checkmark' : 'door.exit'}
                      size={20}
                      color={theme.onAccent}
                    />
                  </View>
                  <View style={styles.orderText}>
                    <ThemedText
                      type="smallBold"
                      style={{ color: visitProductive ? theme.success : theme.danger }}>
                      {visitProductive ? 'Finalizar visita' : 'Marcar salida'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {visitProductive
                        ? openVisit.activity.ordered
                          ? 'Pedido registrado · sin justificación'
                          : 'Tareas realizadas · sin justificación'
                        : 'Salida excepcional · requiere justificación'}
                    </ThemedText>
                  </View>
                  <Icon
                    name="chevron.right"
                    size={18}
                    color={visitProductive ? theme.success : theme.danger}
                  />
                </Pressable>
              </>
            ) : null}

            {/* More actions */}
            <SectionLabel>Más opciones</SectionLabel>
            <MoreOptionsGrid onSelect={soon} />
          </>
        ) : (
          <>
            {/* Visit options */}
            <SectionLabel>Visitas y pedidos</SectionLabel>
            <View style={styles.optionsRow}>
              {/* A return is a new visit and says so, because it costs the seller another
                  check-in and produces another record. What it is for — tareas, un segundo
                  pedido — is decided inside it, the same as the first one. */}
              <OptionButton
                icon="mappin"
                label={isRevisit ? 'Nueva visita' : 'Presencial'}
                color="accent"
                soft="accentSoft"
                onPress={() => setVisitStep(needsCheckIn ? 'entrada' : 'tarea')}
              />
              {/* No returns here: a return is something that happens during a visit, so
                  it only belongs to the started-visit view further down. */}
              <OptionButton icon="smartphone" label="Remoto" color="violet" soft="violetSoft" onPress={() => setVisitStep('remoto')} />
            </View>

            {/* More actions */}
            <SectionLabel>Más opciones</SectionLabel>
            <MoreOptionsGrid onSelect={soon} onDirections={() => setTravelSheetVisible(true)} />
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

          {/* Evidence first: the photo has to be taken standing at the client, so it comes
              before the reason, which can be picked afterwards from anywhere. Camera only —
              a shot from the gallery says nothing about this visit. */}
          <SectionLabel>Evidencia fotográfica</SectionLabel>
          <PhotoPicker uris={exitPhotos} onChange={setExitPhotos} max={3} cameraOnly />

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
        </ScrollView>
      </BottomSheet>

      {/* Travel mode picker — opening the maps app closes the sheet, so there is nothing
          to confirm and no footer. */}
      <BottomSheet visible={travelSheetVisible} onClose={() => setTravelSheetVisible(false)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.exitSheet}>
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="route" size={22} color={theme.accent} />
            </View>
            <View style={styles.sheetHeaderText}>
              <ThemedText type="smallBold" style={styles.sheetTitle}>
                Cómo llegar
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Elegí el medio de transporte
              </ThemedText>
            </View>
          </View>

          <View style={styles.reasonGroup}>
            {TRAVEL_OPTIONS.map((option) => (
              <Pressable
                key={option.label}
                onPress={() => {
                  setTravelSheetVisible(false);
                  openDirections(option.mode);
                }}
                style={[styles.reasonRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={[styles.actionIcon, { backgroundColor: theme[option.soft] }]}>
                  <Icon name={option.icon} size={16} color={theme[option.color]} />
                </View>
                <ThemedText type="smallBold" style={styles.reasonLabel}>
                  {option.label}
                </ThemedText>
                <Icon name="chevron.right" size={16} color={theme.textSecondary} />
              </Pressable>
            ))}
          </View>
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

      {/* The same sheet the orders list opens, on the same orders, with the same two-hour rule
          inside it. Editing from here needs no visit and starts none — it is a correction to a
          document, not a call on a client. */}
      <OrderDetailSheet
        order={openOrder}
        onClose={() => setOpenOrderId(null)}
        onEdit={() =>
          openOrder && startEdit(openOrder, () => setOpenOrderId(null), `/client/${client.id}`)
        }
        onDelete={() => openOrder && confirmDelete(openOrder, () => setOpenOrderId(null))}
        // Hands the order over before closing, so the summary keeps something to show once the
        // sheet that opened it is gone.
        onShowSummary={() => {
          setSummaryOrder(openOrder);
          setOpenOrderId(null);
        }}
      />

      <OrderSummarySheet
        data={summaryOrder ? summaryFromOrder(summaryOrder) : null}
        visible={summaryOrder !== null}
        onClose={() => setSummaryOrder(null)}
      />
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

/** Visit status as a coloured pill. Text only — the colour already carries the state. */
function Chip({ label, color, soft }: { label: string; color: string; soft: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: soft }]}>
      <ThemedText type="smallBold" style={[styles.chipText, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Client attribute as a `Label: Value` text pair — half-width cell of a 2x2 grid. */
function MetaItem({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.metaItem}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.metaItemText}>
        {label}:
      </ThemedText>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={[styles.metaItemText, styles.metaItemValue, tone ? { color: tone } : null]}>
        {value}
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

/**
 * Client information entry points. Same square-tile idiom as the visit options above, so
 * the whole screen reads as one grammar instead of a grid plus a stack of list rows.
 * "Estado de cuenta" and "Historial de ventas" are separate destinations: one is what the
 * client owes, the other what they have bought.
 */
function MoreOptionsGrid({
  onSelect,
  onDirections,
}: {
  onSelect: () => void;
  /**
   * Opens the travel-mode picker. Optional because directions are pointless once the
   * seller has marked entry — they are already standing at the client.
   */
  onDirections?: () => void;
}) {
  return (
    <View style={styles.optionsGrid}>
      <GridOption icon="clipboard" label="Inf. del cliente" color="accent" soft="accentSoft" onPress={onSelect} />
      <GridOption icon="creditcard" label="Línea de crédito" color="success" soft="successSoft" onPress={onSelect} />
      <GridOption icon="cash" label="Estado de cuenta" color="violet" soft="violetSoft" onPress={onSelect} />
      <GridOption icon="doc.text" label="Historial de ventas" color="accentAlt" soft="accentAltSoft" onPress={onSelect} />
      {/* Last so the accent it shares with "Inf. del cliente" never lands in an adjacent tile. */}
      {onDirections ? (
        <GridOption icon="route" label="Cómo llegar" color="accent" soft="accentSoft" onPress={onDirections} />
      ) : null}
    </View>
  );
}

/** Square tile sized for a wrapping 3-column grid — `OptionButton`'s `flex: 1` cannot wrap. */
function GridOption({
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
      style={[styles.gridOption, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={[styles.optionIcon, { backgroundColor: theme[soft] }]}>
        <Icon name={icon} size={17} color={theme[color]} />
      </View>
      <ThemedText type="smallBold" numberOfLines={2} style={styles.gridOptionLabel}>
        {label}
      </ThemedText>
    </Pressable>
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
    // Horizontal padding stays wide — the card's large corner radius needs it — while the
    // vertical padding tightens, which is the only axis costing the seller anything.
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 6,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    // Takes the slack left by the pin so a long trade name can wrap.
    flex: 1,
    fontSize: 13,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
  },
  metaItem: {
    flexBasis: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: Spacing.two,
  },
  metaItemText: {
    fontSize: 11,
    // The biggest single saving in this card: with no lineHeight these 11pt labels sat in the
    // `small` type's 20pt box, and there are two rows of them.
    lineHeight: 15,
  },
  metaItemValue: {
    flexShrink: 1,
  },
  chip: {
    alignItems: 'center',
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  chipText: {
    fontSize: 11,
  },
  hr: {
    height: 1,
    marginVertical: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  statTile: {
    // Six reference figures the seller scans, not reads: three per row at this size
    // keeps them on two tight rows instead of pushing the visit actions off screen.
    flexGrow: 1,
    flexBasis: '30%',
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statTileLabel: {
    fontSize: 9,
    lineHeight: 12,
  },
  statTileValue: {
    fontSize: 12,
    lineHeight: 15,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  limitLabel: {
    flexShrink: 0,
    fontSize: 11,
    // Same trap as `metaItemText`: this row's height was set by an inherited 20pt line box
    // around 11pt text, not by the 5pt bar beside it.
    lineHeight: 15,
  },
  progressTrack: {
    // Takes the slack between the label and the figure, so the bar is as wide as the row
    // allows without needing a width of its own.
    flex: 1,
    height: 5,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: Radius.pill,
  },
  limitPct: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
    height: OPTION_TILE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Centred so a short last row (two tiles under three) sits under the middle of the
    // grid instead of hanging off the left edge. A full row of three is unaffected.
    justifyContent: 'center',
    gap: Spacing.two,
  },
  gridOption: {
    // A fixed basis rather than `flex: 1`: in a wrapping row, a lone tile on the last
    // line would otherwise stretch to the full width and stop looking like a tile.
    // Two columns, so the tiles are wider than tall — they keep the shared height to
    // stay level with the visit row above, but they are no longer square.
    flexBasis: '48%',
    height: OPTION_TILE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  gridOptionLabel: {
    fontSize: 11,
    // Tightened from the 20 that `smallBold` carries: two lines at 20 would not clear the
    // icon inside a fixed-height tile.
    lineHeight: 14,
    textAlign: 'center',
  },
  actionIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
  miniMapFrame: {
    borderRadius: Radius.md,
    borderWidth: 1,
    // Clips the WebView to the rounded corners, which it will not respect on its own.
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 5,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: Radius.pill,
  },
  legendText: {
    flexShrink: 1,
    fontSize: 11,
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
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 12,
  },
  exitSheet: {
    // Gutters match the app's standard Spacing.three rather than the wider Spacing.four
    // these sheets used, which bought nothing and cost 16dp of row width.
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    // Small: the footer's own top padding already separates the last row from the button,
    // so a full Spacing.three here just doubled that gap.
    paddingBottom: Spacing.one,
    gap: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderText: {
    flex: 1,
    gap: 1,
  },
  sheetTitle: {
    fontSize: 15,
  },
  reasonGroup: {
    gap: 4,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // Was a uniform Spacing.three: at four or five options that padding alone added more
    // height than the labels did, and the sheet ran past the fold.
    paddingVertical: 8,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  reasonLabel: {
    flex: 1,
    // Explicit lineHeight: `small`/`smallBold` carry 20, which a dropped fontSize does not
    // bring down with it, so the row would keep the height of the larger type.
    fontSize: 13,
    lineHeight: 17,
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
});
