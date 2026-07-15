export type VillageFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    name: string;
    folder?: string | null;
    type?: string | null;
    sub_district?: string | null;
    district?: string | null;
    state?: string | null;
    census_2001?: string | null;
    label_lon?: number;
    label_lat?: number;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

export type VillagesData = {
  title: string;
  description: string;
  count: number;
  type: "FeatureCollection";
  features: VillageFeature[];
};

let cache: VillagesData | null = null;

export async function fetchVillages(): Promise<VillagesData | null> {
  try {
    if (!cache) {
      const res = await fetch("/villages.json", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as VillagesData;
    }
    return cache;
  } catch {
    return null;
  }
}
