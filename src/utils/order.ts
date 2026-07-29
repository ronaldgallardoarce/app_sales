import type { CartLine } from '@/types/catalog';
import { formatBs } from '@/utils/currency';

/** Both quantities priced at their own rate — a case is not a multiple of a piece. */
export function lineAmount(line: CartLine): number {
  return line.qtyMax * line.unitPriceMax + line.qtyMin * line.unitPriceMin;
}

/** The line expressed in minimum units, so a case counts as its full content. */
export function lineMinUnits(line: CartLine): number {
  return line.qtyMax * line.unitsPerCase + line.qtyMin;
}

/**
 * What this line contributes in ICE. `line.ice` on its own is only the *rate per
 * minimum unit*, which is why it has to be multiplied out here — showing the bare
 * rate next to a line amount reads as the line's ICE and understates it by a
 * factor of the quantity.
 */
export function lineIce(line: CartLine): number {
  return lineMinUnits(line) * line.ice;
}

/** ICE is charged per minimum unit, so cases contribute what they contain. */
export function iceTotalOf(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineIce(line), 0);
}

/** Human summary of both quantities, e.g. "2 Caja + 6 Sobre". */
export function lineQtyLabel(line: CartLine): string {
  const parts: string[] = [];
  if (line.qtyMax > 0) parts.push(`${line.qtyMax} ${line.maxUnitLabel}`);
  if (line.qtyMin > 0) parts.push(`${line.qtyMin} ${line.minUnitLabel}`);
  return parts.join(' + ');
}

/**
 * Every ordered quantity with the price it was agreed at, on one line, e.g.
 * "2 Caja × Bs 120,00  ·  6 Sobre × Bs 12,00". Like `lineQtyLabel`, but priced —
 * that one labels a line where the rates are not in question.
 */
export function lineQtyDetail(line: CartLine): string {
  const parts: string[] = [];
  if (line.qtyMax > 0) parts.push(`${line.qtyMax} ${line.maxUnitLabel} × ${formatBs(line.unitPriceMax)}`);
  if (line.qtyMin > 0) parts.push(`${line.qtyMin} ${line.minUnitLabel} × ${formatBs(line.unitPriceMin)}`);
  return parts.join('  ·  ');
}
