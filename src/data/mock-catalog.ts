import { CartLine, Client, Product } from '@/types/catalog';

export const mockClient: Client = {
  code: '631718',
  name: 'ADALIZ MAYTA HUANACO',
};

/**
 * Flavor hues live in one place so the same flavor reads the same colour across
 * every product line — gelatina Frutilla and refresco Frutilla are unrelated rows,
 * but the seller still recognises them by the same cue.
 */
const FLAVOR_DOT: Record<string, string> = {
  Frutilla: '#E0526B',
  Piña: '#E3B23C',
  Naranja: '#E8813A',
  Limón: '#B4C93A',
  Cereza: '#B03052',
  Uva: '#7B4FA0',
  Maracuyá: '#E8C93A',
  Mora: '#5C3A6B',
  Manzana: '#7FAE4C',
  Durazno: '#E8A15C',
  Chocolate: '#6B4423',
  Vainilla: '#E4D3A5',
  Coco: '#F2F2E9',
  Original: '#3C8CE8',
  'Sin Azúcar': '#5FB4A2',
};

function product(opts: {
  id: number;
  baseName: string;
  family: string;
  sizeLabel: string;
  minUnit: string;
  priceUnidad: number;
  unitsPerCase: number;
  maxUnit?: string;
  flavor?: string;
  ice?: number;
  utilidadPct?: number;
  inStock?: boolean;
}): Product {
  const { maxUnit = 'Caja', ice = 0, utilidadPct = 25, inStock = true, flavor, ...rest } = opts;
  return {
    ...rest,
    flavor,
    colorDot: flavor ? FLAVOR_DOT[flavor] : undefined,
    maxUnit,
    ice,
    utilidadPct,
    inStock,
    // The description is assembled from the parts instead of the parts being parsed
    // back out of it: the database stores only this string, and guessing where the
    // flavor ends is exactly the mistake this model avoids.
    name: `${opts.baseName}${flavor ? ` ${flavor}` : ''} ${opts.sizeLabel}`.toUpperCase(),
    priceCaja: Number((opts.priceUnidad * opts.unitsPerCase).toFixed(2)),
  };
}

/**
 * Codes are grouped by product line — 1xxxx singles, 2xxxx gelatina, 3xxxx refresco,
 * 4xxxx jugo, 5xxxx galleta, 6xxxx energizante — and within a line the middle digits
 * are the size and the last the flavor. The database only requires uniqueness; the
 * grouping is here so a human can still scan the list.
 */
