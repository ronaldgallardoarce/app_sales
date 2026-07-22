import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChannelSheet } from '@/components/map/channel-sheet';
import { ClientInfoSheet } from '@/components/map/client-info-sheet';
import { ClientList } from '@/components/map/client-list';
import { LeafletMap } from '@/components/map/leaflet-map';
import { MapLegend } from '@/components/map/map-legend';
import { RouteSheet } from '@/components/map/route-sheet';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { ChipPadding, ControlHeight, FloatingShadow, Radius, Spacing } from '@/constants/theme';
import {
  CHANNEL_META,
  CHANNEL_ORDER,
  mapClients,
  routeBlocks,
  STATUS_META,
  STATUS_ORDER,
  type MapClient,
  type SalesChannel,
  type VisitStatus,
} from '@/data/mock-clients';
import { mockSeller } from '@/data/mock-user';
import { useTheme } from '@/hooks/use-theme';
import { convexHull } from '@/utils/geo';
import { resolveOptimalRoute, type LatLng, type TravelMode } from '@/utils/routing';

type Filter = 'today' | 'all';
type ViewMode = 'map' | 'list';
type StatusFilter = VisitStatus | 'all';
type ChannelFilter = SalesChannel | 'all';
type RouteOriginMode = 'current' | 'custom';

