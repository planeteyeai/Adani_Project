export type TransmissionFeatureProps = {
  id: string;
  index: number;
  name: string;
  power?: string | null;
  voltage?: string | null;
  circuits?: string | null;
  cables?: string | null;
  osm_id?: string | null;
};

export type TransmissionCollection<G extends string> = {
  title: string;
  description: string;
  count: number;
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: TransmissionFeatureProps;
    geometry: {
      type: G;
      coordinates: number[] | number[][] | number[][][];
    };
  }>;
};

export type TransmissionLinesData = TransmissionCollection<"LineString">;
export type SubstationsData = TransmissionCollection<"Polygon">;
export type TransmissionTowersData = TransmissionCollection<"Point">;

/** 11 kV KML: LineString segments + pole Point features. */
export type Transmission11kvData = {
  title: string;
  description: string;
  count: number;
  line_count?: number;
  pole_count?: number;
  voltage_kv?: number;
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: TransmissionFeatureProps & { kind?: string | null };
    geometry: {
      type: "LineString" | "Point";
      coordinates: number[] | number[][];
    };
  }>;
};

const cache = new Map<string, unknown>();

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const hit = cache.get(url);
    if (hit) return hit as T;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    cache.set(url, data);
    return data;
  } catch {
    return null;
  }
}

export function fetchTransmissionLines(): Promise<TransmissionLinesData | null> {
  return fetchJson("/transmission_lines.json");
}

export function fetchTransmission11kv(): Promise<Transmission11kvData | null> {
  return fetchJson("/transmission_11kv.json");
}

export function fetchSubstations(): Promise<SubstationsData | null> {
  return fetchJson("/substations.json");
}

export function fetchTransmissionTowers(): Promise<TransmissionTowersData | null> {
  return fetchJson("/transmission_towers.json");
}

export const TRANSMISSION_LINE_STYLE = {
  color: "#facc15",
  weight: 3,
  opacity: 0.95,
  dashArray: "10 6",
};

export const TRANSMISSION_11KV_STYLE = {
  color: "#fb923c",
  weight: 3,
  opacity: 0.95,
};

export const SUBSTATION_STYLE = {
  color: "#fbbf24",
  weight: 2,
  fillColor: "#854d0e",
  fillOpacity: 0.65,
};
