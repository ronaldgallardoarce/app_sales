import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { QuantityStepper } from '@/components/product-detail/quantity-stepper';
import { SuggestionCard } from '@/components/product-detail/suggestion-card';
import { SuggestionStrip } from '@/components/product-detail/suggestion-strip';
import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { ChipPadding, ControlHeight, Fonts, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { useTheme } from '@/hooks/use-theme';
import { CartLine, Product } from '@/types/catalog';
import { formatBs } from '@/utils/currency';
import { lineAmount, lineMinUnits, lineQtyLabel } from '@/utils/order';
import { AXIS_LABELS, availableAxes, primaryAxis, suggestionsFor } from '@/utils/suggestions';

/** Quantities the seller has typed but not confirmed, per product code. */
type DraftEntry = { qtyMin: number; qtyMax: number };

/**
 * Which content the sheet shows. Both views live in the one BottomSheet on purpose:
 * a second sheet would mean nesting modals, and they share the draft and the footer
 * so the seller can type quantities in either view and confirm once.
 */
type SheetView = 'detail' | 'related';

export function ProductDetailSheet({
  product,
  catalog,
  onClose,
  editLine = null,
}: {
  product: Product | null;
  /** Every product the suggestions can reach — siblings live in the catalog, not in the product. */
  catalog: Product[];
  onClose: () => void;
  /**
   * Cart line the sheet was opened to edit. It only identifies the opening: quantities
   * are read straight from the cart, so nothing has to be lifted out of it.
   */
  editLine?: CartLine | null;
}) {
  const theme = useTheme();
  const cart = useCart();
  const [displayProduct, setDisplayProduct] = useState<Product | null>(product);
  // A Map, not a plain object: object keys coerce to strings, which would quietly
  // turn every numeric product code into a lookup that never matches the catalog.
  const [draft, setDraft] = useState<Map<number, DraftEntry>>(new Map());
  const [focusId, setFocusId] = useState<number | null>(product?.id ?? null);
  const [view, setView] = useState<SheetView>('detail');
  const openingRef = useRef<string | null>(null);

  const catalogById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);

  /** A product's current cart quantities, which is where every draft entry starts. */
  const draftFromCart = useCallback(
    (productId: number): DraftEntry => {
      const line = cart.lines.find((l) => l.productId === productId);
      return { qtyMax: line?.qtyMax ?? 0, qtyMin: line?.qtyMin ?? 0 };
    },
    [cart.lines],
  );

  useEffect(() => {
    if (!product) {
      openingRef.current = null;
      return;
    }
    setDisplayProduct(product);
    // The draft is scratch space for one opening, so it is rebuilt from the cart each
    // time the sheet is opened — and only then, or typing would be wiped on every
    // cart change. Whether an existing line was the entry point takes part in the key,
    // so arriving from the order panel counts as a new opening.
    const opening = `${product.id}|${editLine?.productId ?? ''}`;
    if (openingRef.current === opening) return;
    openingRef.current = opening;
    setFocusId(product.id);
    setView('detail');
    setDraft(new Map([[product.id, draftFromCart(product.id)]]));
  }, [product, editLine, draftFromCart]);

  // Compared against null rather than tested for truthiness: product codes are numbers
  // now, and a truthy check would treat a legitimate code of 0 as "nothing focused".
  const focusProduct = (focusId !== null ? catalogById.get(focusId) : null) ?? displayProduct;

  // Only the inline strip needs a single axis; the related view lists them all, so
  // nothing has to remember which one the seller last looked at.
  const inlineAxis = useMemo(
    () => (focusProduct ? primaryAxis(focusProduct, catalog) : null),
    [focusProduct, catalog],
  );
  const suggestions = useMemo(
    () => (focusProduct && inlineAxis ? suggestionsFor(focusProduct, catalog, inlineAxis) : []),
    [focusProduct, catalog, inlineAxis],
  );
  // Every axis with siblings, grouped for the related view. availableAxes already drops
  // the empty ones, so each section here is guaranteed to have rows.
  const relatedSections = useMemo(
    () =>
      focusProduct
        ? availableAxes(focusProduct, catalog).map((axis) => ({
            axis,
            products: suggestionsFor(focusProduct, catalog, axis),
          }))
        : [],
    [focusProduct, catalog],
  );

  const buildLine = useCallback(
    (target: Product, entry: DraftEntry): CartLine => ({
      productId: target.id,
      productName: target.name,
      flavor: target.flavor,
      sizeLabel: target.sizeLabel,
      minUnitLabel: target.minUnit,
      maxUnitLabel: target.maxUnit,
      qtyMax: entry.qtyMax,
      qtyMin: entry.qtyMin,
      unitPriceMax: target.priceCaja,
      unitPriceMin: target.priceUnidad,
      ice: target.ice,
      unitsPerCase: target.unitsPerCase,
    }),
    [],
  );

  /** Only the drafted products that carry a quantity — what the order will actually get. */
  const draftedLines = useMemo(() => {
    const result: CartLine[] = [];
    for (const [id, entry] of draft) {
      if (entry.qtyMax === 0 && entry.qtyMin === 0) continue;
      const target = catalogById.get(id) ?? (displayProduct?.id === id ? displayProduct : null);
      if (target) result.push(buildLine(target, entry));
    }
    return result;
  }, [draft, catalogById, displayProduct, buildLine]);

  /**
   * Whether the draft says anything the cart does not. A quantity check alone would be
   * wrong: dropping a product to zero is a real change and has to stay confirmable, or
   * the sheet can add a line but never take one away.
   */
  const hasChanges = useMemo(
    () =>
      Array.from(draft).some(([id, entry]) => {
        const current = cart.lines.find((l) => l.productId === id);
        return entry.qtyMax !== (current?.qtyMax ?? 0) || entry.qtyMin !== (current?.qtyMin ?? 0);
      }),
    [draft, cart.lines],
  );
  /**
   * A removal only when the draft is empty AND differs from the cart, i.e. a quantity
   * was actually cleared. An empty draft alone is just a freshly opened sheet, which
   * must still read "Agregar al pedido" rather than offering to remove nothing.
   */
  const isRemoval = hasChanges && draftedLines.length === 0;

  const focusEntry = focusProduct ? (draft.get(focusProduct.id) ?? { qtyMax: 0, qtyMin: 0 }) : null;
  const focusLine = focusProduct && focusEntry ? buildLine(focusProduct, focusEntry) : null;
  const hasFocusQty = !!focusEntry && (focusEntry.qtyMax > 0 || focusEntry.qtyMin > 0);

  const setFocusQty = (key: keyof DraftEntry, qty: number) => {
    if (!focusProduct) return;
    setDraft((prev) => {
      const next = new Map(prev);
      // Seeded from the cart rather than from zero, so touching one unit never wipes a
      // quantity the other unit already carries.
      next.set(focusProduct.id, { ...(prev.get(focusProduct.id) ?? draftFromCart(focusProduct.id)), [key]: qty });
      return next;
    });
  };

  /** Moving to a sibling keeps the draft: the previous product's quantities stay staged. */
  const focusSuggestion = (next: Product) => {
    setDraft((prev) => (prev.has(next.id) ? prev : new Map(prev).set(next.id, draftFromCart(next.id))));
    setFocusId(next.id);
  };

  /** Picking from the related view: focus the product and return to where quantities are typed. */
  const pickSuggestion = (next: Product) => {
    focusSuggestion(next);
    setView('detail');
  };

  const clearDraftEntry = (productId: number) => {
    setDraft((prev) => new Map(prev).set(productId, { qtyMax: 0, qtyMin: 0 }));
  };

  const handleConfirm = () => {
    // Every drafted product is sent, zeros included: an absolute upsert is what lets a
    // quantity dropped to zero remove its line instead of silently staying behind.
    const lines = Array.from(draft, ([id, entry]) => {
      const target = catalogById.get(id) ?? (displayProduct?.id === id ? displayProduct : null);
      return target ? buildLine(target, entry) : null;
    }).filter((line): line is CartLine => line !== null);
    cart.upsertLines(lines);
    onClose();
  };

  if (!focusProduct) return null;

  const isInOrder = (productId: number) => {
    const entry = draft.get(productId) ?? draftFromCart(productId);
    return entry.qtyMax > 0 || entry.qtyMin > 0;
  };

  return (
    <BottomSheet
      visible={!!product}
      onClose={onClose}
      footer={
        <View style={styles.footerRow}>
          <Pressable onPress={onClose} style={[styles.cancelButton, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">Cancelar</ThemedText>
          </Pressable>
          <Pressable
            disabled={!hasChanges}
            onPress={handleConfirm}
            style={[
              styles.addButton,
              { backgroundColor: isRemoval ? theme.danger : theme.success, opacity: hasChanges ? 1 : 0.4 },
            ]}>
            <Icon name={isRemoval ? 'trash' : 'cart'} size={16} color={isRemoval ? theme.onDanger : theme.onSuccess} />
            <ThemedText
              style={[styles.addButtonText, { color: isRemoval ? theme.onDanger : theme.onSuccess }]}>
              {isRemoval ? 'Quitar del pedido' : 'Agregar al pedido'}
            </ThemedText>
          </Pressable>
        </View>
      }>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {view === 'related' ? (
          <>
            <View style={styles.relatedHeader}>
              <Pressable
                hitSlop={8}
                onPress={() => setView('detail')}
                style={[styles.roundButton, { backgroundColor: theme.background }]}>
                <Icon name="chevron.left" size={18} color={theme.text} />
              </Pressable>
              <View style={styles.relatedTitles}>
                <ThemedText type="smallBold">Sugerencias</ThemedText>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={1}
                  style={styles.relatedSubtitle}>
                  {focusProduct.name}
                </ThemedText>
              </View>
            </View>

            {/* A picker, not an entry form: quantities live with the steppers in the detail
                view, so choosing a card focuses it and goes straight back there. Keeping
                one place to type quantities is what stops the sheet being ambiguous again. */}
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Toca uno para cargar sus cantidades
            </ThemedText>

            {relatedSections.map(({ axis, products }) => (
              <View key={axis} style={styles.section}>
                <ThemedText style={[styles.axisHeading, { color: theme.textSecondary }]}>
                  {AXIS_LABELS[axis]}
                </ThemedText>
                {/* No panel here, unlike the detail view: this whole screen is suggestions,
                    so a panel per axis would separate nothing from nothing. The strip fades
                    into the sheet's own surface. */}
                <SuggestionStrip fadeTo={theme.backgroundElement}>
                  {products.map((suggestion) => (
                    <SuggestionCard
                      key={String(suggestion.id)}
                      product={suggestion}
                      axis={axis}
                      inOrder={isInOrder(suggestion.id)}
                      onPress={() => pickSuggestion(suggestion)}
                    />
                  ))}
                </SuggestionStrip>
              </View>
            ))}
          </>
        ) : (
          <>
            {/* Anchor block: the steppers below belong to this exact row of the catalog, so
                the full description comes first. */}
            <View style={styles.titleBlock}>
              <ThemedText type="subtitle" style={styles.title}>
                {focusProduct.name}
              </ThemedText>
              {/* <View style={styles.pillRow}>
                <View style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText style={[styles.codePillText, { color: theme.textSecondary }]}>
                    {focusProduct.id}
                  </ThemedText>
                </View>
                {focusProduct.sizeLabel ? (
                  <View style={[styles.pill, { backgroundColor: theme.accentSoft }]}>
                    <ThemedText style={[styles.pillText, { color: theme.accent }]}>
                      {focusProduct.sizeLabel}
                    </ThemedText>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: focusProduct.inStock ? theme.successSoft : theme.backgroundSelected },
                  ]}>
                  <ThemedText
                    style={[
                      styles.pillText,
                      { color: focusProduct.inStock ? theme.success : theme.textSecondary },
                    ]}>
                    {focusProduct.inStock ? 'En stock' : 'Agotado'}
                  </ThemedText>
                </View>
              </View> */}
            </View>

            <View style={[styles.infoCard, { backgroundColor: theme.background }]}>
              {/* Reference prices per packaging level: what one of each unit costs. */}
              <View style={styles.infoBottomRow}>
                <InfoStat label="ICE" value={formatBs(focusProduct.ice)} color={theme.text} />
                <InfoStat label="Und. mín." value={formatBs(focusProduct.priceUnidad)} color={theme.success} />
                <InfoStat label="Und. máx." value={formatBs(focusProduct.priceCaja)} color={theme.success} />
              </View>
            </View>

            <View style={[styles.equivalenceRow, { backgroundColor: theme.background }]}>
              <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
                <Icon name="cube.box.fill" size={15} color={theme.accent} />
              </View>
              <ThemedText type="smallBold" style={styles.equivalenceLabel}>
                Equivalencias
              </ThemedText>
              <View style={[styles.equivalencePill, { backgroundColor: theme.accentSoft }]}>
                <ThemedText style={[styles.equivalencePillText, { color: theme.accent }]}>
                  1 {focusProduct.maxUnit} = {focusProduct.unitsPerCase} {focusProduct.minUnit}
                </ThemedText>
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold">Cantidad</ThemedText>
              <QuantityStepper
                unit="CAJA"
                unitLabel={focusProduct.maxUnit}
                qty={focusEntry?.qtyMax ?? 0}
                onChange={(qty) => setFocusQty('qtyMax', qty)}
              />
              <QuantityStepper
                unit="UNIDAD"
                unitLabel={focusProduct.minUnit}
                qty={focusEntry?.qtyMin ?? 0}
                onChange={(qty) => setFocusQty('qtyMin', qty)}
              />

              {/* One line instead of a summary card: the seller only needs to confirm the
                  quantity just typed resolves to the amount they expect. */}
              {hasFocusQty && focusLine ? (
                <View style={styles.focusTotalRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.focusTotalLabel}>
                    {lineMinUnits(focusLine)} {focusProduct.minUnit} en total
                  </ThemedText>
                  <ThemedText style={[styles.focusTotalValue, { color: theme.success }]}>
                    {formatBs(lineAmount(focusLine))}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {inlineAxis && suggestions.length > 0 ? (
              /* The tinted panel is what makes this read as its own section instead of
                 dissolving into the sheet's vertical flow — the same wash the price and
                 equivalence blocks above already use. It also gives the cards, which are
                 `backgroundElement`, a surface to sit on other than themselves. */
              <View style={[styles.suggestionsPanel, { backgroundColor: theme.background }]}>
                {/* One axis inline keeps the strip short; the rest of the family is a tap
                    away, which is also the only route to the bulk-entry list. */}
                <View style={styles.suggestionsHeader}>
                  <ThemedText type="smallBold" style={styles.suggestionsTitle}>
                    Sugerencias
                  </ThemedText>
                  <Pressable
                    onPress={() => setView('related')}
                    style={[styles.moreButton, { backgroundColor: theme.accentSoft }]}>
                    <ThemedText type="smallBold" style={[styles.moreButtonText, { color: theme.accent }]}>
                      Ver más
                    </ThemedText>
                    <Icon name="chevron.right" size={11} color={theme.accent} />
                  </Pressable>
                </View>

                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  Toca para cambiar de producto
                </ThemedText>

                <SuggestionStrip fadeTo={theme.background}>
                  {suggestions.map((suggestion) => (
                    <SuggestionCard
                      key={String(suggestion.id)}
                      product={suggestion}
                      axis={inlineAxis}
                      inOrder={isInOrder(suggestion.id)}
                      onPress={() => focusSuggestion(suggestion)}
                    />
                  ))}
                </SuggestionStrip>
              </View>
            ) : null}

            {draftedLines.length > 1 ? (
              <View style={[styles.draftSection, { borderTopColor: theme.border }]}>
                <ThemedText type="smallBold">En este pedido · {draftedLines.length} productos</ThemedText>

                {draftedLines.map((line) => {
                  const isFocused = line.productId === focusProduct.id;
                  return (
                    <Pressable
                      key={String(line.productId)}
                      onPress={() => setFocusId(line.productId)}
                      style={[
                        styles.draftRow,
                        {
                          backgroundColor: theme.background,
                          // Accent border marks the row the steppers above are editing.
                          borderColor: isFocused ? theme.accent : 'transparent',
                        },
                      ]}>
                      <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
                        <Icon name="bag.fill" size={14} color={theme.accent} />
                      </View>
                      <View style={styles.draftTexts}>
                        <ThemedText type="smallBold" numberOfLines={1} style={styles.draftName}>
                          {line.productName}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.draftQty}>
                          {lineQtyLabel(line)}
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.draftPrice, { color: theme.accent }]}>
                        {formatBs(lineAmount(line))}
                      </ThemedText>
                      <Pressable hitSlop={8} onPress={() => clearDraftEntry(line.productId)} style={styles.draftIcon}>
                        <Icon name="trash" size={14} color={theme.danger} />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function InfoStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.infoStat}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.infoValue, { color }]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    // Small: the footer's own top padding already separates the content from the buttons,
    // so a full Spacing.three here just doubled that gap.
    paddingBottom: Spacing.one,
    gap: Spacing.two,
  },
  titleBlock: {
    gap: 6,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  pill: {
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  codePillText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  infoBottomRow: {
    flexDirection: 'row',
  },
  infoStat: {
    flex: 1,
    gap: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equivalenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  equivalenceLabel: {
    flex: 1,
  },
  equivalencePill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
  },
  equivalencePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    gap: 6,
  },
  focusTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  focusTotalLabel: {
    flex: 1,
    fontSize: 12,
  },
  focusTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  suggestionsPanel: {
    gap: 6,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  suggestionsTitle: {
    flex: 1,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: ChipPadding.horizontal,
    paddingRight: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  moreButtonText: {
    fontSize: 11,
  },
  relatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relatedTitles: {
    flex: 1,
    gap: 1,
  },
  axisHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  relatedSubtitle: {
    fontSize: 12,
  },
  hint: {
    fontSize: 11,
  },
  draftSection: {
    gap: 6,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    gap: 6,
  },
  draftTexts: {
    flex: 1,
    gap: 1,
  },
  draftName: {
    fontSize: 12,
  },
  draftQty: {
    fontSize: 11,
  },
  draftPrice: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  draftIcon: {
    padding: 2,
  },
  footerRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cancelButton: {
    flex: 1,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flex: 2,
    flexDirection: 'row',
    height: ControlHeight.input,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
