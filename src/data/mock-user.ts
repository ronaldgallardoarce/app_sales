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
  zone: 'Zona Sur · La Paz',
  route: 'Ruta 12',
  lastSync: 'hace 2 h',
  location: { lat: -16.4962, lng: -68.1376 },
};
