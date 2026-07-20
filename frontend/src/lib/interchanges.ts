export type InterchangeFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    name: string;
    length_km: number | null;
    color: string;
  };
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
};

export type InterchangesData = {
  title: string;
  description: string;
  source_file?: string;
  count: number;
  color: string;
  total_length_km: number;
  type: "FeatureCollection";
  features: InterchangeFeature[];
};

export const INTERCHANGE_COLOR = "#eab308";

let cache: InterchangesData | null = null;

export async function fetchInterchanges(): Promise<InterchangesData | null> {
  try {
    if (!cache) {
      const res = await fetch("/interchanges.json", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as InterchangesData;
    }
    return cache;
  } catch {
    return null;
  }
}

export type InterchangeSummary = {
  count: number;
  totalLengthKm: number;
  longestKm: number | null;
  avgKm: number | null;
};

export function interchangesSummary(
  data: InterchangesData | null,
): InterchangeSummary | null {
  if (!data?.features?.length) return null;
  const lengths = data.features
    .map((f) => f.properties.length_km)
    .filter((v): v is number => v != null);
  const longest = lengths.length ? Math.max(...lengths) : null;
  const avg = lengths.length
    ? lengths.reduce((s, v) => s + v, 0) / lengths.length
    : null;
  return {
    count: data.count,
    totalLengthKm: data.total_length_km,
    longestKm: longest != null ? Math.round(longest * 1000) / 1000 : null,
    avgKm: avg != null ? Math.round(avg * 1000) / 1000 : null,
  };
}
