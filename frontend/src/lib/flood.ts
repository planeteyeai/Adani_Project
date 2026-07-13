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

export type FloodData = {
  title: string;
  description: string;
  unit: string;
  dates: string[];
  timeseries: FloodTimeStep[];
  scenes: Record<string, FloodScene>;
};

let cache: FloodData | null = null;

export async function fetchFloodTimeseries(): Promise<FloodData | null> {
  try {
    if (!cache) {
      const res = await fetch("/flood_timeseries.json", {
        signal: AbortSignal.timeout(15000),
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
