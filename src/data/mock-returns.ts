import type { SelectOption } from '@/components/ui/select';
import type { LotOrigin } from '@/types/returns';

/**
 * The lot origins printed on a case, offered exactly as the seller reads them off the box.
 *
 * Codes and no expanded meaning: these are warehouse shorthand the seller already knows, and a
 * wrong expansion under the code would be worse than none — it would teach the wrong thing to
 * whoever is new. Add a `meta` here once the office confirms what each one stands for.
 */
export const LOT_ORIGINS: SelectOption<LotOrigin>[] = [
  { value: 'SC', label: 'SC' },
  { value: 'LP', label: 'LP' },
  { value: 'IMPORTADO', label: 'IMPORTADO' },
  { value: 'S', label: 'S' },
  { value: 'L', label: 'L' },
];
