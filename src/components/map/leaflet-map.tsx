import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { BlockPolygon, MapClient, VisitStatus } from '@/data/mock-clients';

/** Fallback center (La Paz, Bolivia) used when there are no markers to fit. */
const DEFAULT_CENTER = { lat: -16.4957, lng: -68.1335 };

type LatLng = { lat: number; lng: number };

type MapColors = {
  statusColors: Record<VisitStatus, string>;
  block: string;
  bounds: string;
  user: string;
  route: string;
};

function buildHtml(
  clients: MapClient[],
  polygons: BlockPolygon[],
  showBlocks: boolean,
  boundsPolygon: BlockPolygon,
  showBounds: boolean,
  userLocation: LatLng,
  order: Record<string, number>,
  routePath: BlockPolygon,
  colors: MapColors,
): string {
  const markers = clients.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, status: c.status }));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: transparent; }
    .leaflet-container { font-family: system-ui, sans-serif; }
    .pin-icon { background: transparent; border: none; }
    .locate-btn { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; background: #fff; cursor: pointer; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var CLIENTS = ${JSON.stringify(markers)};
    var POLYGONS = ${JSON.stringify(polygons)};
    var BOUNDS_POLY = ${JSON.stringify(boundsPolygon)};
    var ROUTE_PATH = ${JSON.stringify(routePath)};
    var ORDER = ${JSON.stringify(order)};
    var SHOW_BLOCKS = ${showBlocks ? 'true' : 'false'};
    var SHOW_BOUNDS = ${showBounds ? 'true' : 'false'};
    var STATUS_COLORS = ${JSON.stringify(colors.statusColors)};
    var BLOCK_COLOR = ${JSON.stringify(colors.block)};
    var BOUNDS_COLOR = ${JSON.stringify(colors.bounds)};
    var ROUTE_COLOR = ${JSON.stringify(colors.route)};
    var USER_COLOR = ${JSON.stringify(colors.user)};
    var USER = ${JSON.stringify(userLocation)};
    var DEFAULT = ${JSON.stringify(DEFAULT_CENTER)};

    var map = L.map('map', { zoomControl: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var bounds = [];

    if (SHOW_BLOCKS) {
      POLYGONS.forEach(function (poly) {
        L.polygon(poly, { color: BLOCK_COLOR, weight: 2, fillColor: BLOCK_COLOR, fillOpacity: 0.2 }).addTo(map);
        poly.forEach(function (corner) { bounds.push(corner); });
      });
    }

    if (SHOW_BOUNDS && BOUNDS_POLY.length > 2) {
      L.polygon(BOUNDS_POLY, {
        color: BOUNDS_COLOR,
        weight: 2.5,
        dashArray: '7,5',
        fillColor: BOUNDS_COLOR,
        fillOpacity: 0.15
      }).addTo(map);
      BOUNDS_POLY.forEach(function (corner) { bounds.push(corner); });
    }

    if (ROUTE_PATH.length > 1) {
      L.polyline(ROUTE_PATH, { color: ROUTE_COLOR, weight: 3, opacity: 0.8 }).addTo(map);
      ROUTE_PATH.forEach(function (corner) { bounds.push(corner); });
    }

    function pinIcon(color, label) {
      var center = label
        ? '<circle cx="14" cy="14" r="8.5" fill="#ffffff"/><text x="14" y="18" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="' + color + '">' + label + '</text>'
        : '<circle cx="14" cy="14" r="5.5" fill="#ffffff"/>';
      var svg = '<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">'
        + '<path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.27 21.73 0 14 0z" fill="' + color + '" stroke="#ffffff" stroke-width="2.5"/>'
        + center + '</svg>';
      return L.divIcon({
        html: svg,
        className: 'pin-icon',
        iconSize: [28, 38],
        iconAnchor: [14, 38],
        popupAnchor: [0, -34]
      });
    }

    CLIENTS.forEach(function (c) {
      var color = STATUS_COLORS[c.status] || '#888888';
      var label = ORDER[c.id] ? String(ORDER[c.id]) : '';
      var marker = L.marker([c.lat, c.lng], { icon: pinIcon(color, label) });
      marker.on('click', function () {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(c.id);
        }
      });
      marker.addTo(map);
      bounds.push([c.lat, c.lng]);
    });

    // Current location marker (mock seller position).
    L.circleMarker([USER.lat, USER.lng], {
      radius: 7,
      weight: 3,
      color: '#ffffff',
      fillColor: USER_COLOR,
      fillOpacity: 1
    }).addTo(map);

    // Recenter-on-current-location control (replaces zoom buttons).
    var LocateControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function () {
        var container = L.DomUtil.create('div', 'leaflet-bar');
        var link = L.DomUtil.create('a', 'locate-btn', container);
        link.href = '#';
        link.title = 'Mi ubicación';
        link.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + USER_COLOR + '" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>';
        L.DomEvent.on(link, 'click', function (e) {
          L.DomEvent.stop(e);
          map.setView([USER.lat, USER.lng], 16);
        });
        return container;
      }
    });
    map.addControl(new LocateControl());

    if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.25));
    } else {
      map.setView([USER.lat, USER.lng], 15);
    }
  </script>
</body>
</html>`;
}

export function LeafletMap({
  clients,
  polygons,
  showBlocks,
  boundsPolygon,
  showBounds,
  userLocation,
  order,
  routePath,
  colors,
  onSelect,
}: {
  clients: MapClient[];
  polygons: BlockPolygon[];
  showBlocks: boolean;
  boundsPolygon: BlockPolygon;
  showBounds: boolean;
  userLocation: LatLng;
  order: Record<string, number>;
  routePath: BlockPolygon;
  colors: MapColors;
  onSelect: (id: string) => void;
}) {
  const html = useMemo(
    () =>
      buildHtml(
        clients,
        polygons,
        showBlocks,
        boundsPolygon,
        showBounds,
        userLocation,
        order,
        routePath,
        colors,
      ),
    [clients, polygons, showBlocks, boundsPolygon, showBounds, userLocation, order, routePath, colors],
  );

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        onMessage={(event) => onSelect(event.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
