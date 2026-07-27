import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VisitTimer } from '@/components/client/visit-timer';
import { CartSummaryBar } from '@/components/catalog/cart-bar';
import { CategoriesSheet } from '@/components/catalog/categories-sheet';
import { CategoryTiles } from '@/components/catalog/category-tiles';
import { AlphabetIndex } from '@/components/catalog/alphabet-index';
import { OrderPanel } from '@/components/catalog/order-panel';
import { ProductCard, PRODUCT_CARD_HEIGHT } from '@/components/catalog/product-card';
import { ProductDetailSheet } from '@/components/product-detail/product-detail-sheet';
import { ThemedText } from '@/components/themed-text';
import { useDialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import type { PaymentMethod } from '@/data/mock-incentives';
import {
  estrategiaProducts,
  lastOrderLines,
  mockClient,
  mockProducts,
  ultimosVendidosProducts,
} from '@/data/mock-catalog';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';
import { CartLine, CatalogTabKey, Product } from '@/types/catalog';

type IconName = ComponentProps<typeof Icon>['name'];

const CART_SUMMARY_HEIGHT = 118;

const TILES: {
  key: CatalogTabKey;
  label: string;
  colorToken: 'success' | 'accentAlt' | 'violet';
  softToken: 'successSoft' | 'accentAltSoft' | 'violetSoft';
  count?: number;
}[] = [
  { key: 'normales', label: 'Normales', colorToken: 'success', softToken: 'successSoft' },
  {
    key: 'ultimos',
    label: 'Últ. Vendidos',
    colorToken: 'accentAlt',
    softToken: 'accentAltSoft',
    count: ultimosVendidosProducts.length,
  },
  {
    key: 'estrategia',
    label: 'Estrategia',
    colorToken: 'violet',
    softToken: 'violetSoft',
    count: estrategiaProducts.length,
  },
];

const TAB_LABELS: Record<CatalogTabKey, string> = {
  normales: 'Normales',
  ultimos: 'Últ. Vendidos',
  estrategia: 'Estrategia',
};

export default function CatalogScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cart = useCart();
  const dialog = useDialog();
  const insets = useContentInsets();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();

  // The summary screen resolves discounts and confirms the order — closing the
  // visit belongs there, not here.
  const goToSummary = (paymentMethod: PaymentMethod) =>
    router.push({
      pathname: '/order-confirm',
      params: { ...(clientId ? { clientId } : {}), paymentMethod },
    } as Href);

  const [activeTab, setActiveTab] = useState<CatalogTabKey>('normales');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categoriesVisible, setCategoriesVisible] = useState(false);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const listRef = useRef<FlatList<Product>>(null);

  const baseList =
    activeTab === 'normales' ? mockProducts : activeTab === 'ultimos' ? ultimosVendidosProducts : estrategiaProducts;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseList
      .filter((p) => !categoryFilter || p.family === categoryFilter)
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.family.toLowerCase().includes(q) ||
          p.variants.some((v) => v.sku.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  }, [baseList, categoryFilter, query, sortAsc]);

  const { letterIndexMap, availableLetters } = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((p, index) => {
      const letter = p.name[0]?.toUpperCase();
      if (letter && !map.has(letter)) map.set(letter, index);
    });
    return { letterIndexMap: map, availableLetters: new Set(map.keys()) };
  }, [filtered]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    mockProducts.forEach((p) => counts.set(p.family, (counts.get(p.family) ?? 0) + 1));
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const scrollToLetter = (letter: string) => {
    const index = letterIndexMap.get(letter);
    if (index === undefined) return;
    listRef.current?.scrollToIndex({ index, animated: true });
  };

  /** Every product the cart can hold, so a cart line can be traced back to its product. */
  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    [...mockProducts, ...ultimosVendidosProducts, ...estrategiaProducts].forEach((p) => {
      if (!map.has(p.id)) map.set(p.id, p);
    });
    return map;
  }, []);

  // Editing a cart line reuses the product sheet: same stepper, same equivalences.
  const handleEditLine = (line: CartLine) => {
    const product = productsById.get(line.productId);
    if (!product) return;
    setEditingLine(line);
    setSelectedProduct(product);
  };

  const closeProductSheet = () => {
    setSelectedProduct(null);
    setEditingLine(null);
  };

  const handleDuplicate = () => {
    cart.addLines(lastOrderLines);
    dialog.show({
      icon: 'doc.on.doc',
      tone: 'success',
      title: 'Pedido duplicado',
      message: 'Se agregaron los productos del último pedido al carrito.',
    });
  };

  // Switching list always returns to the catalog: a tab press only ever changes
  // which products are shown, never doubles as a second action.
  const handleTilePress = (key: CatalogTabKey) => {
    setActiveTab(key);
    setShowOrderPanel(false);
  };

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

          <View style={styles.titleColumn}>
            <ThemedText type="smallBold" style={styles.headerTitle}>
              Catálogo
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {mockClient.code} · {mockClient.name}
            </ThemedText>
          </View>

          {/* Visit counter — same placement across every client screen */}
          {clientId ? <VisitTimer clientId={clientId} compact /> : null}
        </View>
      </SafeAreaView>

      <View style={styles.controls}>
        <CategoryTiles tiles={TILES} activeKey={activeTab} onChange={handleTilePress} />

        {/* Search and list controls only describe the product list, so they step
            aside while the order panel is what's on screen. */}
        {showOrderPanel ? (
          <View style={styles.metaRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.metaCount}>
              Detalle del pedido
            </ThemedText>
            <ActionPill
              icon="chevron.left"
              label="Volver al catálogo"
              onPress={() => setShowOrderPanel(false)}
            />
          </View>
        ) : (
          <>
            <View style={styles.searchRow}>
              <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Icon name="magnifyingglass" size={15} color={theme.textSecondary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Buscar en ${TAB_LABELS[activeTab]}`}
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.searchInput, { color: theme.text }]}
                />
                {query.length > 0 ? (
                  <Pressable hitSlop={8} onPress={() => setQuery('')}>
                    <Icon name="xmark" size={13} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
              {/* Filter entry point. It carries the accent while a category is applied,
                  so an active filter is visible even before reading the chip below. */}
              <Pressable
                onPress={() => setCategoriesVisible(true)}
                style={[
                  styles.filterButton,
                  categoryFilter
                    ? { backgroundColor: theme.accent, borderColor: theme.accent }
                    : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}>
                <Icon
                  name="line.3.horizontal.decrease"
                  size={15}
                  color={categoryFilter ? theme.onAccent : theme.text}
                />
              </Pressable>
            </View>

            {/* Active category — the previous design filtered with no visible trace of it. */}
            {categoryFilter ? (
              <View style={styles.filterChipRow}>
                <Pressable
                  onPress={() => setCategoryFilter(null)}
                  style={[styles.filterChip, { backgroundColor: theme.accentSoft }]}>
                  <ThemedText
                    type="smallBold"
                    numberOfLines={1}
                    style={[styles.filterChipText, { color: theme.accent }]}>
                    {categoryFilter}
                  </ThemedText>
                  <Icon name="xmark" size={11} color={theme.accent} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.metaRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.metaCount}>
                {filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}
              </ThemedText>
              <ActionPill icon="doc.on.doc" label="Duplicar pedido" onPress={handleDuplicate} />
              <ActionPill
                icon={sortAsc ? 'chevron.down' : 'chevron.up'}
                label={sortAsc ? 'A-Z' : 'Z-A'}
                onPress={() => setSortAsc((v) => !v)}
              />
            </View>
          </>
        )}
      </View>

      <View style={styles.listWrapper}>
        {showOrderPanel ? (
          <OrderPanel
            contentPaddingBottom={insets.bottom + Spacing.three}
            onContinue={goToSummary}
            onEditLine={handleEditLine}
          />
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ProductCard product={item} onPress={setSelectedProduct} />}
              getItemLayout={(_, index) => ({ length: PRODUCT_CARD_HEIGHT, offset: PRODUCT_CARD_HEIGHT * index, index })}
              onScrollToIndexFailed={(info) => {
                listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
              }}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: CART_SUMMARY_HEIGHT + insets.bottom + Spacing.three },
              ]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIconWrap, { backgroundColor: theme.backgroundSelected }]}>
                    <Icon name="magnifyingglass" size={22} color={theme.textSecondary} />
                  </View>
                  <ThemedText type="smallBold" style={styles.emptyText}>
                    No se encontraron productos
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" type="small" style={styles.emptyText}>
                    Probá con otra búsqueda o categoría
                  </ThemedText>
                </View>
              }
            />
            <AlphabetIndex
              availableLetters={availableLetters}
              onSelect={scrollToLetter}
              bottomInset={CART_SUMMARY_HEIGHT + insets.bottom}
              reversed={!sortAsc}
            />
          </>
        )}
      </View>

      {!showOrderPanel ? (
        <View style={[styles.cartBarWrapper, { bottom: 0, paddingBottom: insets.bottom }]}>
          <CartSummaryBar
            productCount={cart.productCount}
            totalAmount={cart.totalAmount}
            onPress={() => setShowOrderPanel((v) => !v)}
          />
        </View>
      ) : null}

      <CategoriesSheet
        visible={categoriesVisible}
        onClose={() => setCategoriesVisible(false)}
        categories={categories}
        activeCategory={categoryFilter}
        onSelect={setCategoryFilter}
      />
      <ProductDetailSheet product={selectedProduct} onClose={closeProductSheet} editLine={editingLine} />
    </View>
  );
}

/**
 * Compact labelled action, built on the app's pill idiom: icon plus text so the
 * button says what it does instead of relying on the seller decoding a glyph.
 */
function ActionPill({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionPill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Icon name={icon} size={12} color={theme.textSecondary} />
      <ThemedText type="smallBold" numberOfLines={1} style={styles.actionPillText}>
        {label}
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
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
  },
  controls: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterButton: {
    width: ControlHeight.input,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipRow: {
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
  },
  filterChipText: {
    flexShrink: 1,
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaCount: {
    flex: 1,
    fontSize: 11,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 5,
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  actionPillText: {
    fontSize: 11,
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    // Half gutter: ProductCard adds the other half as its own padding, so rows can
    // paint a full-bleed background while their text still lines up at Spacing.three.
    paddingLeft: Spacing.two,
    paddingRight: Spacing.three + 20,
    paddingTop: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: Spacing.six,
    gap: Spacing.one,
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
  cartBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
