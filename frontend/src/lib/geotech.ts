// Geotechnical borehole + soil-test data loader.
// Source: geotech_boreholes.json (parsed from the site investigation workbook).

export type SoilLayer = {
  "Depth (m)": string;
  "Soil Class"?: string;
  Remarks?: string;
  [key: string]: string | number | undefined;
};

export type Borehole = {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  layers: SoilLayer[];
};

export type GeotechData = {
  title: string;
  count: number;
  detailed_count: number;
  columns: string[];
  boreholes: Borehole[];
};

let cache: GeotechData | null = null;

export async function fetchGeotech(): Promise<GeotechData | null> {
  try {
    if (!cache) {
      const res = await fetch("/geotech_boreholes.json", {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as GeotechData;
    }
    return cache;
  } catch {
    return null;
  }
}

/** Best representative SBC (safe bearing capacity) for a borehole = value of its shallowest layer. */
export function boreholeSummary(bh: Borehole) {
  const first = bh.layers[0];
  const deepest = bh.layers[bh.layers.length - 1];
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);
  return {
    hasData: bh.layers.length > 0,
    maxDepth: bh.layers.length,
    topSoilClass: first?.["Soil Class"],
    topSbc: num(first?.["SBC (T/m²)"]),
    baseSbc: num(deepest?.["SBC (T/m²)"]),
    topCbr: num(first?.["CBR (%)"]),
  };
}
