/** Vivid, per-family accent colors used to give visual identity to product categories. */

type Scheme = 'light' | 'dark';

export const CategoryColors: Record<string, Record<Scheme, string>> = {
  ACEITES: { light: '#B08D1A', dark: '#D9B93D' },
  ABARROTES: { light: '#B5651D', dark: '#D98A46' },
  BEBIDAS: { light: '#2E6FD6', dark: '#6C9CF0' },
  CAFES: { light: '#7A4B27', dark: '#B98056' },
  LIMPIEZA: { light: '#0E93A6', dark: '#3FC4D8' },
  GALLETAS: { light: '#D68A2E', dark: '#F0AC5C' },
  GELATINAS: { light: '#C93E7A', dark: '#E8639E' },
  CONDIMENTOS: { light: '#CC5B2E', dark: '#F08A5C' },
  LACTEOS: { light: '#3FA8C9', dark: '#72CBE8' },
  CONGELADOS: { light: '#5B5FD1', dark: '#9295F0' },
};

/** Appends an alpha channel (2-digit hex) to a `#RRGGBB` color. */
export function withAlpha(hex: string, alphaHex: string) {
  return `${hex}${alphaHex}`;
}

export function getCategoryColor(family: string, scheme: Scheme, fallback: string) {
  return CategoryColors[family]?.[scheme] ?? fallback;
}

export function getCategorySoftColor(family: string, scheme: Scheme, fallback: string) {
  return withAlpha(getCategoryColor(family, scheme, fallback), scheme === 'dark' ? '2E' : '1C');
}
