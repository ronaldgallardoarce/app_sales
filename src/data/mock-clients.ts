import type { ThemeColor } from '@/constants/theme';

/** Visit workflow state for a client on the seller's route. */
export type VisitStatus =
  | 'no-visitado'
  | 'iniciado'
  | 'trabajado'
  | 'cerrado-observado'
  | 'visitado';

/** Sales channel classification for a client. */
export type SalesChannel = 'horizontal' | 'tradicional' | 'panificacion';

export type MapClient = {
  id: string;
  code: string;
  name: string;
  owner: string;
  route: string;
  address: string;
  phone: string;
  /** Whether this client is scheduled to be visited today. */
  visitToday: boolean;
  status: VisitStatus;
  channel: SalesChannel;
  /** Pending balance in Bs. */
  balance: number;
  lastOrder: string;
  /** Real geo coordinates (Santa Cruz de la Sierra, Bolivia). */
  lat: number;
  lng: number;
};

export const mapClients: MapClient[] = [
  {
    id: 'c-631718',
    code: '631718',
    name: 'ADALIZ MAYTA HUANACO',
    owner: 'Adaliz Mayta',
    route: 'Ruta 12',
    address: 'Av. Cristo Redentor 1240',
    phone: '+591 700 12345',
    visitToday: true,
    status: 'visitado',
    channel: 'tradicional',
    balance: 0,
    lastOrder: 'hace 5 días',
    lat: -17.762,
    lng: -63.1898,
  },
  {
    id: 'c-540902',
    code: '540902',
    name: 'MERCADO CENTRAL ROSA',
    owner: 'Rosa Quispe',
    route: 'Ruta 12',
    address: 'Calle Ayacucho 88',
    phone: '+591 712 55890',
    visitToday: true,
    status: 'trabajado',
    channel: 'tradicional',
    balance: 320.5,
    lastOrder: 'hace 2 días',
    lat: -17.7682,
    lng: -63.1773,
  },
  {
    id: 'c-778112',
    code: '778112',
    name: 'TIENDA DON JULIO',
    owner: 'Julio Vargas',
    route: 'Ruta 12',
    address: 'Calle Junín 415',
    phone: '+591 733 20114',
    visitToday: true,
    status: 'iniciado',
    channel: 'horizontal',
    balance: 145.0,
    lastOrder: 'hace 8 días',
    lat: -17.7665,
    lng: -63.1808,
  },
  {
    id: 'c-901233',
    code: '901233',
    name: 'ABARROTES LA ESPERANZA',
    owner: 'María Condori',
    route: 'Ruta 12',
    address: 'Av. Alemana 902',
    phone: '+591 701 99120',
    visitToday: true,
    status: 'no-visitado',
    channel: 'tradicional',
    balance: 0,
    lastOrder: 'hace 1 día',
    lat: -17.7772,
    lng: -63.1727,
  },
  {
    id: 'c-334477',
    code: '334477',
    name: 'MINIMARKET SAN JORGE',
    owner: 'Jorge Ramos',
    route: 'Ruta 12',
    address: 'Calle Ñuflo de Chávez 73',
    phone: '+591 755 40023',
    visitToday: true,
    status: 'cerrado-observado',
    channel: 'horizontal',
    balance: 58.9,
    lastOrder: 'hace 12 días',
    lat: -17.768,
    lng: -63.1834,
  },
  {
    id: 'c-120945',
    code: '120945',
    name: 'PENSIÓN DOÑA CARMEN',
    owner: 'Carmen López',
    route: 'Ruta 12',
    address: 'Calle Independencia 210',
    phone: '+591 718 61200',
    visitToday: true,
    status: 'cerrado-observado',
    channel: 'panificacion',
    balance: 210.0,
    lastOrder: 'hace 3 días',
    lat: -17.7698,
    lng: -63.1817,
  },
  {
    id: 'c-662001',
    code: '662001',
    name: 'KIOSCO EL RÁPIDO',
    owner: 'Pedro Choque',
    route: 'Ruta 8',
    address: 'Av. Cañoto 55',
    phone: '+591 760 33019',
    visitToday: false,
    status: 'no-visitado',
    channel: 'tradicional',
    balance: 0,
    lastOrder: 'hace 20 días',
    lat: -17.7706,
    lng: -63.1741,
  },
  {
    id: 'c-445120',
    code: '445120',
    name: 'DISTRIBUIDORA NORTE',
    owner: 'Luis Mamani',
    route: 'Ruta 8',
    address: 'Calle Warnes 300',
    phone: '+591 705 88221',
    visitToday: false,
    status: 'visitado',
    channel: 'horizontal',
    balance: 890.0,
    lastOrder: 'hace 15 días',
    lat: -17.7669,
    lng: -63.1785,
  },
  {
    id: 'c-559087',
    code: '559087',
    name: 'BODEGA EQUIPETROL',
    owner: 'Ana Flores',
    route: 'Ruta 8',
    address: 'Av. Roca y Coronado 1420',
    phone: '+591 722 10455',
    visitToday: false,
    status: 'no-visitado',
    channel: 'panificacion',
    balance: 45.0,
    lastOrder: 'hace 30 días',
    lat: -17.7652,
    lng: -63.182,
  },
  {
    id: 'c-773340',
    code: '773340',
    name: 'TIENDA MI BARRIO',
    owner: 'Sofía Gutiérrez',
    route: 'Ruta 15',
    address: 'Av. Beni 610',
    phone: '+591 744 90312',
    visitToday: false,
    status: 'iniciado',
    channel: 'tradicional',
    balance: 0,
    lastOrder: 'hace 6 días',
    lat: -17.7649,
    lng: -63.1877,
  },
  {
    id: 'c-880021',
    code: '880021',
    name: 'PROVEEDORA EL SUR',
    owner: 'Marco Ticona',
    route: 'Ruta 15',
    address: 'Av. Banzer 78',
    phone: '+591 711 20933',
    visitToday: false,
    status: 'cerrado-observado',
    channel: 'horizontal',
    balance: 130.0,
    lastOrder: 'hace 9 días',
    lat: -17.7795,
    lng: -63.1704,
  },
  {
    id: 'c-990654',
    code: '990654',
    name: 'MARKET LA PLAZA',
    owner: 'Elena Apaza',
    route: 'Ruta 8',
    address: 'Plaza 24 de Septiembre 12',
    phone: '+591 766 44120',
    visitToday: false,
    status: 'cerrado-observado',
    channel: 'tradicional',
    balance: 76.4,
    lastOrder: 'hace 4 días',
    lat: -17.7667,
    lng: -63.1841,
  },
];

