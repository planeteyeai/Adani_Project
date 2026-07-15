export type AdjacentRoadPoint = {
  id: string;
  index: number;
  name: string;
  asset_type: string;
  lat: number;
  lon: number;
};

export type AdjacentRoadsData = {
  title: string;
  description: string;
  count: number;
  points: AdjacentRoadPoint[];
  source_file?: string;
};

let cache: AdjacentRoadsData | null = null;

export async function fetchAdjacentRoads(): Promise<AdjacentRoadsData | null> {
  try {
    if (!cache) {
      const res = await fetch("/adjacent_roads.json", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as AdjacentRoadsData;
    }
    return cache;
  } catch {
    return null;
  }
}
