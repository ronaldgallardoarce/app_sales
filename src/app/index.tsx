import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { CHANNEL_META } from '@/data/mock-clients';
import { menuOptions, type MenuOption } from '@/data/menu-options';
import { mockSeller } from '@/data/mock-user';
import { useTheme, useThemeScheme, useThemeToggle } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const scheme = useThemeScheme();
  const toggleScheme = useThemeToggle();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [offline, setOffline] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']}>
        <View style={styles.headerRow}>
          <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
            <Icon name="person.crop.circle" size={26} color={theme.accent} />
          </View>

          <View style={styles.titleColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Hola,
            </ThemedText>
            <ThemedText type="smallBold" style={styles.sellerName} numberOfLines={1}>
              {mockSeller.name}
            </ThemedText>
            <View style={[styles.channelBadge, { backgroundColor: theme.accentSoft }]}>
              <Icon name="tag.fill" size={10} color={theme.accent} />
              <ThemedText type="small" style={[styles.channelBadgeText, { color: theme.accent }]} numberOfLines={1}>
                {CHANNEL_META[mockSeller.channel].label}
              </ThemedText>
            </View>
          </View>

          <Pressable
            hitSlop={8}
            onPress={toggleScheme}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Icon name={scheme === 'dark' ? 'moon.fill' : 'sun.max.fill'} size={16} color={theme.text} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={[styles.offlineCard, { backgroundColor: theme.backgroundElement }, CardShadow]}>
          <View
            style={[
              styles.offlineIcon,
              { backgroundColor: offline ? theme.accentSoft : theme.backgroundSelected },
            ]}>
            <Icon
              name={offline ? 'wifi.slash' : 'sync'}
              size={20}
              color={offline ? theme.accent : theme.textSecondary}
            />
          </View>
          <View style={styles.offlineTextColumn}>
            <ThemedText type="smallBold">Modo offline</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {offline ? 'Trabajando sin conexión' : `Sincronizado ${mockSeller.lastSync}`}
            </ThemedText>
          </View>
          <Switch
            value={offline}
            onValueChange={setOffline}
            trackColor={{ false: theme.backgroundSelected, true: theme.accentSoft }}
            thumbColor={offline ? theme.accent : theme.backgroundElement}
          />
        </View>

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Accesos rápidos
        </ThemedText>

        <View style={styles.grid}>
          {menuOptions.map((option) => (
            <MenuCard key={option.key} option={option} onPress={() => router.push(option.route)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function MenuCard({ option, onPress }: { option: MenuOption; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.backgroundElement }, CardShadow]}>
      <View style={[styles.iconSquare, { backgroundColor: theme[option.softToken] }]}>
        <Icon name={option.icon} size={24} color={theme[option.colorToken]} />
      </View>
      <ThemedText type="smallBold" numberOfLines={2} style={styles.cardLabel}>
        {option.label}
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  sellerName: {
    fontSize: 18,
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  channelBadgeText: {
    fontSize: 11,
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  offlineIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineTextColumn: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 15,
    marginTop: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  card: {
    width: '31.5%',
    minHeight: 104,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  cardLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  iconSquare: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
