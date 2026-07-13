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
