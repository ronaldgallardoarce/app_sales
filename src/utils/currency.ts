/**
 * The bare figure — thousands separated, two decimals, no currency.
 *
 * For columns that already name their currency in the heading: repeating "Bs." on every row of a
 * table is noise the eye has to skip past to compare the numbers underneath it.
 */
export function formatAmount(amount: number): string {
  const fixed = amount.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withThousands},${decPart}`;
}

/** The figure with its currency, for anywhere a number stands on its own. */
export function formatBs(amount: number): string {
  return `Bs. ${formatAmount(amount)}`;
}
