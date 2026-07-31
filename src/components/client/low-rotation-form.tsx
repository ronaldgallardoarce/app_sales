import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  DateInputField,
  isDateInputComplete,
  isDateInputValid,
} from '@/components/ui/date-input-field';
import { Icon } from '@/components/ui/icon';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { Select } from '@/components/ui/select';
import { ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import { mockProducts } from '@/data/mock-catalog';
import { LOT_CODES, type LotCode } from '@/data/mock-tasks';
import { useTheme } from '@/hooks/use-theme';

/** Photos allowed on one slow-moving stock record. */
const MAX_PHOTOS = 3;

/** Characters in a complete `DD/MM/AAAA` value. */
/**
 * Re-exported under the names the tasks screen already imports. The implementation moved to
 * `DateInputField` when the returns flow needed the same masked date — one copy of the
 * `31/02` rollover check, not two that can drift apart.
 */
export const isExpiryComplete = isDateInputComplete;
export const isExpiryValid = isDateInputValid;

/**
 * What the seller records for a slow-moving product found at the client. The shape
 * is owned here rather than by the tasks screen so the form is the only place that
 * has to change when a field is added, and the screen's draft type just points at it.
 */
export type LowRotationValue = {
  productId: number | null;
  /** Kept as the typed string, not a Date: the field is a masked DD/MM/AAAA input and a
   *  partially typed value is a normal intermediate state. */
  expiry: string;
  lot: LotCode | null;
  qty: number;
};

export function emptyLowRotation(): LowRotationValue {
  return { productId: null, expiry: '', lot: null, qty: 0 };
}

/**
 * Form for the `baja-rotacion` task response: which product, when it expires, which
 * lot, how much of it, and photographic evidence.
 *
 * Choosing the product swaps the sheet's content for `ProductPickerView` instead of
 * raising a second sheet. This form is rendered inside a `BottomSheet`, which is a
 * `Modal`: a picker raised as another sheet would be presented *below* the open one
 * and never become visible. The swap is owned by the tasks screen, so this form only
 * asks for it.
 */
export function LowRotationForm({
  value,
  onChange,
  photos,
  onPhotosChange,
  onOpenProductPicker,
}: {
  value: LowRotationValue;
  /** Patch-shaped so each field updates without the caller restating the rest. */
  onChange: (patch: Partial<LowRotationValue>) => void;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onOpenProductPicker: () => void;
}) {
  return (
    <View style={styles.form}>
      <SectionLabel>Producto</SectionLabel>
      <ProductSelectRow productId={value.productId} onPress={onOpenProductPicker} />

      <SectionLabel>Fecha de vencimiento</SectionLabel>
      <DateInputField
        value={value.expiry}
        onChange={(expiry) => onChange({ expiry })}
        title="Fecha de vencimiento"
      />

      <SectionLabel>Lote</SectionLabel>
      <LotSelect lot={value.lot} onSelect={(lot) => onChange({ lot })} />

      <SectionLabel>Cantidad</SectionLabel>
      <QtyStepper qty={value.qty} onChange={(qty) => onChange({ qty })} />

      {/* Camera only. The photo has to show the stock as it sits on the shelf right now,
          next to the expiry and lot being recorded — a gallery image proves nothing about
          this visit, and an old shot of the same shelf is the easiest way to file a record
          that no longer matches reality. */}
      <SectionLabel>Fotos</SectionLabel>
      <PhotoPicker uris={photos} onChange={onPhotosChange} max={MAX_PHOTOS} cameraOnly />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Product — one row in the form, the full list in a swapped-in view    */
/* ------------------------------------------------------------------ */

/** The form's `Producto` field: what was chosen, and the way into the picker view. */
function ProductSelectRow({ productId, onPress }: { productId: number | null; onPress: () => void }) {
  const theme = useTheme();
  const selected = useMemo(() => mockProducts.find((p) => p.id === productId) ?? null, [productId]);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.selectRow,
        // Accent border is how the rest of the app marks a filled selection.
        { backgroundColor: theme.background, borderColor: selected ? theme.accent : theme.border },
      ]}>
      <Icon name="shippingbox.fill" size={15} color={theme.accent} />
      <View style={styles.selectTexts}>
        {selected ? (
          <>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.selectLabel}>
              {selected.id}-{selected.name}
            </ThemedText>
            {selected.sizeLabel ? (
              <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.selectMeta}>
                {selected.sizeLabel}
              </ThemedText>
            ) : null}
          </>
        ) : (
          <ThemedText themeColor="textSecondary" style={styles.selectLabel}>
            Elegir producto
          </ThemedText>
        )}
      </View>
      <Icon name="chevron.right" size={13} color={theme.textSecondary} />
    </Pressable>
  );
}

/**
 * The product list as a whole sheet view, not a block inside the form. It replaces the
 * task content while it is open — which is what buys the uncapped list, so nothing here
 * scrolls on its own: the sheet's own ScrollView is the only scroller.
 */
