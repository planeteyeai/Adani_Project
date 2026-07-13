export type ContourFeature = {
  type: "Feature";
  properties: {
    id: string;
    elevation: number | null;
    interval_m: number;
  };
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
  bbox?: [number, number, number, number];
};

export type ContoursData = {
  title: string;
  description: string;
  interval_m: number;
  count: number;
  elev_min: number | null;
  elev_max: number | null;
  type: "FeatureCollection";
  features: ContourFeature[];
};

export type ContourLine = {
  id: string;
  elevation: number | null;
  coords: [number, number][]; // [lon, lat]
  bbox: [number, number, number, number];
};

const cache = new Map<string, ContoursData>();

async function fetchContours(url: string): Promise<ContoursData | null> {
  try {
    const hit = cache.get(url);
    if (hit) return hit;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    const data = (await res.json()) as ContoursData;
    cache.set(url, data);
    return data;
  } catch {
    return null;
  }
}

export function fetchContours1m(): Promise<ContoursData | null> {
  return fetchContours("/contours_1m.json");
}

export function fetchContours05m(): Promise<ContoursData | null> {
  return fetchContours("/contours_0_5m.json");
}

export function contoursToLines(data: ContoursData | null): ContourLine[] {
  if (!data?.features?.length) return [];
  return data.features.map((f) => {
    const coords = (f.geometry.coordinates ?? []).map(
      (c) => [c[0], c[1]] as [number, number],
    );
    const bbox =
      f.bbox ??
      ([
        Math.min(...coords.map((c) => c[0])),
        Math.min(...coords.map((c) => c[1])),
        Math.max(...coords.map((c) => c[0])),
        Math.max(...coords.map((c) => c[1])),
      ] as [number, number, number, number]);
    return {
      id: f.properties.id,
      elevation: f.properties.elevation,
      coords,
      bbox,
    };
  });
}

/** Blue → teal → amber elevation colour ramp. */
export function contourColor(
  elev: number | null,
  minElev: number,
  maxElev: number,
): string {
  if (elev == null || !Number.isFinite(elev)) return "#94a3b8";
  const span = Math.max(0.001, maxElev - minElev);
  const t = Math.max(0, Math.min(1, (elev - minElev) / span));
  // low = #0ea5e9, mid = #14b8a6, high = #f59e0b
  if (t < 0.5) {
    const u = t * 2;
    return lerpHex("#0ea5e9", "#14b8a6", u);
  }
  return lerpHex("#14b8a6", "#f59e0b", (t - 0.5) * 2);
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
