import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartSummaryBar } from '@/components/catalog/cart-bar';
import { CategoriesSheet } from '@/components/catalog/categories-sheet';
import { CategoryTiles } from '@/components/catalog/category-tiles';
import { AlphabetIndex } from '@/components/catalog/alphabet-index';
import { OrderPanel } from '@/components/catalog/order-panel';
import { ProductCard, PRODUCT_CARD_HEIGHT } from '@/components/catalog/product-card';
import { ProductDetailSheet } from '@/components/product-detail/product-detail-sheet';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { useClientVisits } from '@/context/client-visit-context';
import {
  estrategiaProducts,
  lastOrderLines,
  mockClient,
  mockProducts,
  ultimosVendidosProducts,
} from '@/data/mock-catalog';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme, useThemeScheme, useThemeToggle } from '@/hooks/use-theme';
import { CatalogTabKey, Product } from '@/types/catalog';

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
  const scheme = useThemeScheme();
  const toggleScheme = useThemeToggle();
  const router = useRouter();
  const cart = useCart();
  const insets = useContentInsets();
  const { markOrder } = useClientVisits();
  // When the catalog is opened from a client visit, confirming the order closes
  // that visit as "visitado" (order placed).
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const onOrderConfirmed = clientId ? () => markOrder(clientId) : undefined;

  const [activeTab, setActiveTab] = useState<CatalogTabKey>('normales');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categoriesVisible, setCategoriesVisible] = useState(false);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [hideMenu, setHideMenu] = useState(false);
  const [hideDetail, setHideDetail] = useState(false);
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

  const handleDuplicate = () => {
    cart.addLines(lastOrderLines);
    Alert.alert('Pedido duplicado', 'Se agregaron los productos del último pedido al carrito.');
  };

  const handleTilePress = (key: CatalogTabKey) => {
    if (key === activeTab) {
      setShowOrderPanel((v) => !v);
    } else {
      setActiveTab(key);
      setShowOrderPanel(false);
    }
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
              Opciones Cliente
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {mockClient.code} · {mockClient.name}
            </ThemedText>
          </View>

          <Pressable
            hitSlop={8}
            onPress={toggleScheme}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Icon name={scheme === 'dark' ? 'moon.fill' : 'sun.max.fill'} size={16} color={theme.text} />
          </Pressable>

          <Pressable
            hitSlop={8}
            onPress={() => Alert.alert('Más opciones', 'Próximamente.')}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="ellipsis" size={16} color={theme.text} />
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.controls}>
        <View style={styles.togglesRow}>
          <ToggleItem label="Ocultar Menú" value={hideMenu} onChange={setHideMenu} />
          <ToggleItem label="Ocultar Detalle" value={hideDetail} onChange={setHideDetail} />
        </View>

        <CategoryTiles tiles={TILES} activeKey={activeTab} onChange={handleTilePress} />

        {!hideMenu ? (
          <View style={styles.secondaryRow}>
            <OutlineButton icon="doc.on.doc" label="Duplicar" onPress={handleDuplicate} />
            <PrimaryButton icon="square.grid.2x2" label="Ver Categorías" onPress={() => setCategoriesVisible(true)} />
          </View>
        ) : null}

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Icon name="magnifyingglass" size={16} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Buscar en Productos ${TAB_LABELS[activeTab]}`}
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {query.length > 0 ? (
              <Pressable hitSlop={8} onPress={() => setQuery('')}>
                <Icon name="xmark" size={14} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => setCategoriesVisible(true)}
            style={[styles.filterButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Icon name="line.3.horizontal.decrease" size={16} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.sectionHeaderRow}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Productos {TAB_LABELS[activeTab]}
          </ThemedText>
          <Pressable
            onPress={() => setSortAsc((v) => !v)}
            style={[styles.sortPill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ThemedText type="smallBold">{sortAsc ? 'A-Z' : 'Z-A'}</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.listWrapper}>
        {showOrderPanel ? (
          <OrderPanel contentPaddingBottom={insets.bottom + Spacing.three} onConfirmed={onOrderConfirmed} />
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
                { paddingBottom: (hideDetail ? 0 : CART_SUMMARY_HEIGHT) + insets.bottom + Spacing.three },
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
            <AlphabetIndex availableLetters={availableLetters} onSelect={scrollToLetter} />
          </>
        )}
      </View>

      {!hideDetail && !showOrderPanel ? (
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
      <ProductDetailSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </View>
  );
}

function ToggleItem({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.toggleItem}>
      <ThemedText type="small" numberOfLines={1} style={styles.toggleLabel}>
        {label}
      </ThemedText>
      <View style={styles.switchScale}>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: theme.backgroundSelected, true: theme.accentSoft }}
          thumbColor={value ? theme.accent : theme.backgroundElement}
        />
      </View>
    </View>
  );
}

function OutlineButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.outlineButton, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <Icon name={icon} size={14} color={theme.text} />
      <ThemedText type="smallBold" style={styles.buttonLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function PrimaryButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
      <Icon name={icon} size={14} color={theme.onAccent} />
      <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onAccent }]}>
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
  togglesRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  toggleItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  toggleLabel: {
    flexShrink: 1,
    fontSize: 12,
  },
  switchScale: {
    transform: [{ scale: 0.8 }],
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  outlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
  buttonLabel: {
    fontSize: 12,
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
    fontSize: 15,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
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
