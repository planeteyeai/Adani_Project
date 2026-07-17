export type DesignHflPoint = {
  id: number;
  chainage_km: number;
  latitude: number;
  longitude: number;
  design_hfl_continuous_m: number;
};

let cache: DesignHflPoint[] | null = null;

export async function fetchDesignHfl(): Promise<DesignHflPoint[]> {
  try {
    if (!cache) {
      const res = await fetch("/design_hfl.json", { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return [];
      cache = (await res.json()) as DesignHflPoint[];
    }
    return cache;
  } catch {
    return [];
  }
}

export function nearestDesignHfl(
  points: DesignHflPoint[],
  chainageKm: number,
): DesignHflPoint | undefined {
  if (!points.length) return undefined;
  let lo = 0;
  let hi = points.length - 1;
  if (chainageKm <= points[0].chainage_km) return points[0];
  if (chainageKm >= points[hi].chainage_km) return points[hi];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = points[mid].chainage_km;
    if (c === chainageKm) return points[mid];
    if (c < chainageKm) lo = mid + 1;
    else hi = mid - 1;
  }
  const a = points[Math.max(0, hi)];
  const b = points[Math.min(points.length - 1, lo)];
  return Math.abs(a.chainage_km - chainageKm) <= Math.abs(b.chainage_km - chainageKm) ? a : b;
}
