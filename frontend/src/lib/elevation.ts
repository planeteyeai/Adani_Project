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
