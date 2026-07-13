import type { GeoJSON } from "./types";

export type ChainageAnchor = { km: number; lon: number; lat: number };

type Line = number[][];

const SNAP_MAX_M = 60;

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371;
  const p = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * p) / 2) ** 2 +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(((lon2 - lon1) * p) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function parseChainageKm(name: string): number | null {
  const m = name.match(/^(\d+)\+(\d+)$/);
  if (!m) return null;
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 1000;
}

function collectLines(geojson?: GeoJSON): Line[] {
  if (!geojson) return [];
  const lines: Line[] = [];
  for (const f of geojson.features) {
    if (f.geometry.type !== "LineString") continue;
    const coords = f.geometry.coordinates as number[][];
    if (coords.length >= 2) lines.push(coords);
  }
  return lines;
}

/** Perpendicular distance (m) from a point to the nearest alignment segment. */
function distanceToLinesM(lon: number, lat: number, lines: Line[]): number {
  let best = Infinity;
  for (const c of lines) {
    for (let i = 0; i < c.length - 1; i++) {
      const x1 = c[i][0];
      const y1 = c[i][1];
      const x2 = c[i + 1][0];
      const y2 = c[i + 1][1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((lon - x1) * dx + (lat - y1) * dy) / len2));
      const d = haversineKm(lon, lat, x1 + t * dx, y1 + t * dy) * 1000;
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Chainage anchors taken directly from the KMZ chainage markers.
 * When a chainage has several markers, keep the one physically on the alignment
 * (nearest to the drawn line) so stray duplicates are ignored.
 */
export function buildChainageAnchors(geojson?: GeoJSON): ChainageAnchor[] {
  if (!geojson) return [];
  const lines = collectLines(geojson);

  const byKm = new Map<number, Array<[number, number]>>();
  for (const f of geojson.features) {
    if (f.geometry.type !== "Point") continue;
    const km = parseChainageKm(String(f.properties?.name ?? ""));
    if (km == null) continue;
    const key = Math.round(km * 1000) / 1000;
    const c = f.geometry.coordinates as number[];
    const arr = byKm.get(key);
    if (arr) arr.push([c[0], c[1]]);
    else byKm.set(key, [[c[0], c[1]]]);
  }

  const anchors: ChainageAnchor[] = [];
  for (const [km, pts] of byKm) {
    let bestLon = pts[0][0];
    let bestLat = pts[0][1];
    let bestD = distanceToLinesM(bestLon, bestLat, lines);
    for (let i = 1; i < pts.length; i++) {
      const d = distanceToLinesM(pts[i][0], pts[i][1], lines);
      if (d < bestD) {
        bestD = d;
        bestLon = pts[i][0];
        bestLat = pts[i][1];
      }
    }
    anchors.push({ km, lon: bestLon, lat: bestLat });
  }

  anchors.sort((a, b) => a.km - b.km);
  return anchors;
}

function lerp(a: ChainageAnchor, b: ChainageAnchor, t: number): [number, number] {
  return [a.lon + t * (b.lon - a.lon), a.lat + t * (b.lat - a.lat)];
}

/**
 * Resolve a chainage (km) to a coordinate using the real markers.
 * Exact marker → its own position. Otherwise linear interpolation between the two
 * nearest chainage markers (which are ~50-100 m apart and lie on the alignment).
 */
export function coordAtChainage(km: number, anchors: ChainageAnchor[]): [number, number] | null {
  if (!anchors.length) return null;

  if (km <= anchors[0].km) return [anchors[0].lon, anchors[0].lat];
  const last = anchors[anchors.length - 1];
  if (km >= last.km) return [last.lon, last.lat];

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (km >= a.km && km <= b.km) {
      if (b.km === a.km) return [a.lon, a.lat];
      return lerp(a, b, (km - a.km) / (b.km - a.km));
    }
  }

  return [last.lon, last.lat];
}

export function createChainageResolver(geojson?: GeoJSON) {
  const anchors = buildChainageAnchors(geojson);
  return (km: number) => coordAtChainage(km, anchors);
}

/**
 * Sample a polyline along the alignment between two chainages, returned as
 * Leaflet [lat, lon] pairs. Used to draw Schedule-B linear features
 * (elevated viaduct, service roads, drains, RE walls, ramps).
 */
export function sampleChainageRange(
  resolve: (km: number) => [number, number] | null,
  fromKm: number,
  toKm: number,
  stepKm = 0.05
): [number, number][] {
  const a = Math.min(fromKm, toKm);
  const b = Math.max(fromKm, toKm);
  const pts: [number, number][] = [];
  const push = (c: [number, number] | null) => {
    if (c) pts.push([c[1], c[0]]);
  };
  push(resolve(a));
  for (let km = a + stepKm; km < b - 1e-9; km += stepKm) push(resolve(km));
  push(resolve(b));
  return pts;
}

export function buildChainageIndex(geojson?: GeoJSON): Map<number, [number, number]> {
  const anchors = buildChainageAnchors(geojson);
  return new Map(anchors.map((a) => [a.km, [a.lon, a.lat]]));
}

export function chainageToCoord(
  chainageKm: number,
  index: Map<number, [number, number]>
): [number, number] | null {
  if (!index.size) return null;
  const anchors: ChainageAnchor[] = [...index.entries()]
    .map(([km, [lon, lat]]) => ({ km, lon, lat }))
    .sort((a, b) => a.km - b.km);
  return coordAtChainage(chainageKm, anchors);
}

export { SNAP_MAX_M };
