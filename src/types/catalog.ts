export type UnitCode = 'CAJA' | 'UNIDAD';

export interface ProductVariant {
  sku: string;
  flavor?: string;
  colorDot?: string;
  ice: number;
  priceUnidad: number;
  priceCaja: number;
  unitsPerCase: number;
  priceMin: number;
  priceMax: number;
  utilidadPct: number;
}

export interface Product {
  id: string;
  name: string;
  family: string;
  inStock: boolean;
  variants: ProductVariant[];
}

export interface Client {
  code: string;
  name: string;
}

export interface CartLine {
  id: string;
  productId: string;
  productName: string;
  flavor?: string;
  sku: string;
  unit: UnitCode;
  qty: number;
  unitPrice: number;
}

export type CatalogTabKey = 'normales' | 'ultimos' | 'estrategia';
