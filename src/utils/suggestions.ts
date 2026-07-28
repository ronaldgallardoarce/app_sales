import type { Product } from '@/types/catalog';

export type SuggestionAxis = 'flavor' | 'size';

/** Section headings. "Presentación" covers gr, ml, kg and L — "peso" would not. */
export const AXIS_LABELS: Record<SuggestionAxis, string> = {
  flavor: 'Sabores',
  size: 'Presentación',
};

/** Multipliers that bring every size label onto one scale: grams and millilitres. */
const SIZE_UNIT_FACTOR: Record<string, number> = {
  g: 1,
  gr: 1,
  kg: 1000,
  ml: 1,
  cc: 1,
  l: 1000,
};

/**
 * Size as a comparable number, so "1 L" sorts after "300 ml" instead of before it.
 * Returns null for labels that are not a measure ("x4"), which then fall back to
 * alphabetical ordering.
 */
function sizeRank(sizeLabel?: string): number | null {
  const match = /^([\d.,]+)\s*([a-zA-Z]+)$/.exec(sizeLabel?.trim() ?? '');
  if (!match) return null;
  const amount = Number(match[1].replace(',', '.'));
  const factor = SIZE_UNIT_FACTOR[match[2].toLowerCase()];
  if (!Number.isFinite(amount) || factor === undefined) return null;
  return amount * factor;
}

/**
 * Sibling products along one axis. Both axes pivot on `baseName` because that is the
 * only thing tying otherwise unrelated database rows together.
 */
export function suggestionsFor(product: Product, catalog: Product[], axis: SuggestionAxis): Product[] {
  if (axis === 'flavor') {
    return catalog
      .filter((p) => p.id !== product.id && p.baseName === product.baseName && p.sizeLabel === product.sizeLabel)
      .sort((a, b) => (a.flavor ?? '').localeCompare(b.flavor ?? ''));
  }
  return catalog
    .filter((p) => p.id !== product.id && p.baseName === product.baseName && p.flavor === product.flavor)
    .sort((a, b) => {
      const rankA = sizeRank(a.sizeLabel);
      const rankB = sizeRank(b.sizeLabel);
      if (rankA !== null && rankB !== null) return rankA - rankB;
      return (a.sizeLabel ?? '').localeCompare(b.sizeLabel ?? '');
    });
}

/** Only the axes with siblings, so the sheet never shows an empty section. */
export function availableAxes(product: Product, catalog: Product[]): SuggestionAxis[] {
  return (['flavor', 'size'] as SuggestionAxis[]).filter(
    (axis) => suggestionsFor(product, catalog, axis).length > 0,
  );
}

/**
 * The single axis worth showing inline. Flavor wins when it has siblings because
 * `availableAxes` already orders it first — the remaining axes stay reachable through
 * the full list, so the sheet does not have to make the seller pick one up front.
 * Null means the product has no siblings at all.
 */
export function primaryAxis(product: Product, catalog: Product[]): SuggestionAxis | null {
  return availableAxes(product, catalog)[0] ?? null;
}