/** A city block polygon expressed as a list of [lat, lng] corners. */
export type BlockPolygon = [number, number][];

const BLOCK_HALF_LAT = 0.00035;
const BLOCK_HALF_LNG = 0.00042;

function block(lat: number, lng: number): BlockPolygon {
  return [
    [lat - BLOCK_HALF_LAT, lng - BLOCK_HALF_LNG],
    [lat - BLOCK_HALF_LAT, lng + BLOCK_HALF_LNG],
    [lat + BLOCK_HALF_LAT, lng + BLOCK_HALF_LNG],
    [lat + BLOCK_HALF_LAT, lng - BLOCK_HALF_LNG],
  ];
}

/**
 * Manzanos (city blocks) assigned to the seller's route(s).
 * Display-only: the seller can view them but cannot edit the selection.
 */
export const routeBlocks: BlockPolygon[] = [
  block(-17.7669, -63.1828),
  block(-17.7669, -63.1812),
  block(-17.7669, -63.1796),
  block(-17.7683, -63.1828),
  block(-17.7683, -63.1812),
  block(-17.7683, -63.1796),
  block(-17.7697, -63.1812),
  block(-17.7697, -63.1796),
];

/** Visual metadata for each visit status (theme color token keys). */
export const STATUS_META: Record<VisitStatus, { label: string; color: ThemeColor; soft: ThemeColor }> = {
  'no-visitado': { label: 'No visitado', color: 'textSecondary', soft: 'backgroundSelected' },
  iniciado: { label: 'Iniciado', color: 'accentAlt', soft: 'accentAltSoft' },
  trabajado: { label: 'Trabajado', color: 'violet', soft: 'violetSoft' },
  'cerrado-observado': { label: 'Cerrado / observado', color: 'danger', soft: 'dangerSoft' },
  visitado: { label: 'Visitado', color: 'success', soft: 'successSoft' },
};

/** Display order for status chips and the map legend. */
export const STATUS_ORDER: VisitStatus[] = [
  'no-visitado',
  'iniciado',
  'trabajado',
  'cerrado-observado',
  'visitado',
];

/** Display label for each sales channel. */
export const CHANNEL_META: Record<SalesChannel, { label: string }> = {
  horizontal: { label: 'Horizontal' },
  tradicional: { label: 'Tradicional' },
  panificacion: { label: 'Panificación' },
};

/** Display order for channel filter chips. */
export const CHANNEL_ORDER: SalesChannel[] = ['tradicional', 'horizontal', 'panificacion'];
