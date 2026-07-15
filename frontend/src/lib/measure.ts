/** Map measurement helpers (distance, area, bearing, offset, chainage, elevation Δ). */

export type MeasureTool = "distance" | "area" | "bearing" | "elev";

export type LatLon = [number, number]; // [lat, lon]

const R_KM = 6371;
const R_M = 6_371_000;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(a));
}

export function pathLengthKm(pts: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += haversineKm(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }
  return total;
}

/** Geodesic bearing from A → B in degrees [0, 360). */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Spherical polygon area (m²) via Girard's theorem / spherical excess.
 * Path need not be closed; first point is implied closed.
 */
export function polygonAreaM2(pts: LatLon[]): number {
  if (pts.length < 3) return 0;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [lat1, lon1] = pts[i];
    const [lat2, lon2] = pts[(i + 1) % n];
    total += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * R_M * R_M) / 2);
}

export type NearestOnLine = {
  lat: number;
  lon: number;
  distM: number;
  /** Distance along polyline from start (km). */
  alongKm: number;
  segmentIndex: number;
};

/** Nearest point on a polyline ([lat, lon][]). */
export function nearestOnPolyline(lat: number, lon: number, line: LatLon[]): NearestOnLine | null {
  if (line.length < 2) return null;
  let best: NearestOnLine | null = null;
  let along = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [lat1, lon1] = line[i];
    const [lat2, lon2] = line[i + 1];
    const segKm = haversineKm(lat1, lon1, lat2, lon2);
    // Local ENU-ish projection around segment mid for nearest-point.
    const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
    const cos = Math.cos(midLat) || 1e-6;
    const ax = lon1 * cos;
    const ay = lat1;
    const bx = lon2 * cos;
    const by = lat2;
    const px = lon * cos;
    const py = lat;
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby;
    const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
    const qx = ax + t * abx;
    const qy = ay + t * aby;
    const qLon = qx / cos;
    const qLat = qy;
    const distM = haversineKm(lat, lon, qLat, qLon) * 1000;
    const alongKm = along + t * segKm;
    if (!best || distM < best.distM) {
      best = { lat: qLat, lon: qLon, distM, alongKm, segmentIndex: i };
    }
    along += segKm;
  }
  return best;
}

export type ChainageAnchor = { km: number; lon: number; lat: number };

/**
 * Estimate chainage (km) at a map click by projecting onto the path of chainage anchors.
 */
export function chainageNearPoint(
  lat: number,
  lon: number,
  anchors: ChainageAnchor[],
): { chainageKm: number; snapLat: number; snapLon: number; distM: number } | null {
  if (anchors.length < 2) {
    if (!anchors.length) return null;
    const a = anchors[0];
    return {
      chainageKm: a.km,
      snapLat: a.lat,
      snapLon: a.lon,
      distM: haversineKm(lat, lon, a.lat, a.lon) * 1000,
    };
  }
  const line: LatLon[] = anchors.map((a) => [a.lat, a.lon]);
  let bestDist = Infinity;
  let bestKm = anchors[0].km;
  let bestLat = anchors[0].lat;
  let bestLon = anchors[0].lon;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
    const cos = Math.cos(midLat) || 1e-6;
    const ax = a.lon * cos;
    const ay = a.lat;
    const bx = b.lon * cos;
    const by = b.lat;
    const px = lon * cos;
    const py = lat;
    const abx = bx - ax;
    const aby = by - ay;
    const ab2 = abx * abx + aby * aby;
    const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / ab2));
    const qLon = (ax + t * abx) / cos;
    const qLat = ay + t * aby;
    const distM = haversineKm(lat, lon, qLat, qLon) * 1000;
    if (distM < bestDist) {
      bestDist = distM;
      bestKm = a.km + t * (b.km - a.km);
      bestLat = qLat;
      bestLon = qLon;
    }
  }
  // Silence unused warning for line — kept for clarity of intent
  void line;
  return { chainageKm: bestKm, snapLat: bestLat, snapLon: bestLon, distM: bestDist };
}

export function formatChainageKm(km: number): string {
  const whole = Math.floor(km);
  const metres = Math.round((km - whole) * 1000);
  return `${whole}+${String(metres).padStart(3, "0")}`;
}

export function formatBearing(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(deg / 45) % 8;
  return `${deg.toFixed(1)}° (${dirs[idx]})`;
}

export const MEASURE_TOOLS: Array<{
  id: MeasureTool;
  label: string;
  hint: string;
  minPts: number;
  maxPts: number | null; // null = unlimited
}> = [
  { id: "distance", label: "Distance", hint: "Click points along a path", minPts: 2, maxPts: null },
  { id: "area", label: "Area", hint: "Click 3+ points to form a polygon", minPts: 3, maxPts: null },
  { id: "bearing", label: "Bearing", hint: "Click start, then end", minPts: 2, maxPts: 2 },
  { id: "elev", label: "Elevation Δ", hint: "Click two survey points", minPts: 2, maxPts: 2 },
];
