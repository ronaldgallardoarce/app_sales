import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  duplicateIds,
  normalizeLotNumber,
  type LowRotationEntry,
} from '@/components/client/low-rotation-form';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ChipPadding, Radius, Spacing } from '@/constants/theme';
import { mockProducts } from '@/data/mock-catalog';
import { useTheme } from '@/hooks/use-theme';

/**
 * The entries loaded on a `baja-rotacion` task: one card each, plus the way to add another.
 * Kept apart from `low-rotation-form` because they answer different questions — that one
 * edits a record, this one shows the set — and the form file was already long enough that
 * folding the list into it would have made both harder to read.
 *
 * The seller never edits from here: a card is a summary, and tapping it swaps the sheet to
 * the form. That is what buys the list its density.
 */
export function LowRotationList({
  entries,
  onAdd,
  onEdit,
  onRemove,
}: {
  entries: LowRotationEntry[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const theme = useTheme();
  const duplicates = useMemo(() => duplicateIds(entries), [entries]);

  return (
    <View style={styles.list}>
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIconWrap, { backgroundColor: theme.backgroundSelected }]}>
            <Icon name="shippingbox.slash" size={22} color={theme.textSecondary} />
          </View>
          <ThemedText type="smallBold" style={styles.emptyText}>
            Sin productos cargados
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            Agregá cada producto de baja rotación que encuentres
          </ThemedText>
        </View>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
            {entries.length} producto{entries.length === 1 ? '' : 's'} cargado
            {entries.length === 1 ? '' : 's'}
          </ThemedText>

          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              duplicate={duplicates.has(entry.id)}
              onEdit={() => onEdit(entry.id)}
              onRemove={() => onRemove(entry.id)}
            />
          ))}
        </>
      )}

      <Pressable
        onPress={onAdd}
        style={[styles.addButton, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
        <Icon name="plus" size={15} color={theme.accent} />
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          Agregar producto
        </ThemedText>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* One loaded entry                                                    */
/* ------------------------------------------------------------------ */

function EntryCard({
  entry,
  duplicate,
  onEdit,
  onRemove,
}: {
  entry: LowRotationEntry;
  duplicate: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const product = mockProducts.find((p) => p.id === entry.productId) ?? null;

  return (
    // The whole card opens the editor; the trash is the only thing inside it that does
    // something else, so it stops the press from reaching the card.
    <Pressable
      onPress={onEdit}
      style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.cardTexts}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.cardTitle}>
          {product ? `${product.id}-${product.name}` : 'Producto sin elegir'}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.cardMeta}>
          {summarize(entry)}
        </ThemedText>

        {duplicate ? (
          <View style={[styles.dupChip, { backgroundColor: theme.accentAltSoft }]}>
            <Icon name="exclamationmark.circle" size={11} color={theme.accentAlt} />
            <ThemedText type="smallBold" style={[styles.dupText, { color: theme.accentAlt }]}>
              Duplicado
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.cardActions}>
        <View style={styles.photoCount}>
          <Icon name="camera" size={13} color={theme.textSecondary} />
          <ThemedText type="smallBold" style={[styles.photoCountText, { color: theme.textSecondary }]}>
            {entry.photos.length}
          </ThemedText>
        </View>

        <Pressable
          hitSlop={8}
          onPress={onRemove}
          style={[styles.roundAction, { backgroundColor: theme.dangerSoft }]}>
          <Icon name="trash" size={15} color={theme.danger} />
        </Pressable>
      </View>
    </Pressable>
  );
}

/** `Vto 12/09/26 · SC L-2481 · 8u` — the record's identifying facts on one line. */
function summarize(entry: LowRotationEntry): string {
  const lot = [entry.lot, normalizeLotNumber(entry.lotNumber)].filter(Boolean).join(' ');
  return [`Vto ${shortenYear(entry.expiry)}`, lot, `${entry.qty}u`].filter(Boolean).join(' · ');
}

/**
 * `12/09/2026` → `12/09/26`. The card is a scan, not a document: the century is the one
 * digit pair that never tells the seller anything, and dropping it keeps the line on one row.
 */
function shortenYear(expiry: string): string {
  return expiry.replace(/(\d{2})\/(\d{2})\/\d{2}(\d{2})$/, '$1/$2/$3');
}

const styles = StyleSheet.create({
  list: {
    gap: 6,
  },
  count: {
    fontSize: 11,
    lineHeight: 14,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyText: {
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  cardTexts: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  cardTitle: {
    fontSize: 13,
    // Explicit alongside every reduced font size in the app: the `small` / `smallBold` types
    // carry lineHeight 20, so a smaller font alone keeps the old row height.
    lineHeight: 17,
  },
  cardMeta: {
    fontSize: 11,
    lineHeight: 14,
  },
  dupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  dupText: {
    fontSize: 10,
    lineHeight: 13,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  photoCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  photoCountText: {
    fontSize: 11,
    lineHeight: 14,
  },
  roundAction: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
