import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ColorToken = 'accent' | 'success' | 'accentAlt' | 'violet';
type SoftToken = 'accentSoft' | 'successSoft' | 'accentAltSoft' | 'violetSoft';

type PlaceholderScreenProps = {
  title: string;
  description: string;
  icon: IconName;
  colorToken?: ColorToken;
  softToken?: SoftToken;
  primaryAction?: { label: string; onPress: () => void };
};

export function PlaceholderScreen({
  title,
  description,
  icon,
  colorToken = 'accent',
  softToken = 'accentSoft',
  primaryAction,
}: PlaceholderScreenProps) {
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
            {title}
          </ThemedText>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: theme[softToken] }]}>
          <Icon name={icon} size={32} color={theme[colorToken]} />
        </View>

        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
          {description}
        </ThemedText>

        <View style={[styles.pill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Próximamente
          </ThemedText>
        </View>

        {primaryAction ? (
          <Pressable
            onPress={primaryAction.onPress}
            style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {primaryAction.label}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
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
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    maxWidth: 320,
  },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  primaryButton: {
    marginTop: Spacing.two,
    height: ControlHeight.input,
    alignSelf: 'stretch',
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