export function ProductPickerView({
  selectedId,
  onSelect,
  onBack,
}: {
  selectedId: number | null;
  onSelect: (productId: number) => void;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  // Code as well as name: the seller reads the code off the package more often than
  // the full commercial description. An empty query lists everything — browsing the
  // catalog is a legitimate way to find the product.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockProducts;
    return mockProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.id).includes(q),
    );
  }, [query]);

  return (
    <View style={styles.picker}>
      <View style={styles.pickerHeader}>
        <Pressable
          hitSlop={8}
          onPress={onBack}
          style={[styles.roundButton, { backgroundColor: theme.background }]}>
          <Icon name="chevron.left" size={18} color={theme.text} />
        </Pressable>
        <View style={styles.pickerTitles}>
          <ThemedText type="smallBold" style={styles.pickerTitle}>
            Elegir producto
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.pickerSubtitle}>
            Buscá por código o nombre
          </ThemedText>
        </View>
      </View>

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

      {matches.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: theme.backgroundSelected }]}>
            <Icon name="magnifyingglass" size={22} color={theme.textSecondary} />
          </View>
          <ThemedText type="smallBold" style={styles.emptyText}>
            No se encontraron productos
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            Probá con otro código o nombre
          </ThemedText>
        </View>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.pickerHint}>
            {matches.length} producto{matches.length === 1 ? '' : 's'}
          </ThemedText>

          <View style={styles.results}>
            {matches.map((product) => {
              const isSelected = product.id === selectedId;
              return (
                <Pressable
                  key={product.id}
                  onPress={() => {
                    onSelect(product.id);
                    // Straight back to the form: the picker answers one question, and
                    // staying here would leave the seller wondering what confirms it.
                    onBack();
                  }}
                  style={[
                    styles.resultRow,
                    {
                      backgroundColor: theme.background,
                      borderColor: isSelected ? theme.accent : 'transparent',
                    },
                  ]}>
                  <View style={styles.resultTexts}>
                    <ThemedText type="smallBold" numberOfLines={2} style={styles.resultName}>
                      {product.id}-{product.name}
                    </ThemedText>
                    {product.sizeLabel ? (
                      <View style={[styles.sizePill, { backgroundColor: theme.backgroundElement }]}>
                        <ThemedText style={[styles.sizeText, { color: theme.textSecondary }]}>
                          {product.sizeLabel}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Icon name="checkmark" size={14} color={theme.accent} />
                  ) : (
                    <Icon name="chevron.right" size={14} color={theme.textSecondary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Lot — select, options in a menu over the form                       */
/* ------------------------------------------------------------------ */

/**
 * A select rather than a segmented row. The lot list is warehouse data that grows, and a
 * segment divides the width by however many codes exist — past a handful the labels stop
 * being readable, while a select costs the same regardless of the count.
 *
 * Codes are their own labels here: they are what is printed on the package and what the
 * seller reads out loud, so expanding them into invented long names would only make the
 * seller translate back (see the note on `LotCode`).
 */
function LotSelect({ lot, onSelect }: { lot: LotCode | null; onSelect: (lot: LotCode) => void }) {
  return (
    <Select
      value={lot}
      options={LOT_CODES.map((code) => ({ value: code, label: code }))}
      placeholder="Elegir lote"
      icon="tag.fill"
      onSelect={onSelect}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Quantity                                                            */
/* ------------------------------------------------------------------ */

/**
 * Local stepper instead of the catalog's `QuantityStepper`: that one is a full-width
 * row built around a product's packaging unit labels and takes a `UnitCode`, neither
 * of which means anything for a slow-moving count.
 */
function QtyStepper({ qty, onChange }: { qty: number; onChange: (qty: number) => void }) {
  const theme = useTheme();
  const [text, setText] = useState(String(qty));

  // qty changes from outside too (reopening the sheet resets the draft) — keep the
  // field in sync rather than letting it show a stale number.
  useEffect(() => {
    setText(String(qty));
  }, [qty]);

  const commit = (value: string) => {
    const parsed = Math.max(0, Math.floor(Number(value.replace(/[^0-9]/g, '')) || 0));
    setText(String(parsed));
    onChange(parsed);
  };

  const step = (delta: number) => {
    const next = Math.max(0, qty + delta);
    setText(String(next));
    onChange(next);
  };

  return (
    <View style={styles.stepper}>
      <Pressable
        hitSlop={8}
        onPress={() => step(-1)}
        style={[styles.stepButton, { backgroundColor: theme.accentSoft }]}>
        <Icon name="minus" size={14} color={theme.accent} />
      </Pressable>

      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={(e) => commit(e.nativeEvent.text)}
        onBlur={() => commit(text)}
        keyboardType="number-pad"
        style={[styles.qtyInput, { color: theme.text, borderColor: theme.border }]}
      />

      <Pressable
        hitSlop={8}
        onPress={() => step(1)}
        style={[styles.stepButton, { backgroundColor: theme.accentSoft }]}>
        <Icon name="plus" size={14} color={theme.accent} />
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Shared section label                                                */
/* ------------------------------------------------------------------ */

function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.two,
  },
  sectionLabel: {
    fontSize: 11,
    // Explicit: the `smallBold` type carries lineHeight 20, so the smaller font alone
    // would leave the old line box and the label would keep its former height.
    lineHeight: 14,
    // Pulls each label onto its own control so the form gap reads as the separation
    // between sections, not between a label and what it names.
    marginBottom: -Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  picker: {
    gap: Spacing.two,
  },
  pickerHeader: {
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
  pickerTitles: {
    flex: 1,
    gap: 1,
  },
  pickerTitle: {
    fontSize: 15,
    lineHeight: 19,
  },
  pickerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  pickerHint: {
    fontSize: 11,
    lineHeight: 14,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: Spacing.four,
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
  results: {
    gap: Spacing.one,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
  },
  resultTexts: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 1,
  },
  resultName: {
    fontSize: 12,
    lineHeight: 16,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: ControlHeight.input,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  selectTexts: {
    flex: 1,
    gap: 1,
  },
  selectLabel: {
    fontSize: 13,
    lineHeight: 17,
  },
  selectMeta: {
    fontSize: 11,
    lineHeight: 14,
  },
  sizePill: {
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  sizeText: {
    fontSize: 10,
    // The default ThemedText type carries lineHeight 24, which turned this pill three
    // times taller than the text inside it.
    lineHeight: 13,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    width: 64,
    height: 30,
    borderRadius: Radius.sm,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
});
