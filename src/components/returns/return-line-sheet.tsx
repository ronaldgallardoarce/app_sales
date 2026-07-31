import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { QuantityStepper } from '@/components/product-detail/quantity-stepper';
import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { DateInputField } from '@/components/ui/date-input-field';
import { Icon } from '@/components/ui/icon';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { Select } from '@/components/ui/select';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { mockProducts } from '@/data/mock-catalog';
import { LOT_ORIGINS } from '@/data/mock-returns';
import { useTheme } from '@/hooks/use-theme';
import type { Product } from '@/types/catalog';
import type { ReturnLine } from '@/types/returns';
import { missingOf, newReturnLine } from '@/utils/returns';

/**
 * Which content the sheet shows. The product picker is a swap and not a second sheet: this
 * renders inside a `BottomSheet`, which is a `Modal`, so another sheet raised as a sibling
 * would be presented *below* the open one and never appear — the same reason the tasks screen
 * swaps. It lives here rather than inside the form because the footer, mounted outside the
 * form, has to know the seller is still picking.
 */
type SheetView = 'product' | 'form';

/** One photo each. Two angles of the same defect is a second opinion, not a second fact. */
const MAX_PHOTOS = 1;

/**
 * The full record of one returned product: how much, from which lot, and the proof.
 *
 * Everything about a line is asked in one place rather than spread across the list screen,
 * because these fields only make sense together — a lot number without the photo of the lot is
 * a number nobody can verify, and an expiry date belongs to the lot it was read off.
 */
