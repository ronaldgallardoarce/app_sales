/**
 * Height of the mini map, shared by both hosts. An explicit pixel value on purpose: a
 * percentage height on the web iframe resolves against a flex container rather than the
 * frame, which collapses the map to nothing and leaves only Leaflet's corner attribution.
 */
export const MINI_MAP_HEIGHT = 150;

export type LatLng = { lat: number; lng: number };

export type MiniMapColors = {
  /** Current position dot. */
  user: string;
  /** Client teardrop pin. */
  client: string;
  /** Straight line joining the two, and the check-in radius ring. */
  link: string;
};

/**
 * Self-contained Leaflet page for the check-in mini map. Kept apart from the components
 * so the native (WebView) and web (iframe) hosts render byte-identical markup instead of
 * drifting into two maps that only look alike.
 */
export function buildMiniMapHtml(
  userLocation: LatLng,
  clientLocation: LatLng,
  radiusM: number,
  colors: MiniMapColors,
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    /* A fixed pixel height, not 100%: inside a frame whose own height is still settling,
       a percentage resolves against nothing and the tile area collapses. */
    html, body { margin: 0; padding: 0; background: transparent; }
    #map { height: ${MINI_MAP_HEIGHT}px; width: 100%; }
    .leaflet-container { font-family: system-ui, sans-serif; }
    .pin-icon { background: transparent; border: none; }
    /* Attribution stays (OSM tiles require it) but shrinks out of the way. */
    .leaflet-control-attribution { font-size: 8px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var USER = ${JSON.stringify(userLocation)};
    var CLIENT = ${JSON.stringify(clientLocation)};
    var RADIUS_M = ${JSON.stringify(radiusM)};
    var USER_COLOR = ${JSON.stringify(colors.user)};
    var CLIENT_COLOR = ${JSON.stringify(colors.client)};
    var LINK_COLOR = ${JSON.stringify(colors.link)};

    // Gestures only, no chrome: nothing is painted over a frame this small. Wheel zoom
    // stays off on purpose — over an embedded map the wheel belongs to the page scroll,
    // not to the map.
    var map = L.map('map', {
      zoomControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false
    });

    // A view before any layer is added. Leaflet defers layer setup until the map has a
    // center and zoom, so without this the tile layer sits queued and requests nothing.
    map.setView([CLIENT.lat, CLIENT.lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Check-in radius around the client, so "inside range" is something the seller can
    // see rather than only read in the banner below.
    var ring = L.circle([CLIENT.lat, CLIENT.lng], {
      radius: RADIUS_M,
      color: LINK_COLOR,
      weight: 1.5,
      dashArray: '5,4',
      fillColor: LINK_COLOR,
      fillOpacity: 0.08
    }).addTo(map);

    L.polyline([[USER.lat, USER.lng], [CLIENT.lat, CLIENT.lng]], {
      color: LINK_COLOR,
      weight: 2,
      opacity: 0.7,
      dashArray: '4,4'
    }).addTo(map);

    // Same teardrop as the full map screen, so a client pin looks like a client pin
    // wherever it appears.
    var pinSvg = '<svg width="24" height="33" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">'
      + '<path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.27 21.73 0 14 0z" fill="' + CLIENT_COLOR + '" stroke="#ffffff" stroke-width="2.5"/>'
      + '<circle cx="14" cy="14" r="5.5" fill="#ffffff"/></svg>';
    L.marker([CLIENT.lat, CLIENT.lng], {
      icon: L.divIcon({ html: pinSvg, className: 'pin-icon', iconSize: [24, 33], iconAnchor: [12, 33] }),
      interactive: false
    }).addTo(map);

    L.circleMarker([USER.lat, USER.lng], {
      radius: 6,
      weight: 3,
      color: '#ffffff',
      fillColor: USER_COLOR,
      fillOpacity: 1,
      interactive: false
    }).addTo(map);

    // Fitted to the ring rather than to the two points: framing only the points would
    // crop the radius whenever the seller is already standing inside it.
    var HOME_BOUNDS = ring.getBounds().extend([USER.lat, USER.lng]).pad(0.15);
    map.fitBounds(HOME_BOUNDS);

    // Leaflet measures the container on init. Inside a WebView or an iframe that can
    // happen before layout settles, leaving a map sized to nothing — a blank tile area.
    window.addEventListener('load', function () { map.invalidateSize(); });
    setTimeout(function () { map.invalidateSize(); }, 250);
    setTimeout(function () { map.invalidateSize(); }, 1000);
  </script>
</body>
</html>`;
}
