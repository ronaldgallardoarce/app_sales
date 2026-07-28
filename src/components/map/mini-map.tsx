import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import {
  buildMiniMapHtml,
  MINI_MAP_HEIGHT,
  type LatLng,
  type MiniMapColors,
} from '@/components/map/mini-map-html';

/**
 * Small interactive map showing the seller's position, the client's position and the
 * check-in radius between them. Pinch to zoom, drag to pan — no on-map controls.
 *
 * Native only. `react-native-webview` ships no web build, so a browser would render this
 * blank — `mini-map.web.tsx` hosts the same page in an iframe instead.
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
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        // The WebView must not scroll itself — Leaflet consumes the gestures. Android
        // additionally needs nested scrolling declared, or the parent ScrollView claims
        // every drag before the map ever sees it.
        scrollEnabled={false}
        nestedScrollEnabled
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: MINI_MAP_HEIGHT,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
