export type WaterBodyFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    name: string;
    folder?: string | null;
    source_id?: string | null;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

export type WaterBodiesData = {
  title: string;
  description: string;
  count: number;
  type: "FeatureCollection";
  features: WaterBodyFeature[];
  source_file?: string;
  source_folder?: string | null;
};

let bodiesCache: WaterBodiesData | null = null;
let waysCache: WaterBodiesData | null = null;

export async function fetchWaterBodies(): Promise<WaterBodiesData | null> {
  try {
    if (!bodiesCache) {
      const res = await fetch("/water_bodies.json", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      bodiesCache = (await res.json()) as WaterBodiesData;
    }
    return bodiesCache;
  } catch {
    return null;
  }
}

export async function fetchWaterways(): Promise<WaterBodiesData | null> {
  try {
    if (!waysCache) {
      const res = await fetch("/waterways.json", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      waysCache = (await res.json()) as WaterBodiesData;
    }
    return waysCache;
  } catch {
    return null;
  }
}
