export type TreePoint = {
  id: string;
  sr?: number | null;
  lat: number;
  lon: number;
  zone?: string | null;
  chainage_m?: number | null;
  area_m2?: number | null;
  avg_height_m?: number | null;
  min_height_m?: number | null;
  max_height_m?: number | null;
  score?: number | null;
};

export type TreesData = {
  title: string;
  description: string;
  count: number;
  trees: TreePoint[];
  source_file?: string;
  source_sheet?: string;
};

export type TreesSummaryInfo = {
  totalTrees: number;
  corridorZones: number;
  totalCanopyAreaM2: number;
  avgHeightM: number;
  tallestM: number;
  shortestM: number;
  largestCanopyM2: number;
  avgDetectionScore: number | null;
};

/** Aggregate stats for the Active layers Trees card. */
export function treesSummaryInfo(data: TreesData | null): TreesSummaryInfo | null {
  const trees = data?.trees;
  if (!trees?.length) return null;

  const zones = new Set<string>();
  let canopySum = 0;
  let canopyN = 0;
  let largestCanopy = Number.NEGATIVE_INFINITY;
  let heightSum = 0;
  let heightN = 0;
  let tallest = Number.NEGATIVE_INFINITY;
  let shortest = Number.POSITIVE_INFINITY;
  let scoreSum = 0;
  let scoreN = 0;

  for (const t of trees) {
    if (t.zone) zones.add(t.zone);

    if (t.area_m2 != null && Number.isFinite(t.area_m2)) {
      canopySum += t.area_m2;
      canopyN += 1;
      if (t.area_m2 > largestCanopy) largestCanopy = t.area_m2;
    }

    const h = t.avg_height_m ?? t.max_height_m ?? t.min_height_m;
    if (h != null && Number.isFinite(h)) {
      heightSum += h;
      heightN += 1;
      if (h > tallest) tallest = h;
      if (h < shortest) shortest = h;
    }

    if (t.score != null && Number.isFinite(t.score)) {
      scoreSum += t.score;
      scoreN += 1;
    }
  }

  if (!heightN || !canopyN) return null;

  return {
    totalTrees: trees.length,
    corridorZones: zones.size,
    totalCanopyAreaM2: Math.round(canopySum * 100) / 100,
    avgHeightM: Math.round((heightSum / heightN) * 100) / 100,
    tallestM: Math.round(tallest * 100) / 100,
    shortestM: Math.round(shortest * 100) / 100,
    largestCanopyM2: Math.round(largestCanopy * 100) / 100,
    avgDetectionScore: scoreN ? Math.round((scoreSum / scoreN) * 1000) / 1000 : null,
  };
}

let cache: TreesData | null = null;

export async function fetchTrees(): Promise<TreesData | null> {
  try {
    if (!cache) {
      const res = await fetch("/trees.json", {
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as TreesData;
    }
    return cache;
  } catch {
    return null;
  }
}
