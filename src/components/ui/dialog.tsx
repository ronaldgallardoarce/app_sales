import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { ControlHeight, FloatingShadow, Overlay, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Which theme colour carries the dialog's meaning. */
type DialogTone = Extract<ThemeColor, 'accent' | 'success' | 'danger' | 'accentAlt'>;

const SOFT_TONE: Record<DialogTone, ThemeColor> = {
  accent: 'accentSoft',
  success: 'successSoft',
  danger: 'dangerSoft',
  accentAlt: 'accentAltSoft',
};

export type DialogAction = {
  label: string;
  onPress?: () => void;
  /** Filled button for the action that moves things forward; outline for the rest. */
  variant?: 'primary' | 'outline';
  tone?: DialogTone;
};

export type DialogOptions = {
  title: string;
  message?: string;
  icon?: IconName;
  tone?: DialogTone;
  /** Defaults to a single dismiss action. */
  actions?: DialogAction[];
};

type DialogContextValue = {
  /** Show a themed dialog. Drop-in replacement for `Alert.alert`. */
  show: (options: DialogOptions) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

/**
 * Hosts the app's dialog. Rendered once at the root so any screen can raise one
 * without wiring visibility state of its own — the same ergonomics as
 * `Alert.alert`, but drawn with the app's own tokens instead of the OS chrome.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<DialogOptions | null>(null);

  const show = useCallback((next: DialogOptions) => setOptions(next), []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      <DialogHost options={options} onDismiss={() => setOptions(null)} />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within a DialogProvider');
  return ctx;
}

function DialogHost({
  options,
  onDismiss,
}: {
  options: DialogOptions | null;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  // Keep the last options while the exit animation runs, so the card does not
  // blank out before it has finished leaving.
  const [visibleOptions, setVisibleOptions] = useState<DialogOptions | null>(null);

  useEffect(() => {
    if (options) {
      setVisibleOptions(options);
      setMounted(true);
      progress.setValue(0);
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, bounciness: 6, speed: 16 }).start();
      return;
    }
    Animated.timing(progress, { toValue: 0, duration: 140, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setMounted(false);
      },
    );
  }, [options, progress]);

  if (!mounted || !visibleOptions) return null;

  const { title, message, icon, tone = 'accent', actions } = visibleOptions;
  const resolvedActions: DialogAction[] = actions?.length
    ? actions
    : [{ label: 'Entendido', variant: 'primary', tone }];

  const runAction = (action: DialogAction) => {
    onDismiss();
    action.onPress?.();
  };

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            FloatingShadow,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              opacity: progress,
              transform: [{ scale }],
            },
          ]}>
          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: theme[SOFT_TONE[tone]] }]}>
              <Icon name={icon} size={22} color={theme[tone]} />
            </View>
          ) : null}

          <ThemedText type="smallBold" style={styles.title}>
            {title}
          </ThemedText>

          {message ? (
            <ThemedText themeColor="textSecondary" style={styles.message}>
              {message}
            </ThemedText>
          ) : null}

          {/* Three or more choices stack: side by side they would each be too narrow
              to read, which is exactly when a wrong tap costs the most. */}
          <View style={resolvedActions.length > 2 ? styles.actionsColumn : styles.actionsRow}>
            {resolvedActions.map((action) => {
              const actionTone = theme[action.tone ?? tone];
              const primary = action.variant === 'primary';
              return (
                <Pressable
                  key={action.label}
                  onPress={() => runAction(action)}
                  style={[
                    styles.action,
                    primary
                      ? { backgroundColor: actionTone }
                      : { borderWidth: 1, borderColor: theme.border },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    numberOfLines={1}
                    style={{ color: primary ? theme.onAccent : theme.text }}>
                    {action.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Overlay,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionsColumn: {
    alignSelf: 'stretch',
    gap: 6,
    marginTop: Spacing.one,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
});
