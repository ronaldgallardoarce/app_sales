import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Product } from '@/types/catalog';

/** Above this many options the list is worth filtering; below it the box is noise. */
const SEARCH_THRESHOLD = 6;

/**
 * Picker for which product arrives as free goods.
 *
 * The options are the ordered product itself plus its siblings — same line, same size,
 * different flavor — because that is the only substitution the warehouse will make: a gift is
 * more of what was bought, not a different product. Each one is shown the way the catalog
 * shows it, code and full description, rather than as a bare flavor: flavor is one attribute
 * of a product, and what is being chosen here is the product the warehouse ships.
 *
 * One choice only, and it is always answerable — a line with a single option opens showing
 * that option already selected, which tells the seller what is arriving instead of leaving
 * them to assume.
 */
export function GiftProductSheet({
  visible,
  onClose,
  options,
  selectedId,
  onSelect,
  qtyLabel,
}: {
  visible: boolean;
  onClose: () => void;
  /** The ordered product first, then its siblings. */
  options: Product[];
  selectedId: number;
  onSelect: (product: Product) => void;
  /** What each option would deliver, e.g. "6 Sobre" — repeated per row so the promise
   *  travels with the thing being chosen. */
  qtyLabel: string;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const searchable = options.length > SEARCH_THRESHOLD;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchable) return options;
    // Matches the code as well as the description: a seller reading a code off a shelf label
    // is the reason the code leads every row.
    return options.filter((product) => `${product.id} ${product.name}`.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const select = (product: Product) => {
    onSelect(product);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={480}>
      <View style={styles.container}>
        <ThemedText type="smallBold" style={styles.title}>
          Producto de la bonificación
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {options.length === 1
            ? 'Este producto no tiene variantes: es el único que se puede entregar.'
            : 'Elegí cuál se entrega. Se cambia solo el producto, no la cantidad.'}
        </ThemedText>

        {searchable ? (
          <View style={[styles.searchBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Icon name="magnifyingglass" size={15} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por código o nombre"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {query.length > 0 ? (
              <Pressable hitSlop={8} onPress={() => setQuery('')}>
                <Icon name="xmark" size={13} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {results.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Ningún producto coincide con la búsqueda.
            </ThemedText>
          ) : (
            results.map((product) => {
              const active = product.id === selectedId;
              return (
                <Pressable
                  key={product.id}
                  onPress={() => select(product)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: active ? theme.accentSoft : theme.backgroundElement,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}>
                  <View style={styles.optionTexts}>
                    <ThemedText type="smallBold" numberOfLines={2} style={styles.optionName}>
                      {product.id} - {product.name}
                    </ThemedText>
                    <ThemedText numberOfLines={1} style={[styles.optionQty, { color: theme.success }]}>
                      {qtyLabel} de regalo
                      {product.inStock ? '' : ' · sin stock'}
                    </ThemedText>
                  </View>

                  {active ? <Icon name="checkmark.circle.fill" size={17} color={theme.accent} /> : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 15,
    lineHeight: 19,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  list: {
    gap: 6,
    paddingBottom: Spacing.two,
  },
  empty: {
    paddingVertical: Spacing.four,
    textAlign: 'center',
    fontSize: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: ControlHeight.input,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  optionTexts: {
    flex: 1,
    gap: 1,
  },
  optionName: {
    fontSize: 12,
    lineHeight: 16,
  },
  optionQty: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
});
