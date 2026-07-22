import { nearestNeighborOrder } from '@/utils/geo';

export type LatLng = { lat: number; lng: number };
export type TravelMode = 'walking' | 'motorcycle' | 'driving';

/**
 * Public OSRM demo servers. router.project-osrm.org only serves the driving
 * profile; the FOSSGIS mirror serves a dedicated foot profile. Both are free,
 * rate-limited demo instances — fine for prototyping, not for production load.
 *
 * There's no public motorcycle profile available, so `motorcycle` reuses the
 * driving profile: motorcycles follow the same road rules as cars (highways
 * allowed, not restricted to bike-only paths), which the "bike" profile would
 * get wrong — it's the closer approximation of the two.
 */
function osrmEndpoint(mode: TravelMode): { base: string; profile: string } {
  return mode === 'walking'
    ? { base: 'https://routing.openstreetmap.de/routed-foot', profile: 'foot' }
    : { base: 'https://router.project-osrm.org', profile: 'driving' };
}

function coordsParam(points: LatLng[]): string {
  return points.map((p) => `${p.lng},${p.lat}`).join(';');
}

/** Road-network distance matrix (meters) between every pair of `points`, via OSRM's table service. */
export async function fetchDistanceMatrix(
  points: LatLng[],
  mode: TravelMode,
): Promise<number[][] | null> {
  if (points.length < 2) return null;
  const { base, profile } = osrmEndpoint(mode);
  const url = `${base}/table/v1/${profile}/${coordsParam(points)}?annotations=distance`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.distances) ? (data.distances as number[][]) : null;
  } catch {
    return null;
  }
}

/** Street-level route geometry between two points, via OSRM's route service. */
async function fetchLegGeometry(from: LatLng, to: LatLng, mode: TravelMode): Promise<LatLng[] | null> {
  const { base, profile } = osrmEndpoint(mode);
  const url = `${base}/route/v1/${profile}/${coordsParam([from, to])}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return coords.map(([lng, lat]: [number, number]) => ({ lat, lng }));
  } catch {
    return null;
  }
}

/**
 * Street-level geometry for each leg of `waypoints`, in order (fetched as separate
 * requests, one per leg, so each can be drawn/decorated independently — otherwise an
 * out-and-back over the same street collapses into one indistinguishable line).
 * A leg that fails to resolve falls back to a straight line between its two endpoints.
 */
export async function fetchRouteLegs(
  waypoints: LatLng[],
  mode: TravelMode,
): Promise<{ coords: LatLng[]; isFallback: boolean }[]> {
  const legs = await Promise.all(
    waypoints.slice(0, -1).map((point, i) => fetchLegGeometry(point, waypoints[i + 1], mode)),
  );
  return legs.map((coords, i) =>
    coords ? { coords, isFallback: false } : { coords: [waypoints[i], waypoints[i + 1]], isFallback: true },
  );
}

/**
 * Greedy nearest-neighbor visit order using a real road-network distance matrix.
 * `matrix` index 0 is the origin; indices 1..n correspond 1:1 with `points`.
 */
export function nearestNeighborByMatrix<T>(matrix: number[][], points: T[]): T[] {
  const remaining = points.map((point, index) => ({ point, matrixIndex: index + 1 }));
  const ordered: T[] = [];
  let current = 0;

  while (remaining.length > 0) {
    let bestPos = 0;
    let bestDistance = Infinity;
    remaining.forEach((entry, pos) => {
      const d = matrix[current]?.[entry.matrixIndex];
      if (typeof d === 'number' && d < bestDistance) {
        bestDistance = d;
        bestPos = pos;
      }
    });
    const [next] = remaining.splice(bestPos, 1);
    ordered.push(next.point);
    current = next.matrixIndex;
  }

  return ordered;
}

/**
 * Resolves the real visiting order (by road-network distance, not straight-line proximity)
 * and the per-leg street-level geometry for it. Falls back to haversine nearest-neighbor
 * ordering, and straight lines per leg, when the routing service is unreachable.
 */
export async function resolveOptimalRoute<T extends LatLng>(
  origin: LatLng,
  clients: T[],
  mode: TravelMode,
): Promise<{ order: T[]; legs: LatLng[][]; usedRoadNetwork: boolean }> {
  if (clients.length === 0) {
    return { order: [], legs: [], usedRoadNetwork: true };
  }

  const points = [origin, ...clients.map((c) => ({ lat: c.lat, lng: c.lng }))];
  const matrix = await fetchDistanceMatrix(points, mode);
  const order = matrix ? nearestNeighborByMatrix(matrix, clients) : nearestNeighborOrder(origin, clients);

  const waypoints = [origin, ...order.map((c) => ({ lat: c.lat, lng: c.lng }))];
  const legs = await fetchRouteLegs(waypoints, mode);
  const usedRoadNetwork = matrix !== null && legs.every((leg) => !leg.isFallback);

  return { order, legs: legs.map((leg) => leg.coords), usedRoadNetwork };
}
