import type { Href } from 'expo-router';

import type { IconName } from '@/components/ui/icon';

export type MenuOption = {
  key: string;
  /** Spanish UI label */
  label: string;
  icon: IconName;
  colorToken: 'accent' | 'success' | 'accentAlt' | 'violet';
  softToken: 'accentSoft' | 'successSoft' | 'accentAltSoft' | 'violetSoft';
  route: Href;
};

export const menuOptions: MenuOption[] = [
  { key: 'map', label: 'Mapa de ruta', icon: 'map', colorToken: 'accent', softToken: 'accentSoft', route: '/map' as Href },
  { key: 'clients', label: 'Clientes', icon: 'person.2.fill', colorToken: 'violet', softToken: 'violetSoft', route: '/clients' as Href },
  { key: 'orders', label: 'Pedidos', icon: 'clipboard', colorToken: 'success', softToken: 'successSoft', route: '/orders' as Href },
  { key: 'client-form', label: 'Crear / editar cliente', icon: 'person.badge.plus', colorToken: 'accentAlt', softToken: 'accentAltSoft', route: '/client-form' as Href },
  { key: 'sales-progress', label: 'Avance de ventas', icon: 'chart.line.uptrend.xyaxis', colorToken: 'success', softToken: 'successSoft', route: '/sales-progress' as Href },
  { key: 'commission', label: 'Comisión ganada', icon: 'cash', colorToken: 'accentAlt', softToken: 'accentAltSoft', route: '/commission' as Href },
  { key: 'sync', label: 'Sincronizar', icon: 'sync', colorToken: 'accent', softToken: 'accentSoft', route: '/sync' as Href },
  { key: 'disabled-products', label: 'Productos deshabilitados', icon: 'shippingbox.slash', colorToken: 'violet', softToken: 'violetSoft', route: '/disabled-products' as Href },
  { key: 'support', label: 'Soporte', icon: 'lifebuoy', colorToken: 'accent', softToken: 'accentSoft', route: '/support' as Href },
];
