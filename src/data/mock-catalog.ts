import { CartLine, Client, Product, ProductVariant } from '@/types/catalog';

export const mockClient: Client = {
  code: '631718',
  name: 'ADALIZ MAYTA HUANACO',
};

function makeVariant(
  sku: string,
  priceUnidad: number,
  unitsPerCase: number,
  opts: Partial<Pick<ProductVariant, 'flavor' | 'colorDot' | 'ice' | 'utilidadPct'>> = {},
): ProductVariant {
  const { flavor, colorDot, ice = 0, utilidadPct = 25 } = opts;
  return {
    sku,
    flavor,
    colorDot,
    ice,
    priceUnidad,
    priceCaja: Number((priceUnidad * unitsPerCase).toFixed(2)),
    unitsPerCase,
    priceMin: Number((priceUnidad * 0.82).toFixed(2)),
    priceMax: Number((priceUnidad * 2.6).toFixed(2)),
    utilidadPct,
  };
}

function single(
  id: string,
  name: string,
  family: string,
  sku: string,
  priceUnidad: number,
  unitsPerCase: number,
  opts: Partial<Pick<ProductVariant, 'ice' | 'utilidadPct'>> & {
    inStock?: boolean;
    minUnit?: string;
    maxUnit?: string;
  } = {},
): Product {
  const { inStock = true, minUnit, maxUnit, ...variantOpts } = opts;
  return {
    id,
    name,
    family,
    inStock,
    minUnit,
    maxUnit,
    variants: [makeVariant(sku, priceUnidad, unitsPerCase, variantOpts)],
  };
}

export const mockProducts: Product[] = [
  single('p-aceite-oliva', 'ACEITE DE OLIVA 500ML', 'ACEITES', 'AC-0142', 24.5, 12, { utilidadPct: 22, minUnit: 'Botella' }),
  single('p-arroz-extra', 'ARROZ EXTRA 1KG', 'ABARROTES', 'AR-0033', 8.5, 20, { utilidadPct: 18, minUnit: 'Bolsa' }),
  single('p-azucar-blanca', 'AZUCAR BLANCA 1KG', 'ABARROTES', 'AZ-0011', 7.2, 20, { utilidadPct: 15, minUnit: 'Bolsa' }),
  {
    id: 'p-bebida-energ',
    name: 'BEBIDA ENERGIZANTE 250ML',
    family: 'BEBIDAS',
    inStock: true,
    minUnit: 'Lata',
    variants: [
      makeVariant('BE-0087-OR', 6.0, 24, { flavor: 'Original', colorDot: '#3C8CE8', ice: 0.3, utilidadPct: 30 }),
      makeVariant('BE-0087-SA', 6.0, 24, { flavor: 'Sin Azúcar', colorDot: '#5FB4A2', ice: 0.3, utilidadPct: 30 }),
    ],
  },
  single('p-cafe-molido', 'CAFE MOLIDO 500G', 'CAFES', 'CF-0055', 32.0, 10, { utilidadPct: 28 }),
  single('p-detergente', 'DETERGENTE EN POLVO 1KG', 'LIMPIEZA', 'DT-0019', 14.9, 12, { utilidadPct: 20 }),
  single('p-fideo-spaghetti', 'FIDEO SPAGHETTI 500G', 'ABARROTES', 'FD-0027', 6.3, 20, { utilidadPct: 16 }),
  {
    id: 'p-galleta-dulce',
    name: 'GALLETA DULCE SURTIDA',
    family: 'GALLETAS',
    inStock: true,
    minUnit: 'Paquete',
    variants: [
      makeVariant('GL-0061-CH', 4.2, 12, { flavor: 'Chocolate', colorDot: '#6B4423', utilidadPct: 26 }),
      makeVariant('GL-0061-VA', 4.2, 12, { flavor: 'Vainilla', colorDot: '#E4D3A5', utilidadPct: 26 }),
      makeVariant('GL-0061-CO', 4.2, 12, { flavor: 'Coco', colorDot: '#F2F2E9', utilidadPct: 26 }),
    ],
  },
  {
    id: 'p-gelatina',
    name: 'GELATINA 85 G',
    family: 'GELATINAS',
    inStock: true,
    minUnit: 'Sobre',
    variants: [
      makeVariant('GE-0210-FR', 3.5, 12, { flavor: 'Frutilla', colorDot: '#E0526B', utilidadPct: 28 }),
      makeVariant('GE-0210-PI', 3.5, 12, { flavor: 'Piña', colorDot: '#E3B23C', utilidadPct: 28 }),
      makeVariant('GE-0210-NA', 3.5, 12, { flavor: 'Naranja', colorDot: '#E8813A', utilidadPct: 28 }),
      makeVariant('GE-0210-LI', 3.5, 12, { flavor: 'Limón', colorDot: '#B4C93A', utilidadPct: 28 }),
      makeVariant('GE-0210-CE', 3.5, 12, { flavor: 'Cereza', colorDot: '#B03052', utilidadPct: 28 }),
      makeVariant('GE-0210-UV', 3.5, 12, { flavor: 'Uva', colorDot: '#7B4FA0', utilidadPct: 28 }),
    ],
  },
  single('p-harina-trigo', 'HARINA DE TRIGO 1KG', 'ABARROTES', 'HR-0044', 6.8, 20, { utilidadPct: 15 }),
  single('p-jabon-lavavajilla', 'JABON LAVAVAJILLA 750ML', 'LIMPIEZA', 'JB-0072', 11.4, 12, { utilidadPct: 22 }),
  single('p-ketchup', 'KETCHUP 400G', 'CONDIMENTOS', 'KT-0018', 9.9, 12, { utilidadPct: 24 }),
  single('p-leche-entera', 'LECHE ENTERA 1L', 'LACTEOS', 'LE-0005', 7.9, 12, { utilidadPct: 17 }),
  single('p-mayonesa', 'MAYONESA 400G', 'CONDIMENTOS', 'MY-0021', 10.5, 12, { utilidadPct: 24 }),
  single('p-nuggets-pollo', 'NUGGETS DE POLLO 400G', 'CONGELADOS', 'NG-0090', 22.0, 10, { inStock: false, utilidadPct: 20 }),
  single('p-papel-higienico', 'PAPEL HIGIENICO X4', 'LIMPIEZA', 'PH-0002', 12.3, 12, { utilidadPct: 19 }),
  single('p-queso-crema', 'QUESO CREMA 200G', 'LACTEOS', 'QC-0058', 13.6, 12, { utilidadPct: 21 }),
  {
    id: 'p-refresco-polvo',
    name: 'REFRESCO EN POLVO 25G',
    family: 'BEBIDAS',
    inStock: true,
    minUnit: 'Sobre',
    variants: [
      makeVariant('RF-0301-FR', 1.5, 24, { flavor: 'Frutilla', colorDot: '#E0526B', utilidadPct: 32 }),
      makeVariant('RF-0301-PI', 1.5, 24, { flavor: 'Piña', colorDot: '#E3B23C', utilidadPct: 32 }),
      makeVariant('RF-0301-NA', 1.5, 24, { flavor: 'Naranja', colorDot: '#E8813A', utilidadPct: 32 }),
      makeVariant('RF-0301-LI', 1.5, 24, { flavor: 'Limón', colorDot: '#B4C93A', utilidadPct: 32 }),
      makeVariant('RF-0301-MA', 1.5, 24, { flavor: 'Maracuyá', colorDot: '#E8C93A', utilidadPct: 32 }),
      makeVariant('RF-0301-MO', 1.5, 24, { flavor: 'Mora', colorDot: '#5C3A6B', utilidadPct: 32 }),
      makeVariant('RF-0301-MZ', 1.5, 24, { flavor: 'Manzana', colorDot: '#7FAE4C', utilidadPct: 32 }),
      makeVariant('RF-0301-DU', 1.5, 24, { flavor: 'Durazno', colorDot: '#E8A15C', utilidadPct: 32 }),
    ],
  },
  single('p-sal-fina', 'SAL FINA 1KG', 'ABARROTES', 'SL-0009', 3.9, 20, { utilidadPct: 14 }),
  single('p-te-negro', 'TE NEGRO X25', 'CAFES', 'TE-0060', 8.4, 15, { utilidadPct: 26 }),
  single('p-uva-pasa', 'UVA PASA 200G', 'ABARROTES', 'UP-0037', 9.2, 15, { utilidadPct: 23 }),
  single('p-vinagre-blanco', 'VINAGRE BLANCO 500ML', 'CONDIMENTOS', 'VN-0014', 5.6, 12, { utilidadPct: 20 }),
  single('p-yogurt-natural', 'YOGURT NATURAL 1L', 'LACTEOS', 'YG-0029', 12.9, 12, { utilidadPct: 19 }),
];

