export type RoadFormationPoint = {
  chainage_km: number;
  lat: number;
  lon: number;
  ground_elev_m?: number | null;
  formation_level_m?: number | null;
};

export type RoadFormationBranch = {
  id: string;
  name: string;
  count: number;
  points: RoadFormationPoint[];
};

export type RoadFormationData = {
  title: string;
  source_file: string;
  count: number;
  from_km: number | null;
  to_km: number | null;
  formation_min_m: number | null;
  formation_max_m: number | null;
  ground_min_m: number | null;
  ground_max_m: number | null;
  geometry_note?: string;
  branches: RoadFormationBranch[];
};

export type RoadFormationSummary = {
  pointCount: number;
  branchCount: number;
  fromKm: number | null;
  toKm: number | null;
  formationMinM: number | null;
  formationMaxM: number | null;
  groundMinM: number | null;
  groundMaxM: number | null;
};

// Formation colours are the per-branch complements of the ground-elevation
// colours (LHS blue→orange, Centre teal→pink, RHS amber→violet) so the two
// series never blend together on the combined profile or the map.
export const ROAD_FORMATION_BRANCH_COLORS: Record<string, string> = {
  lhs: "#f97316",
  centerline: "#ec4899",
  rhs: "#8b5cf6",
};

let cache: RoadFormationData | null = null;

export async function fetchRoadFormation(): Promise<RoadFormationData | null> {
  try {
    if (!cache) {
      const res = await fetch("/road_formation.json?v=offset-rhs-1", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as RoadFormationData;
    }
    return cache;
  } catch {
    return null;
  }
}

export function summarizeRoadFormation(
  data: RoadFormationData | null,
): RoadFormationSummary | null {
  if (!data) return null;
  return {
    pointCount: data.count,
    branchCount: data.branches.length,
    fromKm: data.from_km,
    toKm: data.to_km,
    formationMinM: data.formation_min_m,
    formationMaxM: data.formation_max_m,
    groundMinM: data.ground_min_m,
    groundMaxM: data.ground_max_m,
  };
}
