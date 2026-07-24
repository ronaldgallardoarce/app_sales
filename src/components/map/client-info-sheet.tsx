import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon, type IconName } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { CHANNEL_META, STATUS_META, type MapClient } from '@/data/mock-clients';
import { OffRouteBadge } from '@/components/map/off-route-badge';
import { VisitTimer } from '@/components/map/visit-timer';
import { useTheme } from '@/hooks/use-theme';

export function ClientInfoSheet({
  client,
  onClose,
  onViewClient,
  directionsAvailable,
  directionsActive,
  onToggleDirections,
}: {
  client: MapClient | null;
  onClose: () => void;
  onViewClient: (client: MapClient) => void;
  /** Whether this client is part of an already-computed optimal route — only then can we highlight the path to it. */
  directionsAvailable?: boolean;
  directionsActive?: boolean;
  onToggleDirections?: (client: MapClient) => void;
}) {
  const theme = useTheme();

  const openInGoogleMaps = (c: MapClient) =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`);

  return (
    <BottomSheet
      visible={client !== null}
      onClose={onClose}
      footer={
        client ? (
          <View style={styles.footerColumn}>
            <Pressable
              onPress={() => onViewClient(client)}
              style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <Icon name="person.crop.circle" size={16} color={theme.onAccent} />
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Ver cliente
              </ThemedText>
            </Pressable>
            <View style={styles.footerButtons}>
              {directionsAvailable ? (
                <Pressable
                  onPress={() => onToggleDirections?.(client)}
                  style={[
                    styles.outlineButton,
                    directionsActive
                      ? { borderColor: theme.accentAlt, backgroundColor: theme.accentAltSoft }
                      : { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  ]}>
                  <Icon name="route" size={16} color={directionsActive ? theme.accentAlt : theme.text} />
                  <ThemedText type="smallBold" style={{ color: directionsActive ? theme.accentAlt : theme.text }}>
                    {directionsActive ? 'Ocultar ruta' : 'Cómo llegar'}
                  </ThemedText>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => openInGoogleMaps(client)}
                style={[styles.outlineButton, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                <Icon name="map" size={16} color={theme.text} />
                <ThemedText type="smallBold">Google Maps</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null
      }>
      {client ? (
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <ThemedText type="smallBold" style={styles.heading}>
              {client.code} · {client.name}
            </ThemedText>
            <StatusBadge status={client.status} />
          </View>

          <OffRouteBadge visitToday={client.visitToday} status={client.status} />
          <VisitTimer clientId={client.id} status={client.status} />

          <View style={[styles.infoCard, { backgroundColor: theme.background }]}>
            <InfoRow icon="person.fill" label="Cliente" value={client.name} />
            <InfoRow icon="mappin" label="Dirección" value={client.address} />
            <InfoRow icon="map" label="Ruta" value={client.route} />
            <InfoRow icon="tag.fill" label="Canal" value={CHANNEL_META[client.channel].label} />
            <InfoRow icon="cash" label="Ticket prom." value={`Bs ${client.avgTicket}`} />
            <InfoRow icon="shippingbox.fill" label="Drop size" value={`Bs ${client.dropSize}`} />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

function StatusBadge({ status }: { status: MapClient['status'] }) {
  const theme = useTheme();
  const meta = STATUS_META[status];
  return (
    <View style={[styles.badge, { backgroundColor: theme[meta.soft], alignSelf: 'flex-start' }]}>
      <View style={[styles.badgeDot, { backgroundColor: theme[meta.color] }]} />
      <ThemedText type="smallBold" style={[styles.badgeText, { color: theme[meta.color] }]}>
        {meta.label}
      </ThemedText>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={16} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.infoLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.infoValue} numberOfLines={2}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  heading: {
    flex: 1,
    fontSize: 18,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badgeText: {
    fontSize: 10,
  },
  infoCard: {
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  infoLabel: {
    width: 72,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
  },
  footerColumn: {
    gap: Spacing.two,
    width: '100%',
  },
  footerButtons: {
    gap: Spacing.two,
    flexDirection: 'row',
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
  outlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
