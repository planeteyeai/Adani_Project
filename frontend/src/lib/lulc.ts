export type LulcFeature = {
  type: "Feature";
  properties: {
    id: string;
    index: number;
    class: string;
    name: string;
    color: string;
    folder?: string | null;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

export type LulcClass = {
  name: string;
  color: string;
  count: number;
  area_ha?: number;
  area_m2?: number;
};

export type LulcData = {
  title: string;
  description: string;
  count: number;
  classes: LulcClass[];
  type: "FeatureCollection";
  features: LulcFeature[];
  source_file?: string;
  total_area_ha?: number;
  total_area_m2?: number;
};

export type LulcSummaryInfo = {
  totalPolygons: number;
  totalAreaM2: number;
  classes: Array<{ name: string; color: string; count: number; areaM2: number }>;
};

/** Active-layers summary for LULC class areas (square metres). */
export function lulcSummaryInfo(data: LulcData | null): LulcSummaryInfo | null {
  if (!data?.classes?.length) return null;

  const classes = data.classes
    .map((c) => {
      const areaM2 =
        c.area_m2 != null && Number.isFinite(c.area_m2)
          ? c.area_m2
          : c.area_ha != null && Number.isFinite(c.area_ha)
            ? Math.round(c.area_ha * 10_000)
            : null;
      if (areaM2 == null) return null;
      return {
        name: c.name,
        color: c.color,
        count: c.count,
        areaM2,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);

  if (!classes.length) return null;

  const totalAreaM2 =
    data.total_area_m2 != null && Number.isFinite(data.total_area_m2)
      ? data.total_area_m2
      : data.total_area_ha != null && Number.isFinite(data.total_area_ha)
        ? Math.round(data.total_area_ha * 10_000)
        : classes.reduce((s, c) => s + c.areaM2, 0);

  return {
    totalPolygons: data.count,
    totalAreaM2,
    classes,
  };
}

let cache: LulcData | null = null;

export async function fetchLulc(): Promise<LulcData | null> {
  try {
    if (!cache) {
      const res = await fetch("/lulc.json", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as LulcData;
    }
    return cache;
  } catch {
    return null;
  }
}
