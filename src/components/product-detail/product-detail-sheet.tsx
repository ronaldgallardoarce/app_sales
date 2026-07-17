import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { QuantityStepper } from '@/components/product-detail/quantity-stepper';
import { VariantChip } from '@/components/product-detail/variant-chip';
import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/context/cart-context';
import { useTheme } from '@/hooks/use-theme';
import { CartLine, Product } from '@/types/catalog';
import { formatBs } from '@/utils/currency';

export function ProductDetailSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const theme = useTheme();
  const cart = useCart();
  const [displayProduct, setDisplayProduct] = useState<Product | null>(product);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cajaQty, setCajaQty] = useState(0);
  const [unidadQty, setUnidadQty] = useState(0);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (product) {
      setDisplayProduct(product);
      if (product.id !== lastIdRef.current) {
        lastIdRef.current = product.id;
        setSelectedIndex(0);
        setCajaQty(0);
        setUnidadQty(0);
      }
    }
  }, [product]);

  const hasVariants = (displayProduct?.variants.length ?? 0) > 1;
  const currentVariant = displayProduct?.variants[Math.min(selectedIndex, displayProduct.variants.length - 1)];

  const variantsBySku = useMemo(
    () => new Map((displayProduct?.variants ?? []).map((v) => [v.sku, v])),
    [displayProduct],
  );

  const existingLines = useMemo(
    () => (displayProduct ? cart.lines.filter((l) => l.productId === displayProduct.id) : []),
    [cart.lines, displayProduct],
  );

  const pendingSubtotal = useMemo(
    () => (currentVariant ? cajaQty * currentVariant.priceCaja + unidadQty * currentVariant.priceUnidad : 0),
    [currentVariant, cajaQty, unidadQty],
  );
  const pendingUnits = useMemo(
    () => (currentVariant ? cajaQty * currentVariant.unitsPerCase + unidadQty : 0),
    [currentVariant, cajaQty, unidadQty],
  );
  const hasPending = cajaQty > 0 || unidadQty > 0;

  const buildPendingLines = (): CartLine[] => {
    if (!displayProduct || !currentVariant) return [];
    const lines: CartLine[] = [];
    if (cajaQty > 0) {
      lines.push({
        id: `${currentVariant.sku}-CAJA`,
        productId: displayProduct.id,
        productName: displayProduct.name,
        flavor: currentVariant.flavor,
        sku: currentVariant.sku,
        unit: 'CAJA',
        qty: cajaQty,
        unitPrice: currentVariant.priceCaja,
      });
    }
    if (unidadQty > 0) {
      lines.push({
        id: `${currentVariant.sku}-UNIDAD`,
        productId: displayProduct.id,
        productName: displayProduct.name,
        flavor: currentVariant.flavor,
        sku: currentVariant.sku,
        unit: 'UNIDAD',
        qty: unidadQty,
        unitPrice: currentVariant.priceUnidad,
      });
    }
    return lines;
  };

  const commitPending = () => {
    const lines = buildPendingLines();
    if (lines.length === 0) return;
    cart.addLines(lines);
    setCajaQty(0);
    setUnidadQty(0);
  };

  const selectVariant = (index: number) => {
    if (index === selectedIndex) return;
    commitPending();
    setSelectedIndex(index);
  };

  const editExistingLine = (line: CartLine) => {
    if (!displayProduct) return;
    const idx = displayProduct.variants.findIndex((v) => v.sku === line.sku);
    const isSameVariant = idx === selectedIndex;
    const pendingSameUnit = isSameVariant ? (line.unit === 'CAJA' ? cajaQty : unidadQty) : 0;
    if (!isSameVariant) commitPending();
    if (idx >= 0) setSelectedIndex(idx);
    const nextQty = line.qty + pendingSameUnit;
    if (line.unit === 'CAJA') setCajaQty(nextQty);
    else setUnidadQty(nextQty);
    cart.removeLine(line.id);
  };

  const handleAddToOrder = () => {
    commitPending();
    onClose();
  };

  if (!displayProduct || !currentVariant) return null;

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
            disabled={!hasPending}
            onPress={handleAddToOrder}
            style={[styles.addButton, { backgroundColor: theme.success, opacity: hasPending ? 1 : 0.4 }]}>
            <Icon name="cart" size={16} color={theme.onSuccess} />
            <ThemedText style={[styles.addButtonText, { color: theme.onSuccess }]}>Agregar al pedido</ThemedText>
          </Pressable>
        </View>
      }>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* <View style={styles.topRow}>
          <View style={[styles.codePill, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText style={[styles.codePillText, { color: theme.textSecondary }]}>
              Código: {currentVariant.sku}
            </ThemedText>
          </View>
          <View
            style={[
              styles.stockPill,
              { backgroundColor: displayProduct.inStock ? theme.successSoft : theme.backgroundSelected },
            ]}>
            <ThemedText
              style={[styles.stockPillText, { color: displayProduct.inStock ? theme.success : theme.textSecondary }]}>
              {displayProduct.inStock ? 'En stock' : 'Agotado'}
            </ThemedText>
          </View>
        </View> */}

        <ThemedText type="subtitle" style={styles.title}>
          {displayProduct.name}
        </ThemedText>

        <View style={[styles.infoCard, { backgroundColor: theme.background }]}>
          {/* <View style={styles.infoTopRow}>
            <InfoStat label="Precio de venta" value={formatBs(currentVariant.priceUnidad)} color={theme.accent} />
            <InfoStat label="Utilidad" value={`${currentVariant.utilidadPct}%`} color={theme.success} />
          </View>
          <View style={[styles.infoDivider, { backgroundColor: theme.border }]} /> */}
          <View style={styles.infoBottomRow}>
            <InfoStat label="ICE" value={formatBs(currentVariant.ice)} color={theme.text} />
            <InfoStat label="Precio mín." value={formatBs(currentVariant.priceMin)} color={theme.success} />
            <InfoStat label="Precio máx." value={formatBs(currentVariant.priceMax)} color={theme.success} />
          </View>
        </View>

        {hasVariants ? (
          <View style={styles.variantSection}>
            <View style={styles.variantHeader}>
              <View style={[styles.variantIconWrap, { backgroundColor: theme.accentSoft }]}>
                <Icon name="square.grid.2x2" size={15} color={theme.accent} />
              </View>
              <View style={styles.variantHeaderTexts}>
                <ThemedText type="smallBold">Otros sabores disponibles</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Son productos distintos: cada uno se agrega como su propia línea.
                </ThemedText>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {displayProduct.variants.map((variant, index) => (
                <VariantChip
                  key={variant.sku}
                  variant={variant}
                  familyLabel={displayProduct.family}
                  selected={index === selectedIndex}
                  onPress={() => selectVariant(index)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={[styles.equivalenceRow, { backgroundColor: theme.background }]}>
          <View style={[styles.variantIconWrap, { backgroundColor: theme.accentSoft }]}>
            <Icon name="cube.box.fill" size={15} color={theme.accent} />
          </View>
          <ThemedText type="smallBold" style={styles.equivalenceLabel}>
            Equivalencias
          </ThemedText>
          <View style={[styles.equivalencePill, { backgroundColor: theme.accentSoft }]}>
            <ThemedText style={[styles.equivalencePillText, { color: theme.accent }]}>
              1 CAJA = {currentVariant.unitsPerCase} UNIDADES
            </ThemedText>
          </View>
        </View>

        <View style={styles.addSection}>
          <ThemedText type="smallBold">
            Agregar al pedido{hasVariants ? ` · ${currentVariant.flavor}` : ''}
          </ThemedText>
          <QuantityStepper unit="CAJA" qty={cajaQty} unitsPerCase={currentVariant.unitsPerCase} onChange={setCajaQty} />
          <QuantityStepper
            unit="UNIDAD"
            qty={unidadQty}
            unitsPerCase={currentVariant.unitsPerCase}
            onChange={setUnidadQty}
          />
        </View>

        {hasPending ? (
          <View style={styles.summarySection}>
            <ThemedText type="smallBold">Resumen del pedido</ThemedText>
            <View style={[styles.summaryCard, { backgroundColor: theme.background }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: theme.successSoft }]}>
                <Icon name="shippingbox.fill" size={16} color={theme.success} />
              </View>
              <View style={styles.summaryTexts}>
                <ThemedText type="smallBold">Total a agregar</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {pendingUnits} unidades
                </ThemedText>
              </View>
              <ThemedText style={[styles.summaryValue, { color: theme.success }]}>{formatBs(pendingSubtotal)}</ThemedText>
              <Icon name="chevron.right" size={14} color={theme.textSecondary} />
            </View>
            {hasVariants ? (
              <Pressable onPress={commitPending} style={styles.addFlavorLink}>
                <ThemedText type="linkPrimary" style={{ color: theme.accent }}>
                  + Agregar otro sabor
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {hasVariants && existingLines.length > 0 ? (
          <View style={[styles.stagedSection, { borderTopColor: theme.border }]}>
            <ThemedText type="smallBold">Ya en el pedido</ThemedText>

            {existingLines.map((line) => {
              const unitsPerCase = variantsBySku.get(line.sku)?.unitsPerCase ?? 1;
              return (
                <View key={line.id} style={[styles.stagedRow, { backgroundColor: theme.background }]}>
                  <View style={[styles.stagedIconWrap, { backgroundColor: theme.accentSoft }]}>
                    <Icon name="bag.fill" size={14} color={theme.accent} />
                  </View>
                  <View style={styles.stagedTexts}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {displayProduct.name} · {line.flavor}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {line.qty} {line.unit === 'CAJA' ? 'cajas' : 'unidades'}
                      {line.unit === 'CAJA' ? ` (${line.qty * unitsPerCase} uds)` : ''}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.stagedPrice, { color: theme.accent }]}>
                    {formatBs(line.qty * line.unitPrice)}
                  </ThemedText>
                  <Pressable hitSlop={8} onPress={() => editExistingLine(line)} style={styles.stagedIcon}>
                    <Icon name="pencil" size={14} color={theme.textSecondary} />
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => cart.removeLine(line.id)} style={styles.stagedIcon}>
                    <Icon name="trash" size={14} color={theme.danger} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
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
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  codePill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  codePillText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  stockPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  stockPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
  },
  infoCard: {
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  infoTopRow: {
    flexDirection: 'row',
  },
  infoBottomRow: {
    flexDirection: 'row',
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth,
  },
  infoStat: {
    flex: 1,
    gap: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  variantSection: {
    gap: Spacing.two,
  },
  variantHeader: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  variantIconWrap: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantHeaderTexts: {
    flex: 1,
    gap: 2,
  },
  chipsRow: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
    paddingTop: Spacing.one,
  },
  equivalenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    padding: Spacing.two,
  },
  equivalenceLabel: {
    flex: 1,
  },
  equivalencePill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  equivalencePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  addSection: {
    gap: Spacing.two,
  },
  summarySection: {
    gap: Spacing.two,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTexts: {
    flex: 1,
    gap: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  addFlavorLink: {
    paddingVertical: Spacing.one,
  },
  stagedSection: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stagedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
  },
  stagedIconWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stagedTexts: {
    flex: 1,
    gap: 2,
  },
  stagedPrice: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  stagedIcon: {
    padding: 2,
  },
  footerRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cancelButton: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flex: 2,
    flexDirection: 'row',
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