export default function MapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const todayClients = useMemo(() => mapClients.filter((c) => c.visitToday), []);
  const boundsPolygon = useMemo(() => convexHull(routeBlocks.flat()), []);
  const colors = useMemo(
    () => ({
      statusColors: STATUS_ORDER.reduce((acc, status) => {
        acc[status] = theme[STATUS_META[status].color];
        return acc;
      }, {} as Record<VisitStatus, string>),
      block: theme.accent,
      bounds: theme.success,
      user: theme.accent,
      route: theme.accent,
      directions: theme.accentAlt,
    }),
    [theme],
  );

  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [filter, setFilter] = useState<Filter>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [channelSheetVisible, setChannelSheetVisible] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);
  const [showBounds, setShowBounds] = useState(false);
  const [routeMode, setRouteMode] = useState(false);
  const [routeSheetVisible, setRouteSheetVisible] = useState(false);
  const [routeOriginMode, setRouteOriginMode] = useState<RouteOriginMode | null>(null);
  const [customStart, setCustomStart] = useState<LatLng | null>(null);
  const [pickingStart, setPickingStart] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');
  const [routeResult, setRouteResult] = useState<{ order: MapClient[]; legs: LatLng[][] } | null>(
    null,
  );
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<MapClient | null>(null);
  const [directionsTargetId, setDirectionsTargetId] = useState<string | null>(null);

  const baseClients =
    filter === 'today' ? (todayClients.length > 0 ? todayClients : mapClients) : mapClients;

  const channelCounts = useMemo(() => {
    const counts = {} as Record<SalesChannel, number>;
    CHANNEL_ORDER.forEach((channel) => (counts[channel] = 0));
    baseClients.forEach((c) => (counts[c.channel] += 1));
    return counts;
  }, [baseClients]);

  const displayedClients = useMemo(
    () =>
      baseClients
        .filter((c) => statusFilter === 'all' || c.status === statusFilter)
        .filter((c) => channelFilter === 'all' || c.channel === channelFilter),
    [baseClients, statusFilter, channelFilter],
  );

  // The route is only calculated once the user explicitly picks a starting point
  // (current location, or a point they choose on the map) — not just by enabling the layer.
  useEffect(() => {
    if (!routeMode) {
      setRouteResult(null);
      setRouteError(null);
      setDirectionsTargetId(null);
      return;
    }

    const origin: LatLng | null =
      routeOriginMode === 'current'
        ? mockSeller.location
        : routeOriginMode === 'custom' && customStart
          ? customStart
          : null;

    if (!origin) {
      setRouteResult(null);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);
    setRouteError(null);

    resolveOptimalRoute(origin, displayedClients, travelMode)
      .then(({ order, legs, usedRoadNetwork }) => {
        if (cancelled) return;
        setRouteResult({ order, legs });
        if (!usedRoadNetwork && displayedClients.length > 0) {
          setRouteError('No se pudo calcular por calles; se usó una aproximación en línea recta.');
        }
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [routeMode, routeOriginMode, customStart, travelMode, displayedClients]);

  const routeOrder = useMemo(() => {
    const map: Record<string, number> = {};
    routeResult?.order.forEach((c, index) => (map[c.id] = index + 1));
    return map;
  }, [routeResult]);

  // "Cómo llegar" only makes sense once an optimal route has been calculated — it
  // highlights the already-computed path up to that client's stop (no extra fetch),
  // so it stays consistent with the route actually being followed.
  const directionsLegs = useMemo(() => {
    if (!directionsTargetId || !routeResult) return null;
    const stopIndex = routeOrder[directionsTargetId];
    if (!stopIndex) return null;
    return routeResult.legs.slice(0, stopIndex);
  }, [directionsTargetId, routeResult, routeOrder]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable
            hitSlop={8}
            onPress={() => router.replace('/' as Href)}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="chevron.left" size={18} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold" style={styles.headerTitle} numberOfLines={1}>
            {viewMode === 'map' ? 'Mapa de ruta' : 'Clientes'}
          </ThemedText>

          <View style={[styles.viewToggle, { backgroundColor: theme.backgroundElement }]}>
            <ViewToggleButton icon="map" active={viewMode === 'map'} onPress={() => setViewMode('map')} />
            <ViewToggleButton
              icon="list.bullet"
              active={viewMode === 'list'}
              onPress={() => setViewMode('list')}
            />
          </View>
        </View>
      </SafeAreaView>

      {viewMode === 'map' ? (
        <>
          <View style={styles.controls}>
            <View style={styles.topRow}>
              <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
                <SegmentButton
                  label="Por visitar hoy"
                  active={filter === 'today'}
                  onPress={() => setFilter('today')}
                />
                <SegmentButton label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
              </View>

              <Pressable
                onPress={() => setChannelSheetVisible(true)}
                style={[
                  styles.channelButton,
                  { backgroundColor: channelFilter === 'all' ? theme.backgroundElement : theme.accent },
                ]}>
                <Icon name="tag.fill" size={12} color={channelFilter === 'all' ? theme.textSecondary : theme.onAccent} />
                <ThemedText
                  type="smallBold"
                  numberOfLines={1}
                  style={[
                    styles.channelButtonLabel,
                    { color: channelFilter === 'all' ? theme.textSecondary : theme.onAccent },
                  ]}>
                  {channelFilter === 'all' ? 'Canal' : CHANNEL_META[channelFilter].label}
                </ThemedText>
                <Icon
                  name="chevron.down"
                  size={10}
                  color={channelFilter === 'all' ? theme.textSecondary : theme.onAccent}
                />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}>
              <StatusChip
                label="Todos"
                active={statusFilter === 'all'}
                color={theme.accent}
                soft={theme.accentSoft}
                onPress={() => setStatusFilter('all')}
              />
              {STATUS_ORDER.map((status) => {
                const meta = STATUS_META[status];
                return (
                  <StatusChip
                    key={status}
                    label={meta.label}
                    active={statusFilter === status}
                    color={theme[meta.color]}
                    soft={theme[meta.soft]}
                    onPress={() => setStatusFilter(status)}
                  />
                );
              })}
            </ScrollView>
          </View>

          <ChannelSheet
            visible={channelSheetVisible}
            onClose={() => setChannelSheetVisible(false)}
            activeChannel={channelFilter}
            onSelect={setChannelFilter}
            counts={channelCounts}
          />

          <View style={[styles.mapWrapper, { paddingBottom: Spacing.three + insets.bottom }]}>
            <View style={[styles.mapCard, { borderColor: theme.border }]}>
              <LeafletMap
                clients={displayedClients}
                polygons={routeBlocks}
                showBlocks={showBlocks}
                boundsPolygon={boundsPolygon}
                showBounds={showBounds}
                userLocation={mockSeller.location}
                order={routeOrder}
                colors={colors}
                routeStart={routeOriginMode === 'custom' ? customStart : null}
                routeLegs={routeResult?.legs ?? null}
                directionsLegs={directionsLegs}
                pickMode={pickingStart}
                onSelect={(id) => {
                  const client = mapClients.find((c) => c.id === id);
                  if (client) setSelectedClient(client);
                }}
                onPickPoint={(point) => {
                  setCustomStart(point);
                  setPickingStart(false);
                  setRouteSheetVisible(true);
                }}
              />

              <View style={styles.layerControls} pointerEvents="box-none">
                <LayerToggle
                  icon="square.grid.2x2"
                  label="Manzanos"
                  active={showBlocks}
                  onPress={() => setShowBlocks((v) => !v)}
                />
                <LayerToggle
                  icon="polygon"
                  label="Límites"
                  active={showBounds}
                  onPress={() => setShowBounds((v) => !v)}
                />
                <LayerToggle
                  icon="route"
                  label="Ruta óptima"
                  active={routeMode}
                  onPress={() => setRouteSheetVisible(true)}
                />
              </View>

              {pickingStart || routeLoading || routeError ? (
                <View style={styles.statusOverlay} pointerEvents="box-none">
                  {pickingStart ? (
                    <View style={[styles.statusBanner, FloatingShadow, { backgroundColor: theme.accent }]}>
                      <Icon name="hand.tap" size={12} color={theme.onAccent} />
                      <ThemedText
                        type="smallBold"
                        numberOfLines={1}
                        style={[styles.statusBannerText, { color: theme.onAccent, flexShrink: 1 }]}>
                        Toca el mapa o un cliente para elegir el inicio
                      </ThemedText>
                      <Pressable
                        hitSlop={8}
                        onPress={() => {
                          setPickingStart(false);
                          if (!customStart) setRouteOriginMode(null);
                          setRouteSheetVisible(true);
                        }}>
                        <Icon name="xmark.circle.fill" size={14} color={theme.onAccent} />
                      </Pressable>
                    </View>
                  ) : routeLoading ? (
                    <View style={[styles.statusBanner, FloatingShadow, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText type="smallBold" style={[styles.statusBannerText, { color: theme.textSecondary }]}>
                        Calculando ruta óptima…
                      </ThemedText>
                    </View>
                  ) : routeError ? (
                    <View style={[styles.statusBanner, FloatingShadow, { backgroundColor: theme.dangerSoft }]}>
                      <ThemedText type="smallBold" style={[styles.statusBannerText, { color: theme.danger }]}>
                        {routeError}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.legendOverlay} pointerEvents="box-none">
                <MapLegend clients={baseClients} />
              </View>
            </View>
          </View>

          <ClientInfoSheet
            client={selectedClient}
            onClose={() => setSelectedClient(null)}
            onViewClient={() => {
              setSelectedClient(null);
              router.push('/catalog' as Href);
            }}
            directionsAvailable={routeMode && !!selectedClient && routeOrder[selectedClient.id] !== undefined}
            directionsActive={selectedClient !== null && directionsTargetId === selectedClient.id}
            onToggleDirections={(c) => setDirectionsTargetId((current) => (current === c.id ? null : c.id))}
          />

          <RouteSheet
            visible={routeSheetVisible}
            onClose={() => setRouteSheetVisible(false)}
            originMode={routeOriginMode}
            hasCustomStart={customStart !== null}
            travelMode={travelMode}
            routeActive={routeMode}
            onSelectOrigin={(origin) => {
              setRouteOriginMode(origin);
              if (origin === 'custom') {
                setRouteSheetVisible(false);
                setPickingStart(true);
              }
            }}
            onConfirm={(mode) => {
              setTravelMode(mode);
              setRouteMode(true);
              setRouteSheetVisible(false);
            }}
            onClear={() => {
              setRouteMode(false);
              setRouteOriginMode(null);
              setCustomStart(null);
              setPickingStart(false);
              setRouteSheetVisible(false);
            }}
          />
        </>
      ) : (
        <ClientList />
      )}
    </View>
  );
}

function ViewToggleButton({
  icon,
  active,
  onPress,
}: {
  icon: IconName;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.viewToggleButton, active ? { backgroundColor: theme.accent } : null]}>
      <Icon name={icon} size={16} color={active ? theme.onAccent : theme.textSecondary} />
    </Pressable>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentButton, active ? { backgroundColor: theme.accent } : null]}>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={[styles.segmentLabel, { color: active ? theme.onAccent : theme.textSecondary }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function StatusChip({
  label,
  active,
  color,
  soft,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  soft: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.statusChip,
        {
          backgroundColor: active ? soft : theme.backgroundElement,
          borderColor: active ? color : theme.border,
        },
      ]}>
      <View style={[styles.statusChipDot, { backgroundColor: color }]} />
      <ThemedText
        type="smallBold"
        style={[styles.statusChipText, { color: active ? color : theme.textSecondary }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function LayerToggle({
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
      style={[
        styles.layerToggle,
        FloatingShadow,
        { backgroundColor: active ? theme.accent : theme.backgroundElement },
      ]}>
      <Icon name={icon} size={14} color={active ? theme.onAccent : theme.text} />
      <ThemedText type="smallBold" style={[styles.layerLabel, { color: active ? theme.onAccent : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    padding: 3,
    gap: 3,
  },
  viewToggleButton: {
    width: 34,
    height: ControlHeight.segment,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 3,
    gap: 3,
  },
  segmentButton: {
    flex: 1,
    height: ControlHeight.segment,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontSize: 13,
  },
  chipsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  channelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    gap: 4,
    height: ControlHeight.segment,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
  },
  channelButtonLabel: {
    fontSize: 11,
    maxWidth: 90,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  statusChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 11,
  },
  mapWrapper: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  mapCard: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  layerControls: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    gap: 6,
    alignItems: 'flex-start',
  },
  layerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
  },
  layerLabel: {
    fontSize: 12,
  },
  statusOverlay: {
    position: 'absolute',
    bottom: Spacing.two,
    left: Spacing.two,
    right: Spacing.two,
    alignItems: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
  },
  statusBannerText: {
    fontSize: 11,
  },
  legendOverlay: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
  },
});
