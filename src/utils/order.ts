import type { CartLine } from '@/types/catalog';

/** One product in the order: its case and loose-unit lines shown together. */
export type OrderItem = {
  sku: string;
  productName: string;
  flavor?: string;
  lines: CartLine[];
  /** Sum of every line's amount — stays verifiable because each keeps its own price. */
  subtotal: number;
  /** ICE per minimum unit, taken from the variant. */
  ice: number;
  /** Item quantity in minimum units — a case counts as its full content. */
  minUnits: number;
};

/**
 * Group cart lines by variant so the same product reads as one row. Lines stay
 * separate underneath: case and loose piece have independent prices, and merging
 * them would leave a quantity that no longer explains the subtotal.
 */
export function groupIntoItems(lines: CartLine[]): OrderItem[] {
  const items = new Map<string, OrderItem>();
  for (const line of lines) {
    const item = items.get(line.sku) ?? {
      sku: line.sku,
      productName: line.productName,
      flavor: line.flavor,
      lines: [],
      subtotal: 0,
      ice: line.ice,
      minUnits: 0,
    };
    item.lines.push(line);
    item.subtotal += line.qty * line.unitPrice;
    item.minUnits += line.unit === 'CAJA' ? line.qty * line.unitsPerCase : line.qty;
    items.set(line.sku, item);
  }
  // Case before loose piece, so every row reads largest unit first.
  return Array.from(items.values()).map((item) => ({
    ...item,
    lines: [...item.lines].sort((a, b) => (a.unit === b.unit ? 0 : a.unit === 'CAJA' ? -1 : 1)),
  }));
}

/** ICE is charged per minimum unit, so a case line contributes its full content. */
export function iceTotalOf(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.minUnits * item.ice, 0);
}

/** Label for a line's unit, picked from the packaging names the line carries. */
export function unitLabelOf(line: CartLine): string {
  return line.unit === 'CAJA' ? line.maxUnitLabel : line.minUnitLabel;
}
