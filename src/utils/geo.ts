type Coord = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two coordinates, in kilometers (haversine). */
export function distanceKm(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

type LatLng = [number, number];

/**
 * Convex hull (Andrew's monotone chain) over a set of [lat, lng] points.
 * Longitude is treated as x, latitude as y. Returns the enclosing polygon.
 */
export function convexHull(points: LatLng[]): LatLng[] {
  if (points.length <= 3) return points;

  const pts = points
    .map(([lat, lng]) => ({ lat, lng }))
    .sort((a, b) => a.lng - b.lng || a.lat - b.lat);

  const cross = (o: typeof pts[0], a: typeof pts[0], b: typeof pts[0]) =>
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);

  const lower: typeof pts = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: typeof pts = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper).map((p) => [p.lat, p.lng] as LatLng);
}

/**
 * Greedy nearest-neighbor visit order starting from `start`.
 * A simple proximity heuristic — a real optimal route would weigh more parameters.
 */
export function nearestNeighborOrder<T extends { lat: number; lng: number }>(
  start: { lat: number; lng: number },
  points: T[],
): T[] {
  const remaining = [...points];
  const ordered: T[] = [];
  let current = { lat: start.lat, lng: start.lng };

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    remaining.forEach((point, index) => {
      const d = distanceKm(current, point);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = { lat: next.lat, lng: next.lng };
  }

  return ordered;
}
