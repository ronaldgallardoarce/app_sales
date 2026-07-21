export type Seller = {
  name: string;
  code: string;
  zone: string;
  route: string;
  lastSync: string;
  /** Mock current location, used to compute distances to clients. */
  location: { lat: number; lng: number };
};

export const mockSeller: Seller = {
  name: 'Daniel Durán',
  code: 'VEN-0428',
  zone: 'Equipetrol · Santa Cruz de la Sierra',
  route: 'Ruta 12',
  lastSync: 'hace 2 h',
  location: { lat: -17.7683, lng: -63.1812 },
};
