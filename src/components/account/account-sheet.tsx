import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SideSheet } from '@/components/ui/side-sheet';
import { Icon, type IconName } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { CHANNEL_META } from '@/data/mock-clients';
import { mockSeller } from '@/data/mock-user';
import { useTheme, useThemeScheme, useThemeToggle } from '@/hooks/use-theme';

export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const scheme = useThemeScheme();
  const toggleScheme = useThemeToggle();

  return (
    <SideSheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
            <Icon name="person.crop.circle" size={30} color={theme.accent} />
          </View>
          <View style={styles.profileText}>
            <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
              {mockSeller.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {mockSeller.code}
            </ThemedText>
          </View>
          <View style={[styles.channelBadge, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="small" style={{ color: theme.accent }} numberOfLines={1}>
              {mockSeller.channels.map((c) => CHANNEL_META[c].label).join(' · ')}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.background }]}>
          <InfoRow icon="mappin" label="Zona" value={mockSeller.zone} />
          <InfoRow icon="route" label="Ruta" value={mockSeller.route} />
          <InfoRow icon="sync" label="Sincronización" value={mockSeller.lastSync} />
        </View>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          Apariencia
        </ThemedText>
        <View style={[styles.modeGroup, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <ModeOption
            icon="sun.max.fill"
            label="Claro"
            active={scheme === 'light'}
            onPress={() => scheme !== 'light' && toggleScheme()}
          />
          <ModeOption
            icon="moon.fill"
            label="Oscuro"
            active={scheme === 'dark'}
            onPress={() => scheme !== 'dark' && toggleScheme()}
          />
        </View>
      </ScrollView>
    </SideSheet>
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
      <ThemedText type="smallBold" style={styles.infoValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
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
      <Icon name={icon} size={15} color={active ? theme.onAccent : theme.text} />
      <ThemedText type="smallBold" style={{ color: active ? theme.onAccent : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 17,
  },
  channelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    flexShrink: 0,
  },
  infoCard: {
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  infoLabel: {
    width: 100,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: ControlHeight.input - 4,
    borderRadius: Radius.sm,
  },
});
