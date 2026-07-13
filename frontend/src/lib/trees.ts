export type TreePoint = {
  id: string;
  sr?: number | null;
  lat: number;
  lon: number;
  zone?: string | null;
  chainage_m?: number | null;
};

export type TreesData = {
  title: string;
  description: string;
  count: number;
  trees: TreePoint[];
};

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
