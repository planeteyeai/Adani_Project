export type RailwayLineFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    name?: string | null;
    railway?: string | null;
    usage?: string | null;
    electrified?: string | null;
    gauge?: string | null;
    passenger_lines?: string | null;
    maxspeed?: string | null;
    osm_id?: string | null;
  };
  geometry: { type: "LineString"; coordinates: number[][] };
};

export type RailwayStationFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    name: string;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
};

export type RailwayPlatformFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    name: string;
    ref?: string | null;
    railway?: string | null;
    osm_id?: string | null;
  };
  geometry: { type: "Polygon"; coordinates: number[][][] };
};

export type RailwayCollection<F> = {
  title: string;
  description: string;
  count: number;
  type: "FeatureCollection";
  features: F[];
};

export type RailwayLinesData = RailwayCollection<RailwayLineFeature>;
export type RailwayStationsData = RailwayCollection<RailwayStationFeature>;
export type RailwayPlatformsData = RailwayCollection<RailwayPlatformFeature>;

const cache = new Map<string, unknown>();

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const hit = cache.get(url);
    if (hit) return hit as T;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    cache.set(url, data);
    return data;
  } catch {
    return null;
  }
}

export function fetchRailwayLines(): Promise<RailwayLinesData | null> {
  return fetchJson("/railway_lines.json");
}

export function fetchRailwayStations(): Promise<RailwayStationsData | null> {
  return fetchJson("/railway_stations.json");
}

export function fetchRailwayPlatforms(): Promise<RailwayPlatformsData | null> {
  return fetchJson("/railway_platforms.json");
}

export const RAILWAY_LINE_STYLE = {
  color: "#f8fafc",
  weight: 2.5,
  opacity: 0.95,
  dashArray: "8 4",
};

export const RAILWAY_PLATFORM_STYLE = {
  color: "#38bdf8",
  weight: 2,
  fillColor: "#0f172a",
  fillOpacity: 0.8,
  className: "railway-platform-glow",
};

export type RailwayLinesSummary = {
  segmentCount: number;
  lengthKm: number;
  namedRoutes: number;
  electrifiedCount: number;
  mainUsageCount: number;
  topRoutes: Array<{ name: string; count: number }>;
};

export type RailwayStationsSummary = {
  count: number;
  names: string[];
};

export type RailwayPlatformsSummary = {
  count: number;
  namedCount: number;
};

function approxLengthKm(coords: number[][]): number {
  let km = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const dLat = (lat2 - lat1) * 111.32;
    const dLon =
      (lon2 - lon1) * 111.32 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
    km += Math.hypot(dLat, dLon);
  }
  return km;
}

export function railwayLinesSummary(data: RailwayLinesData | null): RailwayLinesSummary | null {
  if (!data?.features.length) return null;

  const routeCounts = new Map<string, number>();
  let lengthKm = 0;
  let electrifiedCount = 0;
  let mainUsageCount = 0;

  for (const f of data.features) {
    const p = f.properties;
    if (p.name) routeCounts.set(p.name, (routeCounts.get(p.name) ?? 0) + 1);
    if (p.electrified && p.electrified !== "no" && p.electrified !== "unknown") {
      electrifiedCount += 1;
    }
    if (p.usage === "main") mainUsageCount += 1;
    lengthKm += approxLengthKm(f.geometry.coordinates);
  }

  const topRoutes = [...routeCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    segmentCount: data.count,
    lengthKm: Math.round(lengthKm * 10) / 10,
    namedRoutes: routeCounts.size,
    electrifiedCount,
    mainUsageCount,
    topRoutes,
  };
}

export function railwayStationsSummary(
  data: RailwayStationsData | null,
): RailwayStationsSummary | null {
  if (!data?.features.length) return null;
  return {
    count: data.count,
    names: data.features.map((f) => f.properties.name).filter(Boolean),
  };
}

export function railwayPlatformsSummary(
  data: RailwayPlatformsData | null,
): RailwayPlatformsSummary | null {
  if (!data?.features.length) return null;
  return {
    count: data.count,
    namedCount: data.features.filter((f) => !!f.properties.name).length,
  };
}
