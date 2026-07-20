export type CutFillClassId =
  | "cut"
  | "fill_0_2"
  | "fill_2_4"
  | "fill_4_6"
  | "fill_6_8"
  | "fill_8_plus";

export type CutFillBranchId = "lhs" | "rhs";

export type CutFillSegment = {
  id: string;
  from_km: number;
  to_km: number;
  mid_km: number;
  lat?: number | null;
  lon?: number | null;
  length_m: number;
  fill_m3?: number | null;
  cut_m3?: number | null;
  net_m3?: number | null;
  fill_mass_t?: number | null;
  height_cl_m?: number | null;
  height_30m_m?: number | null;
  avg_fill_height_m?: number | null;
  tcs?: string | null;
  description?: string;
  station_count?: number;
  stations?: number | null;
  pct_total_fill?: number | null;
  class_id: CutFillClassId;
  segment_ids?: string[];
};

export type CutFillStretch = CutFillSegment;

export type CutFillBranch = {
  id: CutFillBranchId;
  name: string;
  side: string;
  offset: number;
  station_count: number;
  segment_count: number;
  stretch_count: number;
  fill_m3?: number | null;
  cut_m3?: number | null;
  net_m3?: number | null;
  segments: CutFillSegment[];
  stretches: CutFillStretch[];
};

export type CutFillTcsBreakdown = {
  tcs: string;
  chainage_range: string;
  stations: number;
  fill_m3: number;
  cut_m3: number;
  net_m3: number;
  avg_fill_height_m: number;
  pct_total_fill: number;
};

export type CutFillSummaryBlock = {
  chainage_covered?: string | null;
  right_of_way?: string | null;
  fill_m3?: number | null;
  cut_m3?: number | null;
  net_m3?: number | null;
  fill_mt?: number | null;
  cut_mt?: number | null;
  net_mt?: number | null;
  lhs_fill_m3?: number | null;
  lhs_cut_m3?: number | null;
  lhs_net_m3?: number | null;
  lhs_fill_mt?: number | null;
  rhs_fill_m3?: number | null;
  rhs_cut_m3?: number | null;
  rhs_net_m3?: number | null;
  rhs_fill_mt?: number | null;
  tcs_breakdown?: CutFillTcsBreakdown[];
};

export type CutFillData = {
  title: string;
  description: string;
  unit_volume: string;
  unit_mass: string;
  density_t_per_m3: number;
  from_km: number | null;
  to_km: number | null;
  station_count: number;
  segment_count: number;
  stretch_count: number;
  rhs_station_count: number;
  lhs_station_count: number;
  summary: CutFillSummaryBlock;
  class_counts: Record<string, number>;
  tcs_ranges: CutFillSegment[];
  branches: CutFillBranch[];
  segments: CutFillSegment[];
  stretches: CutFillStretch[];
  profile: Array<{
    chainage_km: number;
    fill_m3: number;
    cut_m3: number;
    net_m3: number;
    height_cl_m: number | null;
    class_id: CutFillClassId;
    tcs: string | null;
  }>;
};

export type CutFillSeriesVisibility = Record<CutFillBranchId, boolean>;

export const DEFAULT_CUT_FILL_VISIBILITY: CutFillSeriesVisibility = {
  lhs: true,
  rhs: true,
};

export const CUT_FILL_CLASS_META: Record<
  CutFillClassId,
  { label: string; color: string; short: string }
> = {
  cut: { label: "Cut / excavation", color: "#38bdf8", short: "Cut" },
  fill_0_2: { label: "Fill 0–2 m", color: "#fde68a", short: "0–2 m" },
  fill_2_4: { label: "Fill 2–4 m", color: "#fbbf24", short: "2–4 m" },
  fill_4_6: { label: "Fill 4–6 m", color: "#f59e0b", short: "4–6 m" },
  fill_6_8: { label: "Fill 6–8 m", color: "#ea580c", short: "6–8 m" },
  fill_8_plus: { label: "Fill > 8 m", color: "#b91c1c", short: "> 8 m" },
};

export const CUT_FILL_CLASS_ORDER: CutFillClassId[] = [
  "fill_0_2",
  "fill_2_4",
  "fill_4_6",
  "fill_6_8",
  "fill_8_plus",
];

/** Distinct colours for TCS type corridor (centerline). */
export const CUT_FILL_TCS_COLORS: Record<string, string> = {
  "TCS - 1": "#a855f7",
  "TCS - 3": "#22c55e",
  "TCS - 4": "#14b8a6",
  "TCS - 5": "#3b82f6",
  "TCS - 6": "#ec4899",
  "TCS - 8": "#94a3b8",
};

export const CUT_FILL_BRANCH_META: Record<
  CutFillBranchId,
  { label: string; color: string; offsetM: number }
> = {
  lhs: { label: "LHS", color: "#38bdf8", offsetM: -15 },
  rhs: { label: "RHS", color: "#f97316", offsetM: 15 },
};

export function cutFillClassColor(classId?: string | null): string {
  if (!classId) return "#94a3b8";
  return CUT_FILL_CLASS_META[classId as CutFillClassId]?.color ?? "#94a3b8";
}

export function cutFillClassLabel(classId?: string | null): string {
  if (!classId) return "Unknown";
  return CUT_FILL_CLASS_META[classId as CutFillClassId]?.label ?? classId;
}

export function cutFillTcsColor(tcs?: string | null): string {
  if (!tcs) return "#a855f7";
  return CUT_FILL_TCS_COLORS[tcs] ?? "#a855f7";
}

export type CutFillSummary = {
  fromKm: number | null;
  toKm: number | null;
  segmentCount: number;
  stretchCount: number;
  stationCount: number;
  fillM3: number | null;
  cutM3: number | null;
  netM3: number | null;
  lhsFillM3: number | null;
  rhsFillM3: number | null;
  lhsCutM3: number | null;
  rhsCutM3: number | null;
  tcsTypes: string[];
  classCounts: Array<{ classId: CutFillClassId; count: number; label: string; color: string }>;
};

export function summarizeCutFill(data: CutFillData | null): CutFillSummary | null {
  if (!data) return null;
  const tcsTypes = [
    ...new Set(
      (data.tcs_ranges ?? [])
        .map((r) => r.tcs)
        .filter((t): t is string => !!t),
    ),
  ].sort();
  return {
    fromKm: data.from_km,
    toKm: data.to_km,
    segmentCount: data.segment_count,
    stretchCount: data.stretch_count,
    stationCount: data.station_count,
    fillM3: data.summary?.fill_m3 ?? null,
    cutM3: data.summary?.cut_m3 ?? null,
    netM3: data.summary?.net_m3 ?? null,
    lhsFillM3: data.summary?.lhs_fill_m3 ?? null,
    rhsFillM3: data.summary?.rhs_fill_m3 ?? null,
    lhsCutM3: data.summary?.lhs_cut_m3 ?? null,
    rhsCutM3: data.summary?.rhs_cut_m3 ?? null,
    tcsTypes,
    classCounts: CUT_FILL_CLASS_ORDER.filter((id) => (data.class_counts?.[id] ?? 0) > 0).map(
      (id) => ({
        classId: id,
        count: data.class_counts[id] ?? 0,
        label: CUT_FILL_CLASS_META[id].label,
        color: CUT_FILL_CLASS_META[id].color,
      }),
    ),
  };
}

let cache: CutFillData | null = null;

export async function fetchCutFill(): Promise<CutFillData | null> {
  try {
    if (!cache) {
      const res = await fetch("/cut_fill.json", {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      cache = (await res.json()) as CutFillData;
    }
    return cache;
  } catch {
    return null;
  }
}
