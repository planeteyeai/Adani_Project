export type LulcFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    class: string;
    name: string;
    color: string;
    folder?: string | null;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

export type LulcClass = {
  name: string;
  color: string;
  count: number;
};

export type LulcData = {
  title: string;
  description: string;
  count: number;
  classes: LulcClass[];
  type: "FeatureCollection";
  features: LulcFeature[];
};

let cache: LulcData | null = null;

export async function fetchLulc(): Promise<LulcData | null> {
  try {
    if (!cache) {
      const res = await fetch("/lulc.json", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as LulcData;
    }
    return cache;
  } catch {
    return null;
  }
}
