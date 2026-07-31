import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ReturnLine } from '@/types/returns';
import { returnQtyLabel } from '@/utils/returns';

/**
 * One returned product as it appears in the list.
 *
 * Leads with what the office will be asked to accept — the product and how much of it — and
 * carries the lot underneath, because a return is judged on the lot far more often than on the
 * product. The two thumbnails are shown rather than counted: the seller checking their own work
 * before submitting needs to see that the photo of the fallo is a fallo, not that there is one.
 *
 * No completeness badge. `ReturnLineSheet` refuses to save a line that is short of anything, so
 * every card in this list is complete by construction — a state that can only ever read one way
 * is not telling the seller anything they could act on.
 */
export function ReturnLineCard({
  line,
  onPress,
  onRemove,
}: {
  line: ReturnLine;
  onPress: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
          borderRightColor: theme.border,
          borderBottomColor: theme.border,
          borderLeftColor: theme.accent,
        },
      ]}>
      <View style={styles.top}>
        <ThemedText type="smallBold" numberOfLines={2} style={styles.name}>
          {line.productName}
        </ThemedText>
        <Pressable hitSlop={8} onPress={onRemove} style={styles.remove}>
          <Icon name="trash" size={15} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.chips}>
        <Chip icon="cube.box.fill" label={returnQtyLabel(line)} color={theme.accent} soft={theme.accentSoft} />
        {line.lotOrigin ? (
          <Chip
            icon="shippingbox.fill"
            label={line.lotNumber.trim() ? `${line.lotOrigin} · ${line.lotNumber.trim()}` : line.lotOrigin}
            color={theme.violet}
            soft={theme.violetSoft}
          />
        ) : null}
        {/* The expiry keeps a warm hue of its own: it is the field most likely to be the reason
            the stock is coming back, so it is worth finding without reading the row. */}
        {line.expiryDate ? (
          <Chip icon="calendar" label={`Vence ${shortExpiry(line.expiryDate)}`} color={theme.accentAlt} soft={theme.accentAltSoft} />
        ) : null}
      </View>

      {line.observation.trim().length > 0 ? (
        <ThemedText themeColor="textSecondary" numberOfLines={2} style={styles.observation}>
          {line.observation.trim()}
        </ThemedText>
      ) : null}

      <View style={styles.thumbs}>
        <Thumb uri={line.defectPhotos[0]} caption="Fallo" />
        <Thumb uri={line.lotPhotos[0]} caption="Lote" />
      </View>
    </Pressable>
  );
}

/** A photo slot: the picture once it exists, and what it is meant to be until then. */
function Thumb({ uri, caption }: { uri?: string; caption: string }) {
  const theme = useTheme();

  if (!uri) {
    return (
      <View style={[styles.thumbEmpty, { borderColor: theme.border }]}>
        <Icon name="camera" size={12} color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary" style={styles.thumbCaption}>
          {caption}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.thumbWrap}>
      <Image source={{ uri }} style={styles.thumb} contentFit="cover" transition={150} />
      <View style={styles.thumbBadge}>
        <ThemedText style={styles.thumbBadgeText}>{caption}</ThemedText>
      </View>
    </View>
  );
}

function Chip({
  icon,
  label,
  color,
  soft,
}: {
  icon: 'cube.box.fill' | 'shippingbox.fill' | 'calendar';
  label: string;
  color: string;
  soft: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: soft }]}>
      <Icon name={icon} size={11} color={color} />
      <ThemedText type="smallBold" numberOfLines={1} style={[styles.chipText, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

/** `DD/MM/AAAA` as `DD/MM/AA` — the chip has room for the day and little else. */
function shortExpiry(value: string): string {
  const [day, month, year] = value.split('/');
  return `${day}/${month}/${year?.slice(2) ?? ''}`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderLeftWidth: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: 6,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  name: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  remove: {
    paddingTop: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  chipText: {
    fontSize: 10,
    lineHeight: 13,
  },
  observation: {
    fontSize: 11,
    lineHeight: 15,
  },
  thumbs: {
    flexDirection: 'row',
    gap: 4,
  },
  thumbWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 10, 14, 0.62)',
    alignItems: 'center',
    paddingVertical: 1,
  },
  thumbBadgeText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  thumbEmpty: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  thumbCaption: {
    fontSize: 8,
    lineHeight: 10,
  },
});
