import { isDateInputValid } from '@/components/ui/date-input-field';
import type { Product } from '@/types/catalog';
import type { ReturnDraft, ReturnLine } from '@/types/returns';

/** A blank line for a product just picked, ready for the form to fill in. */
export function newReturnLine(product: Product): ReturnLine {
  return {
    // The product code is not enough on its own — the same product can come back from two
    // different lots — so the moment of creation is what tells the two apart.
    key: `${product.id}-${Date.now()}`,
    productId: product.id,
    productName: product.name,
    minUnitLabel: product.minUnit,
    maxUnitLabel: product.maxUnit,
    unitsPerCase: product.unitsPerCase,
    // Both at zero: a seeded "1" is a number the seller did not enter, and on a record the
    // office reconciles against physical stock a quantity nobody typed is the wrong default.
    qtyMax: 0,
    qtyMin: 0,
    lotOrigin: null,
    lotNumber: '',
    expiryDate: '',
    observation: '',
    defectPhotos: [],
    lotPhotos: [],
  };
}

/** The line expressed in minimum units, so a case counts as its full content. */
export function returnMinUnits(line: ReturnLine): number {
  return line.qtyMax * line.unitsPerCase + line.qtyMin;
}

/** Human summary of both quantities, e.g. "2 Caja + 6 Sobre". */
export function returnQtyLabel(line: ReturnLine): string {
  const parts: string[] = [];
  if (line.qtyMax > 0) parts.push(`${line.qtyMax} ${line.maxUnitLabel}`);
  if (line.qtyMin > 0) parts.push(`${line.qtyMin} ${line.minUnitLabel}`);
  return parts.length > 0 ? parts.join(' + ') : 'Sin cantidad';
}

/**
 * What a line is still missing, named the way the field is labelled on the form.
 *
 * A list rather than a boolean, and phrased in the seller's words rather than the model's,
 * because this is shown on the card in the list: a return rejected by the office for a missing
 * lot photo costs a second trip to the client, so the gap has to be readable without opening
 * the line to hunt for it.
 *
 * The observation is deliberately absent: it is a note, and a line whose photos and lot are all
 * there says everything the office needs whether or not the seller had anything to add.
 */
export function missingOf(line: ReturnLine): string[] {
  const missing: string[] = [];
  if (returnMinUnits(line) === 0) missing.push('cantidad');
  if (!line.lotOrigin) missing.push('lote');
  if (line.lotNumber.trim().length === 0) missing.push('N° de lote');
  if (!isDateInputValid(line.expiryDate)) missing.push('vencimiento');
  if (line.defectPhotos.length === 0) missing.push('foto del fallo');
  if (line.lotPhotos.length === 0) missing.push('foto del lote');
  return missing;
}

/**
 * What the whole return is still missing, in the order the form asks for it.
 *
 * Says nothing about incomplete lines, and cannot: `ReturnLineSheet` refuses to save one that
 * is short of anything, so a line that reached the list is complete by construction. A check
 * for a state that cannot occur reads to the next person like a state that can.
 */
export function draftBlockers(draft: ReturnDraft): string[] {
  const blockers: string[] = [];
  if (!isDateInputValid(draft.replacementDate)) blockers.push('Falta la fecha probable de reposición.');
  if (draft.lines.length === 0) blockers.push('Agregá al menos un producto.');
  if (draft.justification.trim().length === 0) blockers.push('Falta la justificación de la devolución.');
  return blockers;
}
