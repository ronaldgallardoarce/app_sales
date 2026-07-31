/** Where the returned stock was produced or brought in from, as printed on the case. */
export type LotOrigin = 'SC' | 'LP' | 'IMPORTADO' | 'S' | 'L';

/**
 * One product coming back, with the evidence that justifies it.
 *
 * Keyed by its own id and not by the product, unlike a cart line. The same product can come
 * back twice in one return — a case from an expired lot and a crushed one from a fresh lot —
 * and those are two different claims with two different lot numbers, two expiry dates and two
 * sets of photos. Merging them on the product code, the way the cart does, would force one of
 * the two lots to be thrown away.
 */
export interface ReturnLine {
  key: string;
  productId: number;
  productName: string;
  /** Copied from the catalog when the line was created — the same reason an order line copies it. */
  minUnitLabel: string;
  maxUnitLabel: string;
  unitsPerCase: number;
  /** Quantity in cases and in loose pieces, priced at nothing: a return moves stock, not money. */
  qtyMax: number;
  qtyMin: number;
  lotOrigin: LotOrigin | null;
  lotNumber: string;
  /** Masked `DD/MM/AAAA` as typed. A string and not a `Date` because a half-entered date is a
   *  normal state of the field — see `DateInputField`. Empty while unanswered. */
  expiryDate: string;
  observation: string;
  /** What is wrong with the product. */
  defectPhotos: string[];
  /** The lot code as printed on the packaging, so the office can verify the number typed above. */
  lotPhotos: string[];
}

/**
 * The whole return as the seller is filling it in.
 *
 * The justification sits here and not on each line because it answers a question about the
 * visit, not about a product: why this client is sending stock back at all. Per-product detail
 * is what the `observation` on each line is for.
 */
export interface ReturnDraft {
  /** When the seller expects to bring the replacement stock, masked `DD/MM/AAAA` as typed. */
  replacementDate: string;
  justification: string;
  lines: ReturnLine[];
}
