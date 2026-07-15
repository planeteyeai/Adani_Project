export type ElevatedScourPoint = {
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
};

export type ElevatedScourStretch = {
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
  };
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
};

export type ElevatedScourData = {
  title: string;
  description: string;
  count: number;
  stretch_count: number;
  from_km: number | null;
  to_km: number | null;
  points: ElevatedScourPoint[];
  type: "FeatureCollection";
  features: ElevatedScourStretch[];
};

/** Assumed viaduct deck width for area estimates when no ROW width is in source data. */
export const ELEVATED_DECK_WIDTH_M = 15;

/** Map / legend colour for the elevated viaduct overlay. */
export const ELEVATED_VIADUCT_COLOR = "#4de8ff";

export type ElevatedSummary = {
  totalLengthKm: number;
  stretchCount: number;
  pointCount: number;
  fromKm: number | null;
  toKm: number | null;
  estAreaM2: number;
  estAreaHa: number;
  deckWidthM: number;
  scourMinM: number | null;
  scourMaxM: number | null;
  zoneCounts: Array<{ zone: string; count: number }>;
};

export function summarizeElevatedScour(data: ElevatedScourData | null): ElevatedSummary | null {
  if (!data?.features?.length) return null;
  let totalLengthKm = 0;
  let scourMinM: number | null = null;
  let scourMaxM: number | null = null;
  const zones = new Map<string, number>();
  for (const f of data.features) {
    const p = f.properties;
    totalLengthKm += Number(p.length_km) || 0;
    if (p.scour_min_m != null && Number.isFinite(p.scour_min_m)) {
      scourMinM = scourMinM == null ? p.scour_min_m : Math.min(scourMinM, p.scour_min_m);
    }
    if (p.scour_max_m != null && Number.isFinite(p.scour_max_m)) {
      scourMaxM = scourMaxM == null ? p.scour_max_m : Math.max(scourMaxM, p.scour_max_m);
    }
    const z = String(p.hydraulic_zone ?? "Unclassified");
    zones.set(z, (zones.get(z) ?? 0) + 1);
  }
  const estAreaM2 = totalLengthKm * 1000 * ELEVATED_DECK_WIDTH_M;
  return {
    totalLengthKm,
    stretchCount: data.stretch_count || data.features.length,
    pointCount: data.count || data.points?.length || 0,
    fromKm: data.from_km,
    toKm: data.to_km,
    estAreaM2,
    estAreaHa: estAreaM2 / 10_000,
    deckWidthM: ELEVATED_DECK_WIDTH_M,
    scourMinM,
    scourMaxM,
    zoneCounts: [...zones.entries()]
      .map(([zone, count]) => ({ zone, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** Colours by hydraulic zone for the elevated viaduct layer. */
export const ELEVATED_ZONE_COLORS: Record<string, string> = {
  "Primary Channel": "#0ea5e9",
  Floodplain: "#12c9b0",
  "Marginal Bar": "#f59e0b",
};

export function elevatedZoneColor(zone?: string | null): string {
  if (!zone) return "#12c9b0";
  return ELEVATED_ZONE_COLORS[zone] ?? "#12c9b0";
}

let cache: ElevatedScourData | null = null;

export async function fetchElevatedScour(): Promise<ElevatedScourData | null> {
  try {
    if (!cache) {
      const res = await fetch("/elevated_scour.json", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as ElevatedScourData;
    }
    return cache;
  } catch {
    return null;
  }
}
