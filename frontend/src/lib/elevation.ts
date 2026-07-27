import type { ElevationPoint } from "../components/ElevationGraphModal";

let rawCache: ElevationPoint[] | null = null;

export function isCenterlinePoint(p: ElevationPoint): boolean {
  return !p.branch || p.branch === "centerline";
}

/** Subsample dense survey points for map markers (every Nth point per branch). */
export function elevationMapSample(points: ElevationPoint[], every = 10): ElevationPoint[] {
  const byBranch = new Map<string, ElevationPoint[]>();
  for (const p of points) {
    const key = p.branch ?? "centerline";
    const list = byBranch.get(key) ?? [];
    list.push(p);
    byBranch.set(key, list);
  }
  const out: ElevationPoint[] = [];
  for (const list of byBranch.values()) {
    const sorted = [...list].sort((a, b) => Number(a.chainage) - Number(b.chainage));
    for (let i = 0; i < sorted.length; i += every) out.push(sorted[i]);
  }
  return out.sort((a, b) => Number(a.chainage) - Number(b.chainage));
}

/** Points for the elevation graph / dashboard — centerline profile only. */
export function centerlineElevationPoints(points: ElevationPoint[]): ElevationPoint[] {
  return points
    .filter(isCenterlinePoint)
    .sort((a, b) => Number(a.chainage) - Number(b.chainage));
}

/** Load bundled ground elevation profile (centerline + 30 m LHS/RHS from survey KML). */
export async function fetchElevationProfile(): Promise<ElevationPoint[]> {
  try {
    if (!rawCache) {
      const res = await fetch("/Elevation_data_100m_distance.json", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return [];
      rawCache = (await res.json()) as ElevationPoint[];
    }
    return rawCache;
  } catch {
    return [];
  }
}

export function elevationToMetricsProfile(points: ElevationPoint[]) {
  return centerlineElevationPoints(points).map((p) => ({
    chainage_km: Number(p.chainage),
    ground_level_m: Number(p.elevation),
  }));
}

/**
 * Mean absolute grade (%) along a centreline elevation profile.
 * slope% = |ΔH| / Δs_m × 100 for each consecutive pair, then averaged.
 */
export function avgSlopePctFromProfile(
  profile: Array<{ chainage_km: number; ground_level_m: number }>,
): number {
  if (profile.length < 2) return 0;
  const pts = [...profile].sort((a, b) => a.chainage_km - b.chainage_km);
  let sum = 0;
  let n = 0;
  for (let i = 1; i < pts.length; i++) {
    const dH = Math.abs(pts[i].ground_level_m - pts[i - 1].ground_level_m);
    const dM = (pts[i].chainage_km - pts[i - 1].chainage_km) * 1000;
    if (!(dM > 0) || !Number.isFinite(dH)) continue;
    sum += (dH / dM) * 100;
    n++;
  }
  return n ? Math.round((sum / n) * 100) / 100 : 0;
}

const SLOPE_BAND_DEFS = [
  { id: "easy", name: "0-5% (Easy)", max: 5, color: "#22c55e" },
  { id: "moderate", name: "5-10% (Moderate)", max: 10, color: "#eab308" },
  { id: "difficult", name: "10-20% (Difficult)", max: 20, color: "#f97316" },
  { id: "severe", name: ">20% (Severe)", max: Infinity, color: "#ef4444" },
] as const;

export type SlopeBandId = (typeof SLOPE_BAND_DEFS)[number]["id"];

export const SLOPE_BAND_LEGEND = SLOPE_BAND_DEFS.map((b) => ({
  id: b.id,
  label: b.name,
  color: b.color,
}));

export function slopePctToBand(pct: number): (typeof SLOPE_BAND_DEFS)[number] {
  for (const b of SLOPE_BAND_DEFS) {
    if (pct < b.max || b.max === Infinity) return b;
  }
  return SLOPE_BAND_DEFS[SLOPE_BAND_DEFS.length - 1];
}

export function slopePctToColor(pct: number): string {
  return slopePctToBand(pct).color;
}

/**
 * Share of profile segments in each slope band (% of segments).
 * Returns [] if the profile is too short to classify.
 */
export function slopeBandsFromProfile(
  profile: Array<{ chainage_km: number; ground_level_m: number }>,
): Array<{ name: string; value: number }> {
  if (profile.length < 2) return [];
  const pts = [...profile].sort((a, b) => a.chainage_km - b.chainage_km);
  const counts = SLOPE_BAND_DEFS.map(() => 0);
  let n = 0;
  for (let i = 1; i < pts.length; i++) {
    const dH = Math.abs(pts[i].ground_level_m - pts[i - 1].ground_level_m);
    const dM = (pts[i].chainage_km - pts[i - 1].chainage_km) * 1000;
    if (!(dM > 0) || !Number.isFinite(dH)) continue;
    const pct = (dH / dM) * 100;
    const band = slopePctToBand(pct);
    const idx = SLOPE_BAND_DEFS.findIndex((b) => b.id === band.id);
    counts[idx] += 1;
    n += 1;
  }
  if (!n) return [];
  return SLOPE_BAND_DEFS.map((b, i) => ({
    name: b.name,
    value: Math.round((counts[i] / n) * 1000) / 10,
  }));
}

export type SlopeHeatSegment = {
  id: string;
  fromKm: number;
  toKm: number;
  slopePct: number;
  bandId: SlopeBandId;
  bandLabel: string;
  color: string;
  /** Leaflet [lat, lon] positions */
  positions: [number, number][];
};

/**
 * Build map polylines coloured by absolute grade between consecutive centreline
 * elevation survey points (uses lat/lon on each point).
 */
export function buildSlopeHeatSegments(points: ElevationPoint[]): SlopeHeatSegment[] {
  const pts = centerlineElevationPoints(points).filter(
    (p) =>
      p.latitude != null &&
      p.longitude != null &&
      Number.isFinite(Number(p.latitude)) &&
      Number.isFinite(Number(p.longitude)) &&
      Number.isFinite(Number(p.elevation)) &&
      Number.isFinite(Number(p.chainage)),
  );
  if (pts.length < 2) return [];

  const out: SlopeHeatSegment[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const fromKm = Number(a.chainage);
    const toKm = Number(b.chainage);
    const dM = (toKm - fromKm) * 1000;
    if (!(dM > 0)) continue;
    const dH = Math.abs(Number(b.elevation) - Number(a.elevation));
    if (!Number.isFinite(dH)) continue;
    const slopePct = Math.round((dH / dM) * 10000) / 100;
    const band = slopePctToBand(slopePct);
    out.push({
      id: `slope-${i}`,
      fromKm,
      toKm,
      slopePct,
      bandId: band.id,
      bandLabel: band.name,
      color: band.color,
      positions: [
        [Number(a.latitude), Number(a.longitude)],
        [Number(b.latitude), Number(b.longitude)],
      ],
    });
  }
  return out;
}
