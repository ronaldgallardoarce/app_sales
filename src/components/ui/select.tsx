import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { ControlHeight, FloatingShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  /** Secondary line, for when the value alone does not identify the option. */
  meta?: string;
};

/** Where the trigger sits in the window. Captured when the menu opens. */
type Anchor = { x: number; y: number; width: number; height: number };

const ROW_HEIGHT = 38;
/** The list's own vertical padding, which the height estimate has to include. */
const LIST_PADDING = 8;
const LIST_MAX_HEIGHT = 260;
/** Gap between the trigger and the menu, and the minimum room kept to a screen edge. */
const MARGIN = 6;

/**
 * A select whose options open as a menu floating over the content, anchored to the field —
 * the platform's own shape for this. It does not expand in place: a field that pushes the
 * rest of the form down when tapped makes the seller re-find whatever they were reading.
 *
 * The menu is a `Modal` nested inside the caller's tree, which is presented *above* an
 * already open `BottomSheet` — the same thing `ImageViewer` does from inside the photo
 * picker. What does not work is a second sheet raised as a *sibling* from the screen: that
 * one is presented below the open sheet and never becomes visible.
 *
 * There is no backdrop dim. A menu is not a modal decision — it is a list attached to a
 * field, and dimming the form behind it would announce it as something heavier than it is.
 * The invisible full-screen pressable is only there to catch the outside tap that closes.
 */
export function Select<T extends string>({
  value,
  options,
  placeholder,
  icon,
  onSelect,
}: {
  value: T | null;
  options: SelectOption<T>[];
  /** Shown while nothing is chosen. */
  placeholder: string;
  icon?: IconName;
  onSelect: (value: T) => void;
}) {
  const theme = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const selected = options.find((option) => option.value === value) ?? null;
  const open = anchor !== null;

  /**
   * Measured on press rather than on layout. This renders inside a sheet that animates in
   * from the bottom, so a layout-time measurement is taken while the sheet is still
   * travelling and the menu would open offset by whatever distance was left.
   */
  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ x, y, width, height }),
    );
  };

  const closeMenu = () => setAnchor(null);

  const listHeight = Math.min(options.length * ROW_HEIGHT + LIST_PADDING, LIST_MAX_HEIGHT);
  const spaceBelow = anchor ? screenHeight - (anchor.y + anchor.height) - MARGIN : 0;
  const spaceAbove = anchor ? anchor.y - MARGIN : 0;
  // Below the field is the default. Flipping up happens only when the menu genuinely does
  // not fit downward *and* there is more room the other way — a menu that opens upward
  // when it did not have to reads as a glitch.
  const dropUp = anchor !== null && spaceBelow < listHeight && spaceAbove > spaceBelow;

  const position: ViewStyle | null = anchor
    ? {
        left: anchor.x,
        width: anchor.width,
        maxHeight: Math.min(listHeight, dropUp ? spaceAbove : spaceBelow),
        ...(dropUp
          ? { bottom: screenHeight - anchor.y + MARGIN }
          : { top: anchor.y + anchor.height + MARGIN }),
      }
    : null;

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        style={[
          styles.trigger,
          // Accent border marks a filled selection, the same way the rest of the app does.
          {
            backgroundColor: theme.background,
            borderColor: selected ? theme.accent : theme.border,
          },
        ]}>
        {icon ? <Icon name={icon} size={15} color={theme.accent} /> : null}

        <View style={styles.triggerTexts}>
          {selected ? (
            <>
              <ThemedText type="smallBold" numberOfLines={1} style={styles.triggerLabel}>
                {selected.label}
              </ThemedText>
              {selected.meta ? (
                <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.triggerMeta}>
                  {selected.meta}
                </ThemedText>
              ) : null}
            </>
          ) : (
            <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.triggerLabel}>
              {placeholder}
            </ThemedText>
          )}
        </View>

        <Icon name={open ? 'chevron.up' : 'chevron.down'} size={13} color={theme.textSecondary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        // No fade: a menu attached to a field should be there the instant it is tapped.
        animationType="none"
        onRequestClose={closeMenu}
        statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />

        {position ? (
          <View
            style={[
              styles.list,
              position,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              FloatingShadow,
            ]}>
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onSelect(option.value);
                      closeMenu();
                    }}
                    style={[styles.row, active ? { backgroundColor: theme.accentSoft } : null]}>
                    <View style={styles.rowTexts}>
                      <ThemedText
                        type="smallBold"
                        numberOfLines={1}
                        style={[styles.rowLabel, { color: active ? theme.accent : theme.text }]}>
                        {option.label}
                      </ThemedText>
                      {option.meta ? (
                        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.rowMeta}>
                          {option.meta}
                        </ThemedText>
                      ) : null}
                    </View>
                    {active ? <Icon name="checkmark" size={14} color={theme.accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: ControlHeight.input,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  triggerTexts: {
    flex: 1,
    gap: 1,
  },
  triggerLabel: {
    fontSize: 13,
    // Explicit alongside every reduced font size in the app: the `small` / `smallBold`
    // types carry lineHeight 20, so a smaller font alone keeps the old row height.
    lineHeight: 17,
  },
  triggerMeta: {
    fontSize: 11,
    lineHeight: 14,
  },
  list: {
    position: 'absolute',
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listContent: {
    padding: LIST_PADDING / 2,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: ROW_HEIGHT - 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
  },
  rowTexts: {
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    fontSize: 13,
    lineHeight: 17,
  },
  rowMeta: {
    fontSize: 11,
    lineHeight: 14,
  },
});
