import type { CartLine } from '@/types/catalog';

/** Both quantities priced at their own rate — a case is not a multiple of a piece. */
export function lineAmount(line: CartLine): number {
  return line.qtyMax * line.unitPriceMax + line.qtyMin * line.unitPriceMin;
}

/** The line expressed in minimum units, so a case counts as its full content. */
export function lineMinUnits(line: CartLine): number {
  return line.qtyMax * line.unitsPerCase + line.qtyMin;
}

/** ICE is charged per minimum unit, so cases contribute what they contain. */
export function iceTotalOf(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineMinUnits(line) * line.ice, 0);
}

/** Human summary of both quantities, e.g. "2 Caja + 6 Sobre". */
export function lineQtyLabel(line: CartLine): string {
  const parts: string[] = [];
  if (line.qtyMax > 0) parts.push(`${line.qtyMax} ${line.maxUnitLabel}`);
  if (line.qtyMin > 0) parts.push(`${line.qtyMin} ${line.minUnitLabel}`);
  return parts.join(' + ');
}
