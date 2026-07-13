export type AffectedHouseFeature = {
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

export type AffectedHousesData = {
  title: string;
  description: string;
  count: number;
  type: "FeatureCollection";
  features: AffectedHouseFeature[];
};

let cache: AffectedHousesData | null = null;

export async function fetchAffectedHouses(): Promise<AffectedHousesData | null> {
  try {
    if (!cache) {
      const res = await fetch("/affected_houses.json", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as AffectedHousesData;
    }
    return cache;
  } catch {
    return null;
  }
}

/** Leaflet positions: [lat, lon][] */
export function polygonPositions(ring: number[][]): [number, number][] {
  return ring.map(([lon, lat]) => [lat, lon]);
}

export function houseCentroid(ring: number[][]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [lon, lat] of ring) {
    sx += lon;
    sy += lat;
  }
  return [sy / ring.length, sx / ring.length];
}