export function ReturnLineSheet({
  visible,
  line,
  onSave,
  onClose,
}: {
  visible: boolean;
  /** The line being edited, or null to add a new one — which opens on the product picker. */
  line: ReturnLine | null;
  onSave: (line: ReturnLine) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState<ReturnLine | null>(line);
  const [view, setView] = useState<SheetView>(line ? 'form' : 'product');

  /**
   * Reseeded every time the sheet opens, and never while it is open. Without the `visible`
   * guard the draft would be thrown away mid-edit on any re-render that changed `line`; without
   * the reseed, reopening on a different product would show the previous one's photos.
   */
  useEffect(() => {
    if (!visible) return;
    setDraft(line);
    setView(line ? 'form' : 'product');
  }, [visible, line]);

  const pickProduct = (product: Product) => {
    setDraft(newReturnLine(product));
    setView('form');
  };

  const patch = (change: Partial<ReturnLine>) =>
    setDraft((current) => (current ? { ...current, ...change } : current));

  const missing = draft ? missingOf(draft) : [];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      footer={
        view === 'form' && draft ? (
          <Pressable
            disabled={missing.length > 0}
            onPress={() => onSave(draft)}
            style={[
              styles.saveButton,
              { backgroundColor: theme.accent, opacity: missing.length > 0 ? 0.4 : 1 },
            ]}>
            <Icon name="checkmark" size={16} color={theme.onAccent} />
            {/* The label names the action and nothing else. Listing the missing fields here
                repeated what the empty fields a few centimetres above already say — and it made
                the button change shape on every keystroke. Disabled is the whole message. */}
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {line === null ? 'Agregar producto' : 'Guardar cambios'}
            </ThemedText>
          </Pressable>
        ) : null
      }>
      {view === 'product' || !draft ? (
        <ProductPickerView onSelect={pickProduct} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetScroll}>
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="shippingbox.slash" size={18} color={theme.accent} />
            </View>
            <View style={styles.sheetHeaderText}>
              <ThemedText type="smallBold" numberOfLines={2} style={styles.sheetTitle}>
                {draft.productName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Código {draft.productId}
              </ThemedText>
            </View>
            {/* Only offered while adding: on an existing line the product is what identifies the
                record, and swapping it under the photos already taken would leave evidence of one
                product filed against another. */}
            {line === null ? (
              <Pressable
                hitSlop={8}
                onPress={() => setView('product')}
                style={[styles.changeButton, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" style={styles.changeLabel}>
                  Cambiar
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          <FieldLabel>Cantidad a devolver</FieldLabel>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <QuantityStepper
              unit="CAJA"
              unitLabel={draft.maxUnitLabel}
              qty={draft.qtyMax}
              onChange={(qtyMax) => patch({ qtyMax })}
            />
            <QuantityStepper
              unit="UNIDAD"
              unitLabel={draft.minUnitLabel}
              qty={draft.qtyMin}
              onChange={(qtyMin) => patch({ qtyMin })}
            />
          </View>

          <FieldLabel>Lote</FieldLabel>
          <View style={styles.lotRow}>
            <View style={styles.lotOrigin}>
              <Select
                value={draft.lotOrigin}
                options={LOT_ORIGINS}
                placeholder="Lote"
                icon="shippingbox.fill"
                onSelect={(lotOrigin) => patch({ lotOrigin })}
              />
            </View>
            <TextInput
              value={draft.lotNumber}
              onChangeText={(lotNumber) => patch({ lotNumber })}
              placeholder="N° de lote"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              style={[
                styles.input,
                styles.lotNumber,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}
            />
          </View>

          <FieldLabel>Vencimiento del producto</FieldLabel>
          <DateInputField
            value={draft.expiryDate}
            onChange={(expiryDate) => patch({ expiryDate })}
            title="Vencimiento del producto"
          />

          <FieldLabel>Observación</FieldLabel>
          <TextInput
            value={draft.observation}
            onChangeText={(observation) => patch({ observation })}
            placeholder="Qué se observó en este producto (opcional)"
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[
              styles.input,
              styles.notesInput,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
            ]}
          />

          {/* Two separate pickers and not one set of three photos: the office checks the lot
              number against a picture of the lot, and a pile where either could be missing
              cannot be checked at all. Camera only, like the exceptional-exit evidence: a photo
              out of the gallery proves nothing about the stock on this shelf today. */}
          <FieldLabel>Foto del fallo</FieldLabel>
          <PhotoPicker
            uris={draft.defectPhotos}
            onChange={(defectPhotos) => patch({ defectPhotos })}
            max={MAX_PHOTOS}
            cameraOnly
          />

          <FieldLabel>Foto del lote en el producto</FieldLabel>
          <PhotoPicker
            uris={draft.lotPhotos}
            onChange={(lotPhotos) => patch({ lotPhotos })}
            max={MAX_PHOTOS}
            cameraOnly
          />
        </ScrollView>
      )}
    </BottomSheet>
  );
}

/** The whole catalog, searchable. Fills the sheet on its own — that is the point of swapping. */
function ProductPickerView({ onSelect }: { onSelect: (product: Product) => void }) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockProducts;
    // Matches the code as well as the description: a seller reading a code off the case in
    // their hands is exactly the situation this screen exists for.
    return mockProducts.filter((product) => `${product.id} ${product.name}`.toLowerCase().includes(q));
  }, [query]);

  return (
    <View style={styles.picker}>
      <ThemedText type="smallBold" style={styles.pickerTitle}>
        Elegí el producto a devolver
      </ThemedText>

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.pickerList}>
        {results.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Ningún producto coincide con la búsqueda.
          </ThemedText>
        ) : (
          results.map((product) => (
            <Pressable
              key={product.id}
              onPress={() => onSelect(product)}
              style={[
                styles.option,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}>
              <View style={styles.optionTexts}>
                <ThemedText type="smallBold" numberOfLines={2} style={styles.optionName}>
                  {product.id} - {product.name}
                </ThemedText>
                <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.optionMeta}>
                  {product.family} · {product.maxUnit} de {product.unitsPerCase} {product.minUnit}
                </ThemedText>
              </View>
              <Icon name="chevron.right" size={15} color={theme.textSecondary} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.fieldLabel}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  sheetScroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderText: {
    flex: 1,
    gap: 1,
  },
  sheetTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  changeButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  changeLabel: {
    fontSize: 11,
  },
  fieldLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.two,
  },
  card: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.one,
    gap: Spacing.one,
  },
  lotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  lotOrigin: {
    // Wide enough for "IMPORTADO" without the chevron crowding it; the number beside it takes
    // the rest, because a lot code is longer than its origin.
    width: 138,
  },
  lotNumber: {
    flex: 1,
  },
  input: {
    minHeight: ControlHeight.input,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    fontSize: 13,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
  picker: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  pickerTitle: {
    fontSize: 14,
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
    paddingVertical: 0,
  },
  pickerList: {
    gap: 6,
    paddingBottom: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
  },
  optionTexts: {
    flex: 1,
    gap: 1,
  },
  optionName: {
    fontSize: 12,
    lineHeight: 16,
  },
  optionMeta: {
    fontSize: 10,
    lineHeight: 13,
  },
  empty: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
});
