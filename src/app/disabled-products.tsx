import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function DisabledProductsScreen() {
  return (
    <PlaceholderScreen
      title="Productos deshabilitados"
      description="Productos sin stock o dados de baja temporalmente."
      icon="shippingbox.slash"
      colorToken="violet"
      softToken="violetSoft"
    />
  );
}
