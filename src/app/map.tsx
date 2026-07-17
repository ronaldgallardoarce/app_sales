import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClientInfoSheet } from '@/components/map/client-info-sheet';
import { ClientList } from '@/components/map/client-list';
import { LeafletMap } from '@/components/map/leaflet-map';
import { MapLegend } from '@/components/map/map-legend';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { FloatingShadow, Radius, Spacing } from '@/constants/theme';
import {
  mapClients,
  routeBlocks,
  STATUS_META,
  STATUS_ORDER,
  type MapClient,
  type VisitStatus,
} from '@/data/mock-clients';
import { mockSeller } from '@/data/mock-user';
import { useTheme } from '@/hooks/use-theme';
import { convexHull, nearestNeighborOrder } from '@/utils/geo';

type Filter = 'today' | 'all';
type ViewMode = 'map' | 'list';
type StatusFilter = VisitStatus | 'all';

export default function MapScreen() {
  const theme = useTheme();
  const router = useRouter();

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
    }),
    [theme],
  );

  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [filter, setFilter] = useState<Filter>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showBlocks, setShowBlocks] = useState(false);
  const [showBounds, setShowBounds] = useState(false);
  const [routeMode, setRouteMode] = useState(false);
  const [selectedClient, setSelectedClient] = useState<MapClient | null>(null);

  const baseClients =
    filter === 'today' ? (todayClients.length > 0 ? todayClients : mapClients) : mapClients;
  const displayedClients = useMemo(
    () => (statusFilter === 'all' ? baseClients : baseClients.filter((c) => c.status === statusFilter)),
    [baseClients, statusFilter],
  );

  // Optimal visit order (nearest-neighbor by proximity) over the displayed clients.
  const orderedRoute = useMemo(
    () => (routeMode ? nearestNeighborOrder(mockSeller.location, displayedClients) : null),
    [routeMode, displayedClients],
  );
  const routeOrder = useMemo(() => {
    const map: Record<string, number> = {};
    orderedRoute?.forEach((c, index) => (map[c.id] = index + 1));
    return map;
  }, [orderedRoute]);
  const routePath = useMemo<[number, number][]>(
    () =>
      orderedRoute
        ? [
            [mockSeller.location.lat, mockSeller.location.lng],
            ...orderedRoute.map((c) => [c.lat, c.lng] as [number, number]),
          ]
        : [],
    [orderedRoute],
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable
            hitSlop={8}
            onPress={() => router.canGoBack() && router.back()}
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
            <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
              <SegmentButton
                label="Por visitar hoy"
                active={filter === 'today'}
                onPress={() => setFilter('today')}
              />
              <SegmentButton label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
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

          <View style={styles.mapWrapper}>
            <View style={[styles.mapCard, { borderColor: theme.border }]}>
              <LeafletMap
                clients={displayedClients}
                polygons={routeBlocks}
                showBlocks={showBlocks}
                boundsPolygon={boundsPolygon}
                showBounds={showBounds}
                userLocation={mockSeller.location}
                order={routeOrder}
                routePath={routePath}
                colors={colors}
                onSelect={(id) => {
                  const client = mapClients.find((c) => c.id === id);
                  if (client) setSelectedClient(client);
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
                  onPress={() => setRouteMode((v) => !v)}
                />
              </View>

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
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 3,
    gap: 3,
  },
  segmentButton: {
    flex: 1,
    height: 32,
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
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  statusChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 11,
  },
  mapWrapper: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  layerLabel: {
    fontSize: 12,
  },
  legendOverlay: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
  },
});
