import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { STATUS_META, type MapClient } from '@/data/mock-clients';
import { mockSeller } from '@/data/mock-user';
import { useTheme } from '@/hooks/use-theme';
import { distanceKm, formatDistance } from '@/utils/geo';

const WHATSAPP_GREEN = '#25D366';

export function ClientCard({
  client,
  onPress,
}: {
  client: MapClient;
  onPress: (client: MapClient) => void;
}) {
  const theme = useTheme();
  const status = STATUS_META[client.status];
  const statusColor = theme[status.color];
  const distance = formatDistance(distanceKm(mockSeller.location, client));

  const digits = client.phone.replace(/\D/g, '');
  const openWhatsApp = () => Linking.openURL(`https://wa.me/${digits}`);
  const call = () => Linking.openURL(`tel:${client.phone.replace(/\s/g, '')}`);

  return (
    <Pressable
      onPress={() => onPress(client)}
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderLeftColor: statusColor },
        CardShadow,
      ]}>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <ThemedText type="smallBold" style={styles.title} numberOfLines={2}>
            {client.name} · {client.code}
          </ThemedText>
          <View style={[styles.statusBadge, { backgroundColor: theme[status.soft] }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <ThemedText type="smallBold" style={[styles.statusText, { color: statusColor }]}>
              {status.label}
            </ThemedText>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Icon name="person.fill" size={13} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.metaText}>
            {client.owner}
          </ThemedText>
        </View>

        <View style={styles.chipsRow}>
          <View style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
            <Icon name="map" size={12} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.chipText}>
              {client.route}
            </ThemedText>
          </View>
          <View style={[styles.chip, { backgroundColor: theme.accentSoft }]}>
            <Icon name="mappin" size={12} color={theme.accent} />
            <ThemedText type="smallBold" style={[styles.chipText, { color: theme.accent }]}>
              {distance}
            </ThemedText>
          </View>
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

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 15,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    flex: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
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
