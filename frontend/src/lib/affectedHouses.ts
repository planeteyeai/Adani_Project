export type BuildingUseClassId =
  | "house"
  | "educational"
  | "temple"
  | "mosque"
  | "brick_kiln"
  | "other";

export type BuildingUseClass = {
  id: BuildingUseClassId | string;
  label: string;
  color: string;
  count: number;
};

export type AffectedHouseFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    name: string;
    code?: string | null;
    use_class?: BuildingUseClassId | string;
    use_label?: string;
    color?: string;
    folder?: string | null;
    source_id?: string | null;
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
  classes?: BuildingUseClass[];
  source_file?: string;
  source_folder?: string | null;
};

export const BUILDING_USE_COLORS: Record<string, string> = {
  house: "#ef4444",
  residential: "#ef4444",
  commercial: "#ef4444",
  vacant: "#ef4444",
  educational: "#3b82f6",
  temple: "#a855f7",
  mosque: "#14b8a6",
  brick_kiln: "#ea580c",
  other: "#64748b",
};

let cache: AffectedHousesData | null = null;

function onlySegregated(data: AffectedHousesData): AffectedHousesData {
  const features = data.features.filter((f) => Boolean(f.properties.use_class));
  if (features.length === data.features.length && data.classes?.length) {
    return data;
  }
  // Drop legacy footprints that have no use-class segregation
  const classCounts = new Map<string, number>();
  for (const f of features) {
    const id = String(f.properties.use_class);
    classCounts.set(id, (classCounts.get(id) ?? 0) + 1);
  }
  const classes =
    data.classes?.filter((c) => (classCounts.get(c.id) ?? 0) > 0).map((c) => ({
      ...c,
      count: classCounts.get(c.id) ?? 0,
    })) ??
    [...classCounts.entries()].map(([id, count]) => ({
      id,
      label: id,
      color: BUILDING_USE_COLORS[id] ?? "#64748b",
      count,
    }));
  return {
    ...data,
    features,
    count: features.length,
    classes,
  };
}

export async function fetchAffectedHouses(): Promise<AffectedHousesData | null> {
  try {
    if (!cache) {
      const res = await fetch(`/affected_houses.json?v=settle-segregated`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      cache = onlySegregated((await res.json()) as AffectedHousesData);
    }
    return cache;
  } catch {
    return null;
  }
}

export function clearAffectedHousesCache() {
  cache = null;
}

export function buildingUseColor(useClass?: string | null, fallback = "#ef4444"): string {
  if (!useClass) return fallback;
  return BUILDING_USE_COLORS[useClass] ?? fallback;
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
