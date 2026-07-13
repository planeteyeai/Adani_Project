export type RoadNetworkFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    name?: string | null;
    highway: string;
    surface?: string | null;
    lanes?: string | null;
    ref?: string | null;
    osm_id?: string | null;
  };
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
};

export type RoadNetworkData = {
  title: string;
  description: string;
  count: number;
  highway_counts: Array<{ highway: string; count: number }>;
  type: "FeatureCollection";
  features: RoadNetworkFeature[];
};

/** Stroke style by OSM highway class. */
export const HIGHWAY_STYLES: Record<string, { color: string; weight: number; label: string }> = {
  motorway: { color: "#e11d48", weight: 3.5, label: "Motorway" },
  motorway_link: { color: "#fb7185", weight: 2.5, label: "Motorway link" },
  trunk: { color: "#ea580c", weight: 3.2, label: "Trunk" },
  trunk_link: { color: "#fb923c", weight: 2.2, label: "Trunk link" },
  primary: { color: "#ca8a04", weight: 2.8, label: "Primary" },
  primary_link: { color: "#eab308", weight: 2, label: "Primary link" },
  secondary: { color: "#65a30d", weight: 2.4, label: "Secondary" },
  tertiary: { color: "#16a34a", weight: 2, label: "Tertiary" },
  unclassified: { color: "#94a3b8", weight: 1.5, label: "Unclassified" },
  residential: { color: "#64748b", weight: 1.4, label: "Residential" },
  living_street: { color: "#78716c", weight: 1.3, label: "Living street" },
  service: { color: "#a8a29e", weight: 1.2, label: "Service" },
  track: { color: "#a16207", weight: 1.2, label: "Track" },
  unknown: { color: "#475569", weight: 1.3, label: "Other / unknown" },
};

export function highwayStyle(highway: string): { color: string; weight: number; label: string } {
  return HIGHWAY_STYLES[highway] ?? HIGHWAY_STYLES.unknown;
}

let cache: RoadNetworkData | null = null;

export async function fetchRoadNetwork(): Promise<RoadNetworkData | null> {
  try {
    if (!cache) {
      const res = await fetch("/road_network.json", {
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as RoadNetworkData;
    }
    return cache;
  } catch {
    return null;
  }
}
