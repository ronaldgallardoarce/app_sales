import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { CardShadow, ChipPadding, Radius, Spacing } from '@/constants/theme';
import { STATUS_META, type MapClient } from '@/data/mock-clients';
import { OffRouteBadge } from '@/components/map/off-route-badge';
import { VisitTimer } from '@/components/client/visit-timer';
import { mockSeller } from '@/data/mock-user';
import { useTheme, useThemeScheme } from '@/hooks/use-theme';
import { distanceKm, formatDistance } from '@/utils/geo';

const WHATSAPP_GREEN = '#25D366';

/** Adds an alpha channel to a `#rrggbb` color so it can fade into a gradient. */
function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ClientCard({
  client,
  onPress,
}: {
  client: MapClient;
  onPress: (client: MapClient) => void;
}) {
  const theme = useTheme();
  const scheme = useThemeScheme();
  const status = STATUS_META[client.status];
  const statusColor = theme[status.color];
  const distance = formatDistance(distanceKm(mockSeller.location, client));

  // Dark surfaces swallow low-alpha tints, so the status wash needs more opacity there than on light.
  const gradientAlphas = scheme === 'dark' ? [0.3, 0.12, 0] : [0.16, 0.04, 0];

  const digits = client.phone.replace(/\D/g, '');
  const openWhatsApp = () => Linking.openURL(`https://wa.me/${digits}`);
  const call = () => Linking.openURL(`tel:${client.phone.replace(/\s/g, '')}`);

  return (
    <Pressable
      onPress={() => onPress(client)}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, CardShadow]}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          withAlpha(statusColor, gradientAlphas[0]),
          withAlpha(statusColor, gradientAlphas[1]),
          withAlpha(statusColor, gradientAlphas[2]),
        ]}
        locations={[0, 0.45, 0.8]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
            {client.code}-{client.name}
          </ThemedText>
          <View style={[styles.statusBadge, { backgroundColor: theme[status.soft], borderColor: statusColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <ThemedText type="smallBold" style={[styles.statusText, { color: statusColor }]}>
              {status.label}
            </ThemedText>
          </View>
        </View>

        <OffRouteBadge visitToday={client.visitToday} status={client.status} />
        <VisitTimer clientId={client.id} />

        <MetaRow icon="person.fill" label="Propietario" value={`${client.code}-${client.owner}`} />

        <MetaRow
          icon="map"
          label="Ruta"
          value={client.route}
          trailing={
            <View style={[styles.distanceChip, { backgroundColor: theme.accentSoft }]}>
              <Icon name="mappin" size={12} color={theme.accent} />
              <ThemedText type="smallBold" numberOfLines={1} style={[styles.chipText, { color: theme.accent }]}>
                {distance}
              </ThemedText>
            </View>
          }
        />

        <View style={styles.statsRow}>
          <StatChip icon="cash" label="Ticket" value={`Bs ${client.avgTicket}`} />
          <StatChip icon="shippingbox.fill" label="Drop" value={`Bs ${client.dropSize}`} />
        </View>

        <View style={styles.footerRow}>
          <View style={styles.phoneRow}>
            <Icon name="phone.fill" size={13} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              {client.phone}
            </ThemedText>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={openWhatsApp} style={[styles.actionButton, { backgroundColor: WHATSAPP_GREEN }]}>
              <Icon name="whatsapp" size={18} color="#FFFFFF" />
            </Pressable>
            <Pressable onPress={call} style={[styles.actionButton, { backgroundColor: theme.accent }]}>
              <Icon name="phone.fill" size={17} color={theme.onAccent} />
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function MetaRow({
  icon,
  label,
  value,
  trailing,
}: {
  icon: IconName;
  label: string;
  value: string;
  trailing?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.metaRow}>
      <Icon name={icon} size={13} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.metaLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" numberOfLines={1} style={styles.metaValue}>
        {value}
      </ThemedText>
      {trailing}
    </View>
  );
}

function StatChip({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.statChip,
        { backgroundColor: withAlpha(theme.accent, 0.07), borderColor: withAlpha(theme.accent, 0.35) },
      ]}>
      <Icon name={icon} size={12} color={theme.accent} />
      <ThemedText type="small" numberOfLines={1} style={[styles.statLabel, { color: theme.accent }]}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1} style={styles.statValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 13,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    flexShrink: 0,
  },
  metaValue: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  statLabel: {
    flexShrink: 1,
    fontSize: 11,
  },
  statValue: {
    marginLeft: 'auto',
    fontSize: 12,
  },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
    paddingHorizontal: Spacing.two,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.sm,
  },
  chipText: {
    fontSize: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
