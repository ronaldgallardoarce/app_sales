import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { BlockPolygon, MapClient, VisitStatus } from '@/data/mock-clients';

/** Fallback center (Santa Cruz de la Sierra, Bolivia) used when there are no markers to fit. */
const DEFAULT_CENTER = { lat: -17.7678, lng: -63.1771 };

type LatLng = { lat: number; lng: number };

type MapColors = {
  statusColors: Record<VisitStatus, string>;
  block: string;
  bounds: string;
  user: string;
  route: string;
  directions: string;
};

function buildHtml(
  clients: MapClient[],
  polygons: BlockPolygon[],
  showBlocks: boolean,
  boundsPolygon: BlockPolygon,
  showBounds: boolean,
  userLocation: LatLng,
  order: Record<string, number>,
  colors: MapColors,
  routeStart: LatLng | null,
  routeLegs: LatLng[][] | null,
  directionsLegs: LatLng[][] | null,
  pickMode: boolean,
): string {
  const markers = clients.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, status: c.status }));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
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
    var ORDER = ${JSON.stringify(order)};
    var SHOW_BLOCKS = ${showBlocks ? 'true' : 'false'};
    var SHOW_BOUNDS = ${showBounds ? 'true' : 'false'};
    var STATUS_COLORS = ${JSON.stringify(colors.statusColors)};
    var BLOCK_COLOR = ${JSON.stringify(colors.block)};
    var BOUNDS_COLOR = ${JSON.stringify(colors.bounds)};
    var USER_COLOR = ${JSON.stringify(colors.user)};
    var ROUTE_COLOR = ${JSON.stringify(colors.route)};
    var DIRECTIONS_COLOR = ${JSON.stringify(colors.directions)};
    var USER = ${JSON.stringify(userLocation)};
    var DEFAULT = ${JSON.stringify(DEFAULT_CENTER)};
    var ROUTE_START = ${JSON.stringify(routeStart)};
    var ROUTE_LEGS = ${JSON.stringify(routeLegs)};
    var DIRECTIONS_LEGS = ${JSON.stringify(directionsLegs)};
    var PICK_MODE = ${pickMode ? 'true' : 'false'};

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

    // Distinct badge (not a teardrop pin) for the chosen route start, so it never reads as a client.
    function startIcon(color) {
      var svg = '<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">'
        + '<circle cx="18" cy="18" r="16" fill="' + color + '" stroke="#ffffff" stroke-width="3"/>'
        + '<path d="M13 10v16M13 10l10 3.2-10 3.2" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
        + '</svg>';
      return L.divIcon({
        html: svg,
        className: 'pin-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
      });
    }

    // Groups nearby clients into a single bubble (Lucide-style outline "user" glyph
    // + count badge) at low zoom levels; tapping a cluster zooms in until its
    // clients separate into individual pins.
    var clusterIconSeq = 0;
    function clusterIcon(cluster) {
      clusterIconSeq += 1;
      var clipId = 'clusterClip' + clusterIconSeq;
      var count = cluster.getChildCount();
      // Avatar-circle radius, before adding canvas margin for the badge.
      var r = count < 10 ? 15 : count < 50 ? 18 : 21;
      var badgeR = Math.max(8, r * 0.5);
      // Canvas is bigger than the avatar circle so the badge (which sits on its
      // top-right rim) has room and never gets clipped by the icon's own bounds.
      var canvas = Math.ceil(2 * (r + badgeR) + 4);
      var c = canvas / 2;
      var badgeCx = c + r * 0.72;
      var badgeCy = c - r * 0.72;
      var badgeFontSize = count > 99 ? 8.5 : 10;
      var badgeLabel = count > 99 ? '99+' : String(count);
      var iconD = r * 1.15;

      // Lucide's "user" icon (ISC-licensed path data), reproduced inline as a
      // stroke-only outline glyph — no separate icon library to load for one icon.
      var svg = '<svg width="' + canvas + '" height="' + canvas + '" viewBox="0 0 ' + canvas + ' ' + canvas + '" xmlns="http://www.w3.org/2000/svg">'
        + '<defs><clipPath id="' + clipId + '"><circle cx="' + c + '" cy="' + c + '" r="' + r + '"/></clipPath></defs>'
        + '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="' + ROUTE_COLOR + '" stroke="#ffffff" stroke-width="2.5"/>'
        + '<g clip-path="url(#' + clipId + ')">'
        + '<svg x="' + (c - iconD / 2) + '" y="' + (c - iconD / 2) + '" width="' + iconD + '" height="' + iconD + '" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
        + '</svg>'
        + '</g>'
        + '<circle cx="' + badgeCx + '" cy="' + badgeCy + '" r="' + badgeR + '" fill="#ffffff" stroke="' + ROUTE_COLOR + '" stroke-width="1.5"/>'
        + '<text x="' + badgeCx + '" y="' + (badgeCy + badgeFontSize / 3) + '" text-anchor="middle" font-family="system-ui,sans-serif" font-size="' + badgeFontSize + '" font-weight="700" fill="' + ROUTE_COLOR + '">' + badgeLabel + '</text>'
        + '</svg>';
      return L.divIcon({ html: svg, className: 'pin-icon', iconSize: [canvas, canvas], iconAnchor: [c, c] });
    }

    // While a route is being followed, keep individual (numbered) pins visible
    // over a wider zoom range — clustering would otherwise hide stop numbers at
    // zoom levels where you'd normally still want to read them. Only cluster once
    // zoomed out to a genuinely distant view.
    var HAS_ROUTE = Object.keys(ORDER).length > 0;

    var clientCluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      // Radius big enough to also catch a formed cluster's own bubble (up to ~34px
      // radius with its count badge) overlapping a nearby lone pin — not just plain
      // pin-to-pin overlap (~14px half-width) — while still small enough that
      // clearly-separated pins stay ungrouped. A hard cutoff at street-level zoom
      // guarantees individual pins once there's real room to show them.
      maxClusterRadius: 50,
      disableClusteringAtZoom: HAS_ROUTE ? 15 : 18,
      iconCreateFunction: clusterIcon
    });

    CLIENTS.forEach(function (c) {
      var color = STATUS_COLORS[c.status] || '#888888';
      var label = ORDER[c.id] ? String(ORDER[c.id]) : '';
      var marker = L.marker([c.lat, c.lng], { icon: pinIcon(color, label) });
      marker.on('click', function () {
        if (!window.ReactNativeWebView) return;
        // While picking a route start point, tapping a client sets it as that
        // point instead of opening its info sheet (which is the normal behavior).
        if (PICK_MODE) {
          window.ReactNativeWebView.postMessage('pick:' + c.lat + ',' + c.lng);
        } else {
          window.ReactNativeWebView.postMessage(c.id);
        }
      });
      clientCluster.addLayer(marker);
      bounds.push([c.lat, c.lng]);
    });
    map.addLayer(clientCluster);

    // Current location marker (mock seller position).
    L.circleMarker([USER.lat, USER.lng], {
      radius: 7,
      weight: 3,
      color: '#ffffff',
      fillColor: USER_COLOR,
      fillOpacity: 1
    }).addTo(map);

    // Custom route start marker (chosen by the user on the map) — a distinct circular
    // badge with a flag glyph, so it never reads as a client teardrop pin.
    if (ROUTE_START) {
      L.marker([ROUTE_START.lat, ROUTE_START.lng], { icon: startIcon(ROUTE_COLOR) }).addTo(map);
      bounds.push([ROUTE_START.lat, ROUTE_START.lng]);
    }

    // Street-following routes are drawn one leg at a time (not as a single fused
    // polyline) so a street used twice — once each direction — reads as two distinct
    // lines instead of collapsing into one indistinguishable stroke.
    var OFFSET_METERS = 3.2;

    function offsetToTravelRight(points) {
      var out = [];
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var a = points[Math.max(0, i - 1)];
        var b = points[Math.min(points.length - 1, i + 1)];
        var dyM = (b.lat - a.lat) * 111320;
        var dxM = (b.lng - a.lng) * 111320 * Math.cos(p.lat * Math.PI / 180);
        var lenM = Math.sqrt(dxM * dxM + dyM * dyM) || 1;
        // Rotate the direction vector -90° (clockwise) to get the right-of-travel side.
        var rightXM = dyM / lenM;
        var rightYM = -dxM / lenM;
        var lat = p.lat + (rightYM * OFFSET_METERS) / 111320;
        var lng = p.lng + (rightXM * OFFSET_METERS) / (111320 * Math.cos(p.lat * Math.PI / 180));
        out.push({ lat: lat, lng: lng });
      }
      return out;
    }

    function bearingDeg(p1, p2) {
      var lat1 = p1.lat * Math.PI / 180, lat2 = p2.lat * Math.PI / 180;
      var dLng = (p2.lng - p1.lng) * Math.PI / 180;
      var y = Math.sin(dLng) * Math.cos(lat2);
      var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function arrowIcon(color, angleDeg) {
      var svg = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" '
        + 'style="transform: rotate(' + angleDeg + 'deg);">'
        + '<path d="M8 1 L14 14 L8 10.5 L2 14 Z" fill="' + color + '" stroke="#ffffff" stroke-width="1.2"/>'
        + '</svg>';
      return L.divIcon({ html: svg, className: 'pin-icon', iconSize: [16, 16], iconAnchor: [8, 8] });
    }

    function drawLegs(legs, color) {
      var pts = [];
      if (!legs) return pts;
      legs.forEach(function (leg) {
        if (!leg || leg.length < 2) return;
        var offset = offsetToTravelRight(leg);
        var latlngs = offset.map(function (p) { return [p.lat, p.lng]; });
        L.polyline(latlngs, {
          color: color,
          weight: 4,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
        offset.forEach(function (p) { pts.push([p.lat, p.lng]); });

        // One direction arrow at the midpoint of each leg, so the sense of travel
        // (and which way an out-and-back street was walked) is always readable.
        var midIdx = Math.max(0, Math.min(offset.length - 2, Math.floor(offset.length / 2)));
        var angle = bearingDeg(offset[midIdx], offset[midIdx + 1]);
        L.marker([offset[midIdx].lat, offset[midIdx].lng], {
          icon: arrowIcon(color, angle),
          interactive: false
        }).addTo(map);
      });
      return pts;
    }

    var routePoints = [];
    routePoints = routePoints.concat(drawLegs(ROUTE_LEGS, ROUTE_COLOR));
    routePoints = routePoints.concat(drawLegs(DIRECTIONS_LEGS, DIRECTIONS_COLOR));
    if (routePoints.length > 1) {
      map.fitBounds(L.latLngBounds(routePoints).pad(0.2));
    }

    // Tap-to-pick a custom route start point.
    map.on('click', function (e) {
      if (PICK_MODE && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('pick:' + e.latlng.lat + ',' + e.latlng.lng);
      }
    });

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
  colors,
  routeStart,
  routeLegs,
  directionsLegs,
  pickMode,
  onSelect,
  onPickPoint,
}: {
  clients: MapClient[];
  polygons: BlockPolygon[];
  showBlocks: boolean;
  boundsPolygon: BlockPolygon;
  showBounds: boolean;
  userLocation: LatLng;
  order: Record<string, number>;
  colors: MapColors;
  routeStart?: LatLng | null;
  routeLegs?: LatLng[][] | null;
  directionsLegs?: LatLng[][] | null;
  pickMode?: boolean;
  onSelect: (id: string) => void;
  onPickPoint?: (point: LatLng) => void;
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
        colors,
        routeStart ?? null,
        routeLegs ?? null,
        directionsLegs ?? null,
        pickMode ?? false,
      ),
    [
      clients,
      polygons,
      showBlocks,
      boundsPolygon,
      showBounds,
      userLocation,
      order,
      colors,
      routeStart,
      routeLegs,
      directionsLegs,
      pickMode,
    ],
  );

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        onMessage={(event) => {
          const data = event.nativeEvent.data;
          if (data.startsWith('pick:')) {
            const [lat, lng] = data.slice(5).split(',').map(Number);
            onPickPoint?.({ lat, lng });
            return;
          }
          onSelect(data);
        }}
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