export const mockProducts: Product[] = [
  // Single-row products: no sibling shares their baseName, so they have no suggestions.
  product({ id: 10010, baseName: 'Aceite de Oliva', family: 'ACEITES', sizeLabel: '500 ml', minUnit: 'Botella', priceUnidad: 24.5, unitsPerCase: 12, utilidadPct: 22 }),
  product({ id: 10020, baseName: 'Arroz Extra', family: 'ABARROTES', sizeLabel: '1 kg', minUnit: 'Bolsa', priceUnidad: 8.5, unitsPerCase: 20, utilidadPct: 18 }),
  product({ id: 10030, baseName: 'Azucar Blanca', family: 'ABARROTES', sizeLabel: '1 kg', minUnit: 'Bolsa', priceUnidad: 7.2, unitsPerCase: 20, utilidadPct: 15 }),
  product({ id: 10040, baseName: 'Cafe Molido', family: 'CAFES', sizeLabel: '500 gr', minUnit: 'Paquete', priceUnidad: 32.0, unitsPerCase: 10, utilidadPct: 28 }),
  product({ id: 10050, baseName: 'Detergente en Polvo', family: 'LIMPIEZA', sizeLabel: '1 kg', minUnit: 'Bolsa', priceUnidad: 14.9, unitsPerCase: 12, utilidadPct: 20 }),
  product({ id: 10060, baseName: 'Fideo Spaghetti', family: 'ABARROTES', sizeLabel: '500 gr', minUnit: 'Paquete', priceUnidad: 6.3, unitsPerCase: 20, utilidadPct: 16 }),
  product({ id: 10070, baseName: 'Harina de Trigo', family: 'ABARROTES', sizeLabel: '1 kg', minUnit: 'Bolsa', priceUnidad: 6.8, unitsPerCase: 20, utilidadPct: 15 }),
  product({ id: 10080, baseName: 'Jabon Lavavajilla', family: 'LIMPIEZA', sizeLabel: '750 ml', minUnit: 'Botella', priceUnidad: 11.4, unitsPerCase: 12, utilidadPct: 22 }),
  product({ id: 10090, baseName: 'Ketchup', family: 'CONDIMENTOS', sizeLabel: '400 gr', minUnit: 'Frasco', priceUnidad: 9.9, unitsPerCase: 12, utilidadPct: 24 }),
  product({ id: 10100, baseName: 'Leche Entera', family: 'LACTEOS', sizeLabel: '1 L', minUnit: 'Botella', priceUnidad: 7.9, unitsPerCase: 12, utilidadPct: 17 }),
  product({ id: 10110, baseName: 'Mayonesa', family: 'CONDIMENTOS', sizeLabel: '400 gr', minUnit: 'Frasco', priceUnidad: 10.5, unitsPerCase: 12, utilidadPct: 24 }),
  product({ id: 10120, baseName: 'Nuggets de Pollo', family: 'CONGELADOS', sizeLabel: '400 gr', minUnit: 'Paquete', priceUnidad: 22.0, unitsPerCase: 10, utilidadPct: 20, inStock: false }),
  product({ id: 10130, baseName: 'Papel Higienico', family: 'LIMPIEZA', sizeLabel: 'x4', minUnit: 'Paquete', priceUnidad: 12.3, unitsPerCase: 12, utilidadPct: 19 }),
  product({ id: 10140, baseName: 'Queso Crema', family: 'LACTEOS', sizeLabel: '200 gr', minUnit: 'Pote', priceUnidad: 13.6, unitsPerCase: 12, utilidadPct: 21 }),
  product({ id: 10150, baseName: 'Sal Fina', family: 'ABARROTES', sizeLabel: '1 kg', minUnit: 'Bolsa', priceUnidad: 3.9, unitsPerCase: 20, utilidadPct: 14 }),
  product({ id: 10160, baseName: 'Te Negro', family: 'CAFES', sizeLabel: 'x25', minUnit: 'Estuche', priceUnidad: 8.4, unitsPerCase: 15, utilidadPct: 26 }),
  product({ id: 10170, baseName: 'Uva Pasa', family: 'ABARROTES', sizeLabel: '200 gr', minUnit: 'Bolsa', priceUnidad: 9.2, unitsPerCase: 15, utilidadPct: 23 }),
  product({ id: 10180, baseName: 'Vinagre Blanco', family: 'CONDIMENTOS', sizeLabel: '500 ml', minUnit: 'Botella', priceUnidad: 5.6, unitsPerCase: 12, utilidadPct: 20 }),
  product({ id: 10190, baseName: 'Yogurt Natural', family: 'LACTEOS', sizeLabel: '1 L', minUnit: 'Botella', priceUnidad: 12.9, unitsPerCase: 12, utilidadPct: 19 }),

  // GELATINA — six flavors at 85 gr, four at 250 gr, two at 500 gr. The matrix is
  // deliberately ragged: a real catalog does not carry every flavor in every size.
  product({ id: 20101, baseName: 'Gelatina', flavor: 'Frutilla', family: 'GELATINAS', sizeLabel: '85 gr', minUnit: 'Sobre', priceUnidad: 3.5, unitsPerCase: 12, utilidadPct: 28 }),
  product({ id: 20102, baseName: 'Gelatina', flavor: 'Piña', family: 'GELATINAS', sizeLabel: '85 gr', minUnit: 'Sobre', priceUnidad: 3.5, unitsPerCase: 12, utilidadPct: 28 }),
  product({ id: 20103, baseName: 'Gelatina', flavor: 'Naranja', family: 'GELATINAS', sizeLabel: '85 gr', minUnit: 'Sobre', priceUnidad: 3.5, unitsPerCase: 12, utilidadPct: 28 }),
  product({ id: 20104, baseName: 'Gelatina', flavor: 'Limón', family: 'GELATINAS', sizeLabel: '85 gr', minUnit: 'Sobre', priceUnidad: 3.5, unitsPerCase: 12, utilidadPct: 28 }),
  product({ id: 20105, baseName: 'Gelatina', flavor: 'Cereza', family: 'GELATINAS', sizeLabel: '85 gr', minUnit: 'Sobre', priceUnidad: 3.5, unitsPerCase: 12, utilidadPct: 28 }),
  product({ id: 20106, baseName: 'Gelatina', flavor: 'Uva', family: 'GELATINAS', sizeLabel: '85 gr', minUnit: 'Sobre', priceUnidad: 3.5, unitsPerCase: 12, utilidadPct: 28 }),
  product({ id: 20201, baseName: 'Gelatina', flavor: 'Frutilla', family: 'GELATINAS', sizeLabel: '250 gr', minUnit: 'Sobre', priceUnidad: 8.9, unitsPerCase: 12, utilidadPct: 28 }),
  product({ id: 20202, baseName: 'Gelatina', flavor: 'Piña', family: 'GELATINAS', sizeLabel: '250 gr', minUnit: 'Sobre', priceUnidad: 8.9, unitsPerCase: 12, utilidadPct: 28 }),
  product({ id: 20203, baseName: 'Gelatina', flavor: 'Naranja', family: 'GELATINAS', sizeLabel: '250 gr', minUnit: 'Sobre', priceUnidad: 8.9, unitsPerCase: 12, utilidadPct: 28 }),
  product({ id: 20204, baseName: 'Gelatina', flavor: 'Limón', family: 'GELATINAS', sizeLabel: '250 gr', minUnit: 'Sobre', priceUnidad: 8.9, unitsPerCase: 12, utilidadPct: 28 }),
  product({ id: 20301, baseName: 'Gelatina', flavor: 'Frutilla', family: 'GELATINAS', sizeLabel: '500 gr', minUnit: 'Sobre', priceUnidad: 16.5, unitsPerCase: 6, utilidadPct: 28 }),
  product({ id: 20303, baseName: 'Gelatina', flavor: 'Naranja', family: 'GELATINAS', sizeLabel: '500 gr', minUnit: 'Sobre', priceUnidad: 16.5, unitsPerCase: 6, utilidadPct: 28 }),

  // REFRESCO EN POLVO — the widest flavor axis in the catalog.
  product({ id: 30101, baseName: 'Refresco en Polvo', flavor: 'Frutilla', family: 'BEBIDAS', sizeLabel: '25 gr', minUnit: 'Sobre', priceUnidad: 1.5, unitsPerCase: 24, utilidadPct: 32 }),
  product({ id: 30102, baseName: 'Refresco en Polvo', flavor: 'Piña', family: 'BEBIDAS', sizeLabel: '25 gr', minUnit: 'Sobre', priceUnidad: 1.5, unitsPerCase: 24, utilidadPct: 32 }),
  product({ id: 30103, baseName: 'Refresco en Polvo', flavor: 'Naranja', family: 'BEBIDAS', sizeLabel: '25 gr', minUnit: 'Sobre', priceUnidad: 1.5, unitsPerCase: 24, utilidadPct: 32 }),
  product({ id: 30104, baseName: 'Refresco en Polvo', flavor: 'Limón', family: 'BEBIDAS', sizeLabel: '25 gr', minUnit: 'Sobre', priceUnidad: 1.5, unitsPerCase: 24, utilidadPct: 32 }),
  product({ id: 30105, baseName: 'Refresco en Polvo', flavor: 'Maracuyá', family: 'BEBIDAS', sizeLabel: '25 gr', minUnit: 'Sobre', priceUnidad: 1.5, unitsPerCase: 24, utilidadPct: 32 }),
  product({ id: 30106, baseName: 'Refresco en Polvo', flavor: 'Mora', family: 'BEBIDAS', sizeLabel: '25 gr', minUnit: 'Sobre', priceUnidad: 1.5, unitsPerCase: 24, utilidadPct: 32 }),
  product({ id: 30107, baseName: 'Refresco en Polvo', flavor: 'Manzana', family: 'BEBIDAS', sizeLabel: '25 gr', minUnit: 'Sobre', priceUnidad: 1.5, unitsPerCase: 24, utilidadPct: 32 }),
  product({ id: 30108, baseName: 'Refresco en Polvo', flavor: 'Durazno', family: 'BEBIDAS', sizeLabel: '25 gr', minUnit: 'Sobre', priceUnidad: 1.5, unitsPerCase: 24, utilidadPct: 32 }),
  product({ id: 30201, baseName: 'Refresco en Polvo', flavor: 'Frutilla', family: 'BEBIDAS', sizeLabel: '50 gr', minUnit: 'Sobre', priceUnidad: 2.8, unitsPerCase: 24, utilidadPct: 32 }),
  product({ id: 30203, baseName: 'Refresco en Polvo', flavor: 'Naranja', family: 'BEBIDAS', sizeLabel: '50 gr', minUnit: 'Sobre', priceUnidad: 2.8, unitsPerCase: 24, utilidadPct: 32 }),
  product({ id: 30204, baseName: 'Refresco en Polvo', flavor: 'Limón', family: 'BEBIDAS', sizeLabel: '50 gr', minUnit: 'Sobre', priceUnidad: 2.8, unitsPerCase: 24, utilidadPct: 32 }),

  // JUGO — millilitres and litres in the same line, which is why the size axis is
  // labelled "Presentación" and not "Peso".
  product({ id: 40101, baseName: 'Jugo', flavor: 'Naranja', family: 'BEBIDAS', sizeLabel: '300 ml', minUnit: 'Botella', priceUnidad: 4.5, unitsPerCase: 12, utilidadPct: 24 }),
  product({ id: 40102, baseName: 'Jugo', flavor: 'Durazno', family: 'BEBIDAS', sizeLabel: '300 ml', minUnit: 'Botella', priceUnidad: 4.5, unitsPerCase: 12, utilidadPct: 24 }),
  product({ id: 40103, baseName: 'Jugo', flavor: 'Manzana', family: 'BEBIDAS', sizeLabel: '300 ml', minUnit: 'Botella', priceUnidad: 4.5, unitsPerCase: 12, utilidadPct: 24 }),
  product({ id: 40201, baseName: 'Jugo', flavor: 'Naranja', family: 'BEBIDAS', sizeLabel: '1 L', minUnit: 'Botella', priceUnidad: 11.9, unitsPerCase: 12, utilidadPct: 24 }),
  product({ id: 40202, baseName: 'Jugo', flavor: 'Durazno', family: 'BEBIDAS', sizeLabel: '1 L', minUnit: 'Botella', priceUnidad: 11.9, unitsPerCase: 12, utilidadPct: 24 }),
  product({ id: 40203, baseName: 'Jugo', flavor: 'Manzana', family: 'BEBIDAS', sizeLabel: '1 L', minUnit: 'Botella', priceUnidad: 11.9, unitsPerCase: 12, utilidadPct: 24 }),
  product({ id: 40301, baseName: 'Jugo', flavor: 'Naranja', family: 'BEBIDAS', sizeLabel: '2 L', minUnit: 'Botella', priceUnidad: 21.5, unitsPerCase: 6, utilidadPct: 24 }),

  // GALLETA DULCE
  product({ id: 50101, baseName: 'Galleta Dulce', flavor: 'Chocolate', family: 'GALLETAS', sizeLabel: '120 gr', minUnit: 'Paquete', priceUnidad: 4.2, unitsPerCase: 12, utilidadPct: 26 }),
  product({ id: 50102, baseName: 'Galleta Dulce', flavor: 'Vainilla', family: 'GALLETAS', sizeLabel: '120 gr', minUnit: 'Paquete', priceUnidad: 4.2, unitsPerCase: 12, utilidadPct: 26 }),
  product({ id: 50103, baseName: 'Galleta Dulce', flavor: 'Coco', family: 'GALLETAS', sizeLabel: '120 gr', minUnit: 'Paquete', priceUnidad: 4.2, unitsPerCase: 12, utilidadPct: 26 }),
  product({ id: 50201, baseName: 'Galleta Dulce', flavor: 'Chocolate', family: 'GALLETAS', sizeLabel: '300 gr', minUnit: 'Paquete', priceUnidad: 9.5, unitsPerCase: 12, utilidadPct: 26 }),
  product({ id: 50202, baseName: 'Galleta Dulce', flavor: 'Vainilla', family: 'GALLETAS', sizeLabel: '300 gr', minUnit: 'Paquete', priceUnidad: 9.5, unitsPerCase: 12, utilidadPct: 26 }),

  // BEBIDA ENERGIZANTE — the only line carrying ICE.
  product({ id: 60101, baseName: 'Bebida Energizante', flavor: 'Original', family: 'BEBIDAS', sizeLabel: '250 ml', minUnit: 'Lata', priceUnidad: 6.0, unitsPerCase: 24, ice: 0.3, utilidadPct: 30 }),
  product({ id: 60102, baseName: 'Bebida Energizante', flavor: 'Sin Azúcar', family: 'BEBIDAS', sizeLabel: '250 ml', minUnit: 'Lata', priceUnidad: 6.0, unitsPerCase: 24, ice: 0.3, utilidadPct: 30 }),
  product({ id: 60201, baseName: 'Bebida Energizante', flavor: 'Original', family: 'BEBIDAS', sizeLabel: '473 ml', minUnit: 'Lata', priceUnidad: 10.5, unitsPerCase: 12, ice: 0.3, utilidadPct: 30 }),
];

