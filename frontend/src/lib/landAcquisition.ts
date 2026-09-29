export type LandAcquisitionBlock = {
  id: string;
  from_km: number;
  to_km: number;
  length_m: number;
  width_start_m: number;
  width_end_m: number;
  avg_width_m: number;
  area_m2: number;
  area_ha: number;
};

export type LandAcquisitionFeature = {
  type: "Feature";
  properties: {
    id: string;
    from_km: number;
    to_km: number;
    area_ha: number;
    avg_width_m: number;
    length_m: number;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

export type LandAcquisitionData = {
  title: string;
  description: string;
  source_outline: string;
  step_km: number;
  chainage_min_km: number;
  chainage_max_km: number;
  outline_area_ha: number | null;
  total_area_ha: number;
  block_count: number;
  cuts: Array<{
    km: number;
    width_m: number | null;
    left_m: number | null;
    right_m: number | null;
    mirrored?: boolean;
  }>;
  blocks: LandAcquisitionBlock[];
  type: "FeatureCollection";
  features: LandAcquisitionFeature[];
};

let cache: LandAcquisitionData | null = null;

export async function fetchLandAcquisition(): Promise<LandAcquisitionData | null> {
  try {
    if (!cache) {
      const res = await fetch("/land_acquisition_chainage.json", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as LandAcquisitionData;
    }
    return cache;
  } catch {
    return null;
  }
}

/** Colour ramp by area (ha) within one chainage step. */
export function landBlockColor(areaHa: number, maxHa: number): string {
  const t = maxHa > 0 ? Math.max(0, Math.min(1, areaHa / maxHa)) : 0;
  if (t < 0.33) return "#38e1c6";
  if (t < 0.66) return "#f59e0b";
  return "#f43f5e";
}

export function formatChainageKm(km: number): string {
  const whole = Math.floor(km);
  const metres = Math.round((km - whole) * 1000);
  return `${whole}+${String(metres).padStart(3, "0")}`;
}
