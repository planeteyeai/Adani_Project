export type GroundScourPoint = {
  id: string;
  chainage_km: number;
  latitude: number;
  longitude: number;
  ground_elev_m?: number | null;
  ground_elev_corrected_m?: number | null;
  seasons_wet_of_4?: number | null;
  hydraulic_zone?: string | null;
  flow?: string | null;
  d_pre_m?: number | null;
  d_post_m?: number | null;
  v_pre_ms?: number | null;
  v_post_ms?: number | null;
  q_post_m3sm?: number | null;
  scour_min_m?: number | null;
  scour_max_m?: number | null;
  design_hfl_continuous_m?: number | null;
};

export type GroundScourStretch = {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    from_km: number;
    to_km: number;
    length_km: number;
    hydraulic_zone?: string | null;
    point_count: number;
    scour_min_m?: number | null;
    scour_max_m?: number | null;
    design_hfl_min_m?: number | null;
    design_hfl_max_m?: number | null;
  };
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
};

export type GroundScourData = {
  title: string;
  description: string;
  count: number;
  stretch_count: number;
  from_km: number | null;
  to_km: number | null;
  scour_min_m: number | null;
  scour_max_m: number | null;
  design_hfl_min_m: number | null;
  design_hfl_max_m: number | null;
  points: GroundScourPoint[];
  type: "FeatureCollection";
  features: GroundScourStretch[];
};

export const GROUND_SCOUR_COLOR = "#f43f5e";

const ZONE_COLORS: Record<string, string> = {
  "Primary Channel": "#0ea5e9",
  "Secondary Channel": "#38bdf8",
  Overbank: "#22c55e",
  Floodplain: "#84cc16",
  Embankment: "#f59e0b",
};

export function groundScourZoneColor(zone?: string | null): string {
  if (!zone) return GROUND_SCOUR_COLOR;
  return ZONE_COLORS[zone] ?? GROUND_SCOUR_COLOR;
}

/** Colour by scour severity (max scour depth). */
export function groundScourDepthColor(scourMaxM?: number | null): string {
  if (scourMaxM == null || !Number.isFinite(scourMaxM)) return "#94a3b8";
  if (scourMaxM < 2) return "#22c55e";
  if (scourMaxM < 5) return "#eab308";
  if (scourMaxM < 8) return "#f97316";
  return "#ef4444";
}

export type GroundScourSummary = {
  pointCount: number;
  stretchCount: number;
  fromKm: number | null;
  toKm: number | null;
  scourMinM: number | null;
  scourMaxM: number | null;
  designHflMinM: number | null;
  designHflMaxM: number | null;
  zoneCounts: Array<{ zone: string; count: number }>;
};

export function summarizeGroundScour(data: GroundScourData | null): GroundScourSummary | null {
  if (!data?.points?.length) return null;
  const zones = new Map<string, number>();
  for (const p of data.points) {
    const z = p.hydraulic_zone?.trim() || "Unknown";
    zones.set(z, (zones.get(z) ?? 0) + 1);
  }
  return {
    pointCount: data.count,
    stretchCount: data.stretch_count,
    fromKm: data.from_km,
    toKm: data.to_km,
    scourMinM: data.scour_min_m,
    scourMaxM: data.scour_max_m,
    designHflMinM: data.design_hfl_min_m,
    designHflMaxM: data.design_hfl_max_m,
    zoneCounts: [...zones.entries()]
      .map(([zone, count]) => ({ zone, count }))
      .sort((a, b) => b.count - a.count),
  };
}

let cache: GroundScourData | null = null;

export async function fetchGroundScour(): Promise<GroundScourData | null> {
  try {
    if (!cache) {
      const res = await fetch("/ground_scour.json", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as GroundScourData;
    }
    return cache;
  } catch {
    return null;
  }
}
