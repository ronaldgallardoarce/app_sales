export type UnitCode = 'CAJA' | 'UNIDAD';

export interface ProductVariant {
  sku: string;
  flavor?: string;
  colorDot?: string;
  ice: number;
  priceUnidad: number;
  priceCaja: number;
  unitsPerCase: number;
  priceMin: number;
  priceMax: number;
  utilidadPct: number;
}

export interface Product {
  id: string;
  name: string;
  family: string;
  inStock: boolean;
  /**
   * How this product is packaged: the smallest sellable piece and the case that
   * holds it — e.g. "Botella" inside "Caja". Names vary per product, so the UI
   * shows these rather than the generic UNIDAD / CAJA codes.
   */
  minUnit?: string;
  maxUnit?: string;
  variants: ProductVariant[];
}

export interface Client {
  code: string;
  name: string;
}

/**
 * One unit type of one variant in the order. A product ordered by both case and
 * loose piece produces two lines — their prices are independent fields, so they
 * cannot be collapsed without losing the ability to reconstruct the subtotal.
 * The order panel groups them by `sku` to show a single row per product.
 *
 * Packaging and price data is copied onto the line on purpose: an order line is a
 * record of what was agreed, so a later catalog change must not rewrite it.
 */
export interface CartLine {
  id: string;
  productId: string;
  productName: string;
  flavor?: string;
  sku: string;
  unit: UnitCode;
  /**
   * Both packaging names, not just this line's own. A case-only line still has to
   * be able to state its total in minimum units ("2 Caja = 40 Bolsa"), which is
   * impossible if the line only knows the unit it was ordered in.
   */
  minUnitLabel: string;
  maxUnitLabel: string;
  qty: number;
  unitPrice: number;
  /** ICE tax per unit, for the order breakdown. */
  ice: number;
  /** Minimum units contained in one maximum unit, for the equivalence hint. */
  unitsPerCase: number;
}

export type CatalogTabKey = 'normales' | 'ultimos' | 'estrategia';
