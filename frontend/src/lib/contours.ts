import { slopePctToBand, type SlopeBandId } from "./elevation";

export type ContourFeature = {
  type: "Feature";
  properties: {
    id: string;
    elevation: number | null;
    interval_m: number;
  };
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
  bbox?: [number, number, number, number];
};

export type ContoursData = {
  title: string;
  description: string;
  interval_m: number;
  count: number;
  elev_min: number | null;
  elev_max: number | null;
  type: "FeatureCollection";
  features: ContourFeature[];
};

export type ContourLine = {
  id: string;
  elevation: number | null;
  coords: [number, number][]; // [lon, lat]
  bbox: [number, number, number, number];
};

export type ContourSlopeSegment = {
  id: string;
  slopePct: number;
  bandId: SlopeBandId;
  bandLabel: string;
  color: string;
  /** Leaflet [lat, lon] positions */
  positions: [number, number][];
};

type GridVertex = { lat: number; lon: number; elev: number };

function metersBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const mLat = 111_320;
  const mLon = 111_320 * Math.cos((lat1 * Math.PI) / 180);
  const dy = (lat2 - lat1) * mLat;
  const dx = (lon2 - lon1) * mLon;
  return Math.hypot(dx, dy);
}

/**
 * Terrain slope from contour spacing: for each contour segment, find the nearest
 * vertex on a contour of a different elevation and compute
 *   slope% = |Δelevation| / horizontal_distance × 100.
 * Closely-spaced contours ⇒ steep. Returns map polylines coloured by slope band.
 */
export function buildContourSlopeSegments(
  data: ContoursData | null,
  opts: { searchRadiusM?: number; cellDeg?: number } = {},
): ContourSlopeSegment[] {
  if (!data?.features?.length) return [];
  const searchRadiusM = opts.searchRadiusM ?? 250;
  const cellDeg = opts.cellDeg ?? 0.0025; // ~275 m cells

  // Index every contour vertex (with elevation) into a coarse spatial grid.
  const grid = new Map<string, GridVertex[]>();
  const key = (lat: number, lon: number) =>
    `${Math.floor(lat / cellDeg)},${Math.floor(lon / cellDeg)}`;
  for (const f of data.features) {
    const elev = f.properties.elevation;
    if (elev == null || !Number.isFinite(elev)) continue;
    for (const c of f.geometry.coordinates ?? []) {
      const lon = c[0];
      const lat = c[1];
      const k = key(lat, lon);
      const bucket = grid.get(k);
      const v = { lat, lon, elev };
      if (bucket) bucket.push(v);
      else grid.set(k, [v]);
    }
  }

  const nearestOtherElev = (
    lat: number,
    lon: number,
    elev: number,
  ): { dist: number; dElev: number } | null => {
    const cLat = Math.floor(lat / cellDeg);
    const cLon = Math.floor(lon / cellDeg);
    let bestDist = Infinity;
    let bestDElev = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = grid.get(`${cLat + dy},${cLon + dx}`);
        if (!bucket) continue;
        for (const v of bucket) {
          if (v.elev === elev) continue;
          const d = metersBetween(lat, lon, v.lat, v.lon);
          if (d < bestDist) {
            bestDist = d;
            bestDElev = Math.abs(v.elev - elev);
          }
        }
      }
    }
    if (!Number.isFinite(bestDist) || bestDist > searchRadiusM || bestDist <= 0) {
      return null;
    }
    return { dist: bestDist, dElev: bestDElev };
  };

  const out: ContourSlopeSegment[] = [];
  for (const f of data.features) {
    const elev = f.properties.elevation;
    if (elev == null || !Number.isFinite(elev)) continue;
    const coords = f.geometry.coordinates ?? [];
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1];
      const b = coords[i];
      const midLat = (a[1] + b[1]) / 2;
      const midLon = (a[0] + b[0]) / 2;
      const hit = nearestOtherElev(midLat, midLon, elev);
      if (!hit) continue;
      const slopePct = Math.round((hit.dElev / hit.dist) * 10000) / 100;
      const band = slopePctToBand(slopePct);
      out.push({
        id: `${f.properties.id}-${i}`,
        slopePct,
        bandId: band.id,
        bandLabel: band.name,
        color: band.color,
        positions: [
          [a[1], a[0]],
          [b[1], b[0]],
        ],
      });
    }
  }
  return out;
}

const cache = new Map<string, ContoursData>();

async function fetchContours(url: string): Promise<ContoursData | null> {
  try {
    const hit = cache.get(url);
    if (hit) return hit;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    const data = (await res.json()) as ContoursData;
    cache.set(url, data);
    return data;
  } catch {
    return null;
  }
}

export function fetchContours1m(): Promise<ContoursData | null> {
  return fetchContours("/contours_1m.json");
}

export function fetchContours05m(): Promise<ContoursData | null> {
  return fetchContours("/contours_0_5m.json");
}

export function contoursToLines(data: ContoursData | null): ContourLine[] {
  if (!data?.features?.length) return [];
  return data.features.map((f) => {
    const coords = (f.geometry.coordinates ?? []).map(
      (c) => [c[0], c[1]] as [number, number],
    );
    const bbox =
      f.bbox ??
      ([
        Math.min(...coords.map((c) => c[0])),
        Math.min(...coords.map((c) => c[1])),
        Math.max(...coords.map((c) => c[0])),
        Math.max(...coords.map((c) => c[1])),
      ] as [number, number, number, number]);
    return {
      id: f.properties.id,
      elevation: f.properties.elevation,
      coords,
      bbox,
    };
  });
}

/** Blue → teal → amber elevation colour ramp. */
export function contourColor(
  elev: number | null,
  minElev: number,
  maxElev: number,
): string {
  if (elev == null || !Number.isFinite(elev)) return "#94a3b8";
  const span = Math.max(0.001, maxElev - minElev);
  const t = Math.max(0, Math.min(1, (elev - minElev) / span));
  // low = #0ea5e9, mid = #14b8a6, high = #f59e0b
  if (t < 0.5) {
    const u = t * 2;
    return lerpHex("#0ea5e9", "#14b8a6", u);
  }
  return lerpHex("#14b8a6", "#f59e0b", (t - 0.5) * 2);
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
