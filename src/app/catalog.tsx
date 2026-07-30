import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VisitTimer } from '@/components/client/visit-timer';
import { CategoriesSheet } from '@/components/catalog/categories-sheet';
import { CategoryTiles } from '@/components/catalog/category-tiles';
import { AlphabetIndex } from '@/components/catalog/alphabet-index';
import { OrderPanel } from '@/components/catalog/order-panel';
import { OrderSheet, orderSheetHeights, type OrderSheetSnap } from '@/components/catalog/order-sheet';
import { ProductCard, PRODUCT_CARD_HEIGHT } from '@/components/catalog/product-card';
import { ProductDetailSheet } from '@/components/product-detail/product-detail-sheet';
import { ThemedText } from '@/components/themed-text';
import { useDialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { OfflineBadge } from '@/components/ui/offline-badge';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { useClientVisits } from '@/context/client-visit-context';
import { useOrderIncentives } from '@/context/order-incentives-context';
import type { PaymentMethod } from '@/data/mock-incentives';
import {
  estrategiaProducts,
  lastOrderLines,
  mockProducts,
  ultimosVendidosProducts,
} from '@/data/mock-catalog';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';
import { CartLine, CatalogTabKey, Product } from '@/types/catalog';

type IconName = ComponentProps<typeof Icon>['name'];

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
  const { reset: resetIncentives } = useOrderIncentives();
  const insets = useContentInsets();
  // `editOrderId` is set only when the catalog was opened to amend a placed order. It is carried
  // straight through to the summary rather than acted on here: this screen builds a cart either
  // way, and only the save at the end differs.
  const { clientId, editOrderId } = useLocalSearchParams<{
    clientId?: string;
    editOrderId?: string;
  }>();
  const { clients } = useClientVisits();

  // Resolved from the route param, not from mock data: this header used to name a
  // hardcoded client, so it showed the wrong person for whoever was actually being visited.
  const routeClient = clients.find((c) => c.id === clientId) ?? null;

  // The summary screen resolves discounts and confirms the order — closing the
  // visit belongs there, not here.
  const goToSummary = (paymentMethod: PaymentMethod) =>
    router.push({
      pathname: '/order-confirm',
      params: {
        ...(clientId ? { clientId } : {}),
        ...(editOrderId ? { editOrderId } : {}),
        paymentMethod,
      },
    } as Href);

  const [activeTab, setActiveTab] = useState<CatalogTabKey>('normales');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categoriesVisible, setCategoriesVisible] = useState(false);
  /**
   * Opens half and half. The screen's whole point is that the catalog and the order are one view,
   * and opening with the order collapsed to its header hid that — a seller had to discover the
   * sheet before knowing the order was even there. Half is also the stop they can act from
   * without moving anything: products above, the order building below.
   */
  const [orderSnap, setOrderSnap] = useState<OrderSheetSnap>('half');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  // Measured rather than assumed: the sheet's stops are fractions of the list
  // area, which is whatever is left after the header and the controls above it.
  const [listAreaHeight, setListAreaHeight] = useState(0);

  const listRef = useRef<FlatList<Product>>(null);

  const sheetHeights = orderSheetHeights(listAreaHeight, insets.bottom);

  /**
   * How much room the list leaves for the sheet. It tracks the stop the sheet is
   * resting at, not its live height: settled state changes three times, so the
   * last rows never shuffle under the finger mid-drag, but they can always be
   * scrolled clear of the sheet once it lands.
   *
   * Capped at the middle stop on purpose. At the tallest one the list is down to
   * a peeking sliver and the seller is reviewing the order, not browsing —
   * padding by the full sheet there would strand the list under a screenful of
   * blank space the moment they collapsed it again.
   */
  const listBottomInset =
    orderSnap === 'collapsed' ? sheetHeights.collapsed : sheetHeights.half;

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
          String(p.id).includes(q)
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
    const map = new Map<number, Product>();
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

  /**
   * A tab press changes which products are shown and nothing else — which is what the old comment
   * here claimed while the code also collapsed the order sheet. Now that the screen opens half and
   * half, collapsing would have thrown that away on the first tab press and left no way back to it
   * but a drag. Where the sheet sits is the seller's choice; the tabs do not get a vote.
   */
  const handleTilePress = (key: CatalogTabKey) => {
    setActiveTab(key);
  };

  /**
   * Abandons an edit. Empties the cart on the way out, because it holds the placed order's lines
   * and leaving them behind is exactly how a half-abandoned edit turns into an accidental new
   * order the next time the catalog is opened.
   */
  const cancelEdit = () => {
    dialog.show({
      icon: 'xmark.circle.fill',
      tone: 'accentAlt',
      title: '¿Salir sin guardar?',
      message: `Los cambios en ${editOrderId} se descartan. El pedido queda como estaba.`,
      actions: [
        { label: 'Seguir editando', variant: 'outline' },
        {
          label: 'Salir',
          variant: 'primary',
          tone: 'accentAlt',
          onPress: () => {
            cart.clearCart();
            resetIncentives();
            // Dismisses back to the list this edit started from rather than stacking a second
            // copy of it on top of the catalog we are leaving.
            router.dismissTo('/orders' as Href);
          },
        },
      ],
    });
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
            {/* Owner: route-level context, matching every other screen header. */}
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {routeClient ? `${routeClient.ownerCode}-${routeClient.owner}` : 'Sin cliente'}
            </ThemedText>
          </View>

          <OfflineBadge />

          {/* Visit counter — same placement across every client screen */}
          {clientId ? <VisitTimer clientId={clientId} compact /> : null}
        </View>
      </SafeAreaView>

      {/* Amending a placed order looks exactly like building a new one, so it has to say so. It
          also needs a way out: the cart was loaded with the order's lines, and walking away with
          the back arrow would leave them sitting there looking like a new order. */}
      {editOrderId ? (
        <View style={styles.editBanner}>
          <View style={[styles.editPill, { backgroundColor: theme.accentAltSoft }]}>
            <Icon name="pencil" size={12} color={theme.accentAlt} />
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              style={[styles.editPillText, { color: theme.accentAlt }]}>
              Editando {editOrderId}
            </ThemedText>
            <Pressable hitSlop={8} onPress={cancelEdit}>
              <Icon name="xmark" size={12} color={theme.accentAlt} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.controls}>
        <CategoryTiles tiles={TILES} activeKey={activeTab} onChange={handleTilePress} />

        {/* These describe the product list, and the product list is now always on
            screen — so they stay put. Swapping them out for the order used to be
            half of why moving between the two read as leaving the screen. */}
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
          <ActionPill icon="doc.on.doc" label="Duplicar ult. pedido" onPress={handleDuplicate} />
          <ActionPill
            icon={sortAsc ? 'chevron.down' : 'chevron.up'}
            label={sortAsc ? 'A-Z' : 'Z-A'}
            onPress={() => setSortAsc((v) => !v)}
          />
        </View>
      </View>

      {/* The list is never unmounted now: the order slides over it. That is what
          makes both halves read as one screen instead of two. */}
      <View
        style={styles.listWrapper}
        onLayout={(event) => setListAreaHeight(event.nativeEvent.layout.height)}>
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ProductCard product={item} onPress={setSelectedProduct} />}
          getItemLayout={(_, index) => ({ length: PRODUCT_CARD_HEIGHT, offset: PRODUCT_CARD_HEIGHT * index, index })}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          }}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listBottomInset + Spacing.three },
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
          bottomInset={listBottomInset}
          reversed={!sortAsc}
        />
      </View>

      <OrderSheet
        snap={orderSnap}
        onSnapChange={setOrderSnap}
        availableHeight={listAreaHeight}
        bottomInset={insets.bottom}
        productCount={cart.productCount}
        totalAmount={cart.totalAmount}>
        <OrderPanel
          contentPaddingBottom={Spacing.three}
          onContinue={goToSummary}
          onEditLine={handleEditLine}
        />
      </OrderSheet>

      <CategoriesSheet
        visible={categoriesVisible}
        onClose={() => setCategoriesVisible(false)}
        categories={categories}
        activeCategory={categoryFilter}
        onSelect={setCategoryFilter}
      />
      {/* The full catalog travels with the sheet: suggestions are sibling rows, and only
          the catalog knows which rows share a base name. */}
      <ProductDetailSheet
        product={selectedProduct}
        catalog={mockProducts}
        onClose={closeProductSheet}
        editLine={editingLine}
      />
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
  editBanner: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  // Amber, the app's colour for "pay attention to this", and self-sized rather than full width so
  // it reads as a state the screen is in and not as an error.
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  editPillText: {
    fontSize: 11,
    lineHeight: 15,
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
});