const byId = new Map(mockProducts.map((p) => [p.id, p]));

export const ultimosVendidosIds = [
  10010, // Aceite de Oliva
  10020, // Arroz Extra
  10030, // Azucar Blanca
  10040, // Cafe Molido
  10050, // Detergente en Polvo
  20101, // Gelatina Frutilla 85 gr
  40201, // Jugo Naranja 1 L
  10100, // Leche Entera
  10130, // Papel Higienico
  10140, // Queso Crema
  10160, // Te Negro
  10190, // Yogurt Natural
];

export const estrategiaIds = [
  60101, // Bebida Energizante Original 250 ml
  50101, // Galleta Dulce Chocolate 120 gr
  20203, // Gelatina Naranja 250 gr
  10070, // Harina de Trigo
  10080, // Jabon Lavavajilla
  40102, // Jugo Durazno 300 ml
  10090, // Ketchup
  10110, // Mayonesa
  10120, // Nuggets de Pollo
  30101, // Refresco en Polvo Frutilla 25 gr
  10150, // Sal Fina
  10170, // Uva Pasa
  10180, // Vinagre Blanco
];

export const ultimosVendidosProducts = ultimosVendidosIds.map((id) => byId.get(id)!);
export const estrategiaProducts = estrategiaIds.map((id) => byId.get(id)!);

export const lastOrderLines: CartLine[] = [
  { productId: 10020, productName: 'ARROZ EXTRA 1 KG', sizeLabel: '1 kg', minUnitLabel: 'Bolsa', maxUnitLabel: 'Caja', qtyMax: 1, qtyMin: 4, unitPriceMax: 170, unitPriceMin: 8.5, ice: 0, unitsPerCase: 20 },
  { productId: 10100, productName: 'LECHE ENTERA 1 L', sizeLabel: '1 L', minUnitLabel: 'Botella', maxUnitLabel: 'Caja', qtyMax: 2, qtyMin: 0, unitPriceMax: 94.8, unitPriceMin: 7.9, ice: 0, unitsPerCase: 12 },
  { productId: 20101, productName: 'GELATINA FRUTILLA 85 GR', flavor: 'Frutilla', sizeLabel: '85 gr', minUnitLabel: 'Sobre', maxUnitLabel: 'Caja', qtyMax: 0, qtyMin: 6, unitPriceMax: 42, unitPriceMin: 3.5, ice: 0, unitsPerCase: 12 },
];
