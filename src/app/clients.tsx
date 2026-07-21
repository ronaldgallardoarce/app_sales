import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClientList } from '@/components/map/client-list';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ClientsScreen() {
  const theme = useTheme();
  const router = useRouter();

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
            Clientes
          </ThemedText>

          <View style={[styles.viewToggle, { backgroundColor: theme.backgroundElement }]}>
            <ViewToggleButton icon="map" active={false} onPress={() => router.push('/map' as Href)} />
            <ViewToggleButton icon="list.bullet" active onPress={() => {}} />
          </View>
        </View>
      </SafeAreaView>

      <ClientList />
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
});
