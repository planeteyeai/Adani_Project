export type WaterBodyFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    name: string;
    folder?: string | null;
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
};

let cache: WaterBodiesData | null = null;

export async function fetchWaterBodies(): Promise<WaterBodiesData | null> {
  try {
    if (!cache) {
      const res = await fetch("/water_bodies.json", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as WaterBodiesData;
    }
    return cache;
  } catch {
    return null;
  }
}