const byId = new Map(mockProducts.map((p) => [p.id, p]));

export const ultimosVendidosIds = [
  'p-aceite-oliva',
  'p-arroz-extra',
  'p-azucar-blanca',
  'p-cafe-molido',
  'p-detergente',
  'p-gelatina',
  'p-leche-entera',
  'p-papel-higienico',
  'p-queso-crema',
  'p-te-negro',
  'p-yogurt-natural',
];

export const estrategiaIds = [
  'p-bebida-energ',
  'p-galleta-dulce',
  'p-gelatina',
  'p-harina-trigo',
  'p-jabon-lavavajilla',
  'p-ketchup',
  'p-mayonesa',
  'p-nuggets-pollo',
  'p-refresco-polvo',
  'p-sal-fina',
  'p-uva-pasa',
  'p-vinagre-blanco',
];

export const ultimosVendidosProducts = ultimosVendidosIds.map((id) => byId.get(id)!);
export const estrategiaProducts = estrategiaIds.map((id) => byId.get(id)!);

export const lastOrderLines: CartLine[] = [
  { id: 'AR-0033-CAJA', productId: 'p-arroz-extra', productName: 'ARROZ EXTRA 1KG', sku: 'AR-0033', unit: 'CAJA', minUnitLabel: 'Bolsa', maxUnitLabel: 'Caja', qty: 1, unitPrice: 170, ice: 0, unitsPerCase: 20 },
  { id: 'AR-0033-UNIDAD', productId: 'p-arroz-extra', productName: 'ARROZ EXTRA 1KG', sku: 'AR-0033', unit: 'UNIDAD', minUnitLabel: 'Bolsa', maxUnitLabel: 'Caja', qty: 4, unitPrice: 8.5, ice: 0, unitsPerCase: 20 },
  { id: 'LE-0005-CAJA', productId: 'p-leche-entera', productName: 'LECHE ENTERA 1L', sku: 'LE-0005', unit: 'CAJA', minUnitLabel: 'Botella', maxUnitLabel: 'Caja', qty: 2, unitPrice: 94.8, ice: 0, unitsPerCase: 12 },
  { id: 'GE-0210-FR-UNIDAD', productId: 'p-gelatina', productName: 'GELATINA 85 G', flavor: 'Frutilla', sku: 'GE-0210-FR', unit: 'UNIDAD', minUnitLabel: 'Sobre', maxUnitLabel: 'Caja', qty: 6, unitPrice: 3.5, ice: 0, unitsPerCase: 12 },
];
