import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  buildMiniMapHtml,
  MINI_MAP_HEIGHT,
  type LatLng,
  type MiniMapColors,
} from '@/components/map/mini-map-html';

/**
 * Web host for the check-in mini map. `react-native-webview` has no web build — it
 * resolves to the native component and renders nothing in a browser — so the same Leaflet
 * page goes into an iframe here. `srcDoc` keeps it self-contained, with no extra route to
 * serve the document from.
 */
export function MiniMap({
  userLocation,
  clientLocation,
  radiusM,
  colors,
}: {
  userLocation: LatLng;
  clientLocation: LatLng;
  radiusM: number;
  colors: MiniMapColors;
}) {
  const html = useMemo(
    () => buildMiniMapHtml(userLocation, clientLocation, radiusM, colors),
    [userLocation, clientLocation, radiusM, colors],
  );

  return (
    <View style={styles.container}>
      <iframe
        title="Ubicación del cliente"
        srcDoc={html}
        // Inline rather than a StyleSheet rule: this is a DOM node, so RNW's style
        // pipeline does not apply to it. The height is in pixels because `100%` here
        // resolves against a flex container, not the frame, and collapses to zero.
        style={{ width: '100%', height: MINI_MAP_HEIGHT, border: 'none', display: 'block' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: MINI_MAP_HEIGHT,
    overflow: 'hidden',
  },
});
