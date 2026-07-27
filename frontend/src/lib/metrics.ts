// Client-side metrics from project stats / Schedule-B.
// Elevation, slope, earthwork, and LULC are filled by the Dashboard from real datasets.
import type { Metrics, ProjectStats } from "./types";
import type { ScheduleB } from "./scheduleB";

export function deriveMetrics(stats: ProjectStats): Metrics {
  const scheduleB = (stats.schedule_b ?? null) as ScheduleB | null;
  const summary = scheduleB?.summary;
  const counts = summary?.counts;

  const drawn = stats.total_length_km || 1;
  let centreline = stats.design_length_km ?? summary?.centreline_km ?? drawn;
  if (!stats.design_length_km && !summary?.centreline_km && drawn > 60) {
    centreline = Math.min(drawn, 40);
  }

  let structures: Record<string, number> = {};
  let totalStructures = 0;
  if (counts) {
    structures = {
      underpasses: counts.underpasses ?? 0,
      overpasses: counts.overpasses ?? 0,
      interchanges: counts.interchanges ?? 0,
      culverts: counts.culverts ?? 0,
      retaining_walls: counts.re_walls ?? 0,
      elevated_sections: counts.elevated_sections ?? 0,
      drain_sections: counts.drain_sections ?? 0,
    };
    totalStructures = Object.values(structures).reduce((a, b) => a + b, 0);
  }

  return {
    length_km: Math.round(centreline * 100) / 100,
    drawn_line_km: Math.round(drawn * 10) / 10,
    avg_slope_pct: 0,
    max_elevation_m: 0,
    min_elevation_m: 0,
    earthwork: { cut_m3: 0, fill_m3: 0, borrow_m3: 0, waste_m3: 0, balance_m3: 0 },
    structures,
    total_structures: totalStructures,
    slope_bands: {},
    land_use: {},
    risks: {},
    risk_score: 0,
    estimated_cost_cr: 0,
    elevation_profile: [],
    schedule_b: scheduleB,
  };
}
