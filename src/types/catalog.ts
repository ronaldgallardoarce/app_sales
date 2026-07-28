export type UnitCode = 'CAJA' | 'UNIDAD';

export interface Product {
  /**
   * Numeric product code, the database identity and the code the seller reads out
   * loud. There is no second textual identifier: one product, one code.
   */
  id: number;
  /** Full commercial description, flavor included — this is what the DB stores. */
  name: string;
  family: string;
  /**
   * Name without flavor or size, e.g. "GELATINA". Not a database column: it is
   * derived so sibling products can be matched for suggestions.
   */
  baseName: string;
  /**
   * Flavor as it appears inside `name`. The database has no flavor attribute, so
   * two flavors of the same line are unrelated rows that only look alike.
   */
  flavor?: string;
  colorDot?: string;
  /** Size attribute, e.g. "250 gr" / "1 L". Real column, unlike flavor. */
  sizeLabel?: string;
  inStock: boolean;
  /** Smallest sellable piece and the case holding it — names vary per product. */
  minUnit: string;
  maxUnit: string;
  ice: number;
  priceUnidad: number;
  priceCaja: number;
  unitsPerCase: number;
  utilidadPct: number;
}

export interface Client {
  code: string;
  name: string;
}

/**
 * One product in the order, holding both quantities at once. A product ordered by
 * cases and by loose pieces is a single agreement, so splitting it into two rows
 * only forced the UI to glue it back together.
 *
 * Packaging and price data is copied onto the line on purpose: an order line is a
 * record of what was agreed, so a later catalog change must not rewrite it.
 */
export interface CartLine {
  /** The product code: one line per product, never one per unit type. */
  productId: number;
  productName: string;
  flavor?: string;
  sizeLabel?: string;
  minUnitLabel: string;
  maxUnitLabel: string;
  /** Quantity in maximum units (cases) and in minimum units (loose pieces). */
  qtyMax: number;
  qtyMin: number;
  /** Price per maximum unit and per minimum unit, frozen when the line was agreed. */
  unitPriceMax: number;
  unitPriceMin: number;
  ice: number;
  unitsPerCase: number;
}

export type CatalogTabKey = 'normales' | 'ultimos' | 'estrategia';
