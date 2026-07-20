export type ReWallFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    name: string;
    from_km: number | null;
    to_km: number | null;
    length_km: number | null;
    color: string;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

export type ReWallsData = {
  title: string;
  description: string;
  source_file?: string;
  count: number;
  color: string;
  from_km: number | null;
  to_km: number | null;
  total_coverage_km: number;
  type: "FeatureCollection";
  features: ReWallFeature[];
};

export const RE_WALL_COLOR = "#f97316";

let cache: ReWallsData | null = null;

export async function fetchReWalls(): Promise<ReWallsData | null> {
  try {
    if (!cache) {
      const res = await fetch("/re_walls.json", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as ReWallsData;
    }
    return cache;
  } catch {
    return null;
  }
}

export type ReWallLocationSummary = {
  count: number;
  totalCoverageKm: number;
  fromKm: number | null;
  toKm: number | null;
  segments: Array<{
    name: string;
    fromKm: number | null;
    toKm: number | null;
    lengthKm: number | null;
  }>;
};

export function reWallLocationsSummary(
  data: ReWallsData | null,
): ReWallLocationSummary | null {
  if (!data?.features?.length) return null;
  const segments = data.features
    .map((f) => ({
      name: f.properties.name,
      fromKm: f.properties.from_km,
      toKm: f.properties.to_km,
      lengthKm: f.properties.length_km,
    }))
    .sort((a, b) => (a.fromKm ?? 0) - (b.fromKm ?? 0));
  return {
    count: data.count,
    totalCoverageKm: data.total_coverage_km,
    fromKm: data.from_km,
    toKm: data.to_km,
    segments,
  };
}
