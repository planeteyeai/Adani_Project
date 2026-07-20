export type FloodClass = "water" | "flood";

export type FloodPoint = {
  lat: number;
  lon: number;
  class: FloodClass;
};

export type FloodTimeStep = {
  date: string;
  pre_date?: string | null;
  lat?: number | null;
  lon?: number | null;
  water_area_ha?: number | null;
  flood_area_ha?: number | null;
  water_points?: number;
  flood_points?: number;
};

export type FloodScene = {
  date: string;
  pre_date?: string | null;
  water_area_ha?: number | null;
  flood_area_ha?: number | null;
  water_points: number;
  flood_points: number;
  points: FloodPoint[];
};

/** Gauge / stage peak water level for a flood season year. */
export type FloodMaxWaterLevel = {
  year: number;
  max_water_level_m: number;
  peak_date: string | null;
  peak_label: string;
  note?: string | null;
};

/** River gauge reference where max water levels are measured. */
export type FloodReferenceLocation = {
  name: string;
  lat: number;
  lon: number;
  agency?: string;
  danger_level_m?: number | null;
  datum?: string;
  description?: string;
};

export type FloodData = {
  title: string;
  description: string;
  unit: string;
  dates: string[];
  timeseries: FloodTimeStep[];
  scenes: Record<string, FloodScene>;
  max_water_levels?: FloodMaxWaterLevel[];
  reference_location?: FloodReferenceLocation;
};

/** Default gauge reference when not present in JSON (Digha Ghat, Patna). */
export const FLOOD_GAUGE_REFERENCE: FloodReferenceLocation = {
  name: "Digha Ghat",
  lat: 25.6533611,
  lon: 85.0901944,
  agency: "WRD Bihar · Ganga river gauge",
  danger_level_m: 50.45,
  datum: "River stage (m)",
  description:
    "Reference gauge where maximum water levels are recorded for flood monitoring along the Ganga at Patna.",
};

export function floodGaugeReference(data: FloodData | null): FloodReferenceLocation {
  return data?.reference_location ?? FLOOD_GAUGE_REFERENCE;
}

let cache: FloodData | null = null;

export async function fetchFloodTimeseries(): Promise<FloodData | null> {
  try {
    if (!cache) {
      const res = await fetch("/flood_timeseries.json", {
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as FloodData;
    }
    return cache;
  } catch {
    return null;
  }
}

export const FLOOD_COLORS = {
  water: "#38bdf8",
  flood: "#f97316",
  waterArea: "#0ea5e9",
  floodArea: "#fb923c",
} as const;

export function formatFloodDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Highest recorded max water level across all years (e.g. Aug 2016 severe flood). */
export function floodRecordMaxWaterLevel(
  data: FloodData | null,
): FloodMaxWaterLevel | null {
  const rows = data?.max_water_levels;
  if (!rows?.length) return null;
  return rows.reduce((best, row) =>
    row.max_water_level_m > best.max_water_level_m ? row : best,
  );
}

export function floodMaxWaterLevelForYear(
  data: FloodData | null,
  year: string | number,
): FloodMaxWaterLevel | null {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  return data?.max_water_levels?.find((r) => r.year === y) ?? null;
}
