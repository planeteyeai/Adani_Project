export type BarrenLandFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    class: string;
    name: string;
    color: string;
    area_sqm?: number | null;
    area_acre?: number | null;
    area_ha?: number | null;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

export type BarrenLandData = {
  title: string;
  description: string;
  source_file?: string;
  count: number;
  color: string;
  total_area_m2?: number;
  total_area_ha?: number;
  total_area_acre?: number;
  type: "FeatureCollection";
  features: BarrenLandFeature[];
};

export const BARREN_LAND_COLOR = "#c2853b";

let cache: BarrenLandData | null = null;

export async function fetchBarrenLand(): Promise<BarrenLandData | null> {
  try {
    if (!cache) {
      const res = await fetch("/barren_land.json", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as BarrenLandData;
    }
    return cache;
  } catch {
    return null;
  }
}
