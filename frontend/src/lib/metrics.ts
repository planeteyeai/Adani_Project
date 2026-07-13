// Client-side mirror of the backend engineering derivations so the dashboard works
// even when the Django API is offline. Deterministic (seeded from geometry).
import type { Metrics, ProjectStats } from "./types";
import type { ScheduleB } from "./scheduleB";

function seedFrom(stats: ProjectStats): number {
  const key = `${stats.total_length_km}-${stats.center?.join(",")}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function normalise(d: Record<string, number>): Record<string, number> {
  const total = Object.values(d).reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(d)) out[k] = Math.round((Math.max(0, v) / total) * 1000) / 10;
  return out;
}

export function deriveMetrics(stats: ProjectStats): Metrics {
  const scheduleB = (stats.schedule_b ?? null) as ScheduleB | null;
  const summary = scheduleB?.summary;
  const counts = summary?.counts;

  const drawn = stats.total_length_km || 1;
  let centreline = stats.design_length_km ?? summary?.centreline_km ?? drawn;
  if (!stats.design_length_km && !summary?.centreline_km && drawn > 60) {
    centreline = Math.min(drawn, 40);
  }
  const seed = seedFrom(stats);

  const avgSlope = Math.round((1.5 + seed * 6.5) * 100) / 100;
  const maxElev = Math.round((55 + seed * 40) * 10) / 10;
  const minElev = Math.round((38 + seed * 8) * 10) / 10;

  const cut = Math.round(centreline * (48000 + seed * 22000));
  const fill = Math.round(centreline * (52000 + (1 - seed) * 20000));
  const borrow = Math.max(0, Math.round(fill - cut * 0.85));
  const waste = Math.max(0, Math.round(cut - fill * 0.85));

  let structures: Record<string, number>;
  let totalStructures: number;
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
    totalStructures = counts.total_structures ?? Object.values(structures).reduce((a, b) => a + b, 0);
  } else {
    structures = {
      bridges: Math.max(1, Math.round(centreline * 0.17)),
      culverts: Math.max(2, Math.round(centreline * 0.9)),
      underpasses: Math.max(1, Math.round(centreline * 0.28)),
      interchanges: Math.max(1, Math.round(centreline * 0.14)),
      retaining_walls: Math.max(2, Math.round(centreline * 0.6)),
    };
    totalStructures = Object.values(structures).reduce((a, b) => a + b, 0);
  }

  const slopeBands = normalise({
    "0-5% (Easy)": 0.42 + seed * 0.1,
    "5-10% (Moderate)": 0.3,
    "10-20% (Difficult)": 0.18 - seed * 0.05,
    ">20% (Severe)": 0.1 - seed * 0.05,
  });

  const landUse = normalise({
    Agriculture: 0.38,
    "Built-up / Urban": 0.22,
    Barren: 0.14,
    Water: 0.09,
    Forest: 0.08,
    "Road / Rail": 0.09,
  });

  const risks = {
    Flood: Math.round(30 + seed * 45),
    Landslide: Math.round(8 + seed * 20),
    "Water Logging": Math.round(20 + seed * 40),
    "River Crossing": Math.round(15 + (1 - seed) * 35),
    "Utility Conflict": Math.round(25 + seed * 30),
    "Land Acquisition": Math.round(35 + seed * 40),
  };
  const riskScore = Math.round(
    Object.values(risks).reduce((a, b) => a + b, 0) / Object.keys(risks).length
  );

  const elevation_profile = Array.from({ length: 61 }, (_, i) => {
    const ch = Math.round((centreline * i) / 60 * 1000) / 1000;
    const wave = Math.sin(i / 5 + seed * 6) * 0.5 + Math.sin(i / 11 + seed * 3) * 0.5;
    const elev = Math.round((minElev + (maxElev - minElev) * (0.5 + 0.4 * wave)) * 100) / 100;
    return { chainage_km: ch, ground_level_m: elev };
  });

  return {
    length_km: Math.round(centreline * 100) / 100,
    drawn_line_km: Math.round(drawn * 10) / 10,
    avg_slope_pct: avgSlope,
    max_elevation_m: maxElev,
    min_elevation_m: minElev,
    earthwork: { cut_m3: cut, fill_m3: fill, borrow_m3: borrow, waste_m3: waste, balance_m3: cut - fill },
    structures,
    total_structures: totalStructures,
    slope_bands: slopeBands,
    land_use: landUse,
    risks,
    risk_score: riskScore,
    estimated_cost_cr: Math.round(centreline * (28 + seed * 12) * 10) / 10,
    elevation_profile,
    schedule_b: scheduleB,
  };
}
