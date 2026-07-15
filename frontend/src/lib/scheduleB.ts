export type ScheduleBStructure = {
  type: string;
  label: string;
  chainage_km: number;
  details: Record<string, unknown>;
};

export type ScheduleB = {
  source_file: string;
  summary: {
    centreline_km: number;
    counts: Record<string, number>;
  };
  structures: ScheduleBStructure[];
  tcs_stretches: Array<{
    from_km: number;
    to_km: number;
    length_km: number;
    tcs: string | null;
    description: string | null;
    remarks: string | null;
  }>;
  crust_layers: {
    main_carriageway: Array<{ layer: string; thickness: string | null }>;
    service_roads: Array<{ layer: string; thickness: string | null }>;
  };
  underpasses: Array<Record<string, unknown>>;
  overpasses: Array<Record<string, unknown>>;
  interchanges: Array<Record<string, unknown>>;
  culverts: Array<Record<string, unknown>>;
  elevated: Array<Record<string, unknown>>;
  service_roads: Array<Record<string, unknown>>;
  drains: Array<Record<string, unknown>>;
  re_walls: Array<Record<string, unknown>>;
  interchange_ramps: Array<Record<string, unknown>>;
  paved_shoulders?: Array<Record<string, unknown>>;
};

const STRUCTURE_COLORS: Record<string, string> = {
  underpass: "#3b82f6",
  overpass: "#8b5cf6",
  interchange: "#f59e0b",
  culvert: "#06b6d4",
  elevated: "#4de8ff",
};

export function structureColor(type: string): string {
  return STRUCTURE_COLORS[type] ?? "#94a3b8";
}

export function structureTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type ElevatedStructureInfo = {
  structureType: string;
  fromKm: number;
  toKm: number;
  totalLengthKm: number;
  totalLengthM: number;
  lhsWidthM: number | null;
  rhsWidthM: number | null;
  medianSuperstructure: string;
  spanArrangement: string;
  verticalClearanceM: number | null;
};

/** Design / Schedule-B elevated viaduct summary for the Active layers card. */
export function elevatedStructureInfo(sb: ScheduleB | null): ElevatedStructureInfo | null {
  const rows = sb?.elevated;
  if (!rows?.length) return null;

  let fromKm = Infinity;
  let toKm = -Infinity;
  let totalLengthKm = 0;
  let totalLengthM = 0;
  let lhsWidthM: number | null = null;
  let rhsWidthM: number | null = null;
  let medianSuperstructure = "—";
  let spanArrangement = "—";
  let verticalClearanceM: number | null = null;

  for (const r of rows) {
    const f = Number(r.from_km);
    const t = Number(r.to_km);
    if (Number.isFinite(f)) fromKm = Math.min(fromKm, f);
    if (Number.isFinite(t)) toKm = Math.max(toKm, t);
    const lk = Number(r.length_km);
    const lm = Number(r.length_m);
    if (Number.isFinite(lk)) totalLengthKm += lk;
    else if (Number.isFinite(f) && Number.isFinite(t)) totalLengthKm += Math.abs(t - f);
    if (Number.isFinite(lm)) totalLengthM += lm;
    if (r.lhs_width_m != null && Number.isFinite(Number(r.lhs_width_m))) {
      lhsWidthM = Number(r.lhs_width_m);
    }
    if (r.rhs_width_m != null && Number.isFinite(Number(r.rhs_width_m))) {
      rhsWidthM = Number(r.rhs_width_m);
    }
    if (r.median_superstructure != null && String(r.median_superstructure).trim()) {
      medianSuperstructure = String(r.median_superstructure).trim();
    }
    if (r.span_arrangement != null && String(r.span_arrangement).trim()) {
      spanArrangement = String(r.span_arrangement)
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\bX\b/gi, "×")
        .trim();
    }
    if (r.vertical_clearance_m != null && Number.isFinite(Number(r.vertical_clearance_m))) {
      verticalClearanceM = Number(r.vertical_clearance_m);
    }
  }

  if (!Number.isFinite(fromKm)) fromKm = 0;
  if (!Number.isFinite(toKm)) toKm = totalLengthKm;
  if (!totalLengthM && totalLengthKm) totalLengthM = Math.round(totalLengthKm * 1000);
  // Schedule-B often fills only LHS; treat missing RHS as same roadway width.
  if (rhsWidthM == null && lhsWidthM != null) rhsWidthM = lhsWidthM;

  return {
    structureType: "Elevated",
    fromKm,
    toKm,
    totalLengthKm,
    totalLengthM,
    lhsWidthM,
    rhsWidthM,
    medianSuperstructure,
    spanArrangement,
    verticalClearanceM,
  };
}

export type ServiceRoadInfo = {
  totalSections: number;
  vupSections: number;
  mainCarriagewaySections: number;
  vupLengthKm: number;
  mainCarriagewayLengthKm: number;
  overallLengthKm: number;
};

/**
 * Schedule-B service road summary.
 * VUP stretches are tagged TCS-5 / TCS-6; main carriageway uses TCS-3 / TCS-4.
 */
export function serviceRoadInfo(sb: ScheduleB | null): ServiceRoadInfo | null {
  const rows = sb?.service_roads;
  if (!rows?.length) return null;

  let vupSections = 0;
  let mainCarriagewaySections = 0;
  let vupLengthKm = 0;
  let mainCarriagewayLengthKm = 0;

  for (const r of rows) {
    const rem = String(r.remarks ?? "");
    const len =
      Number(r.total_length_km) ||
      (Number(r.lhs_length_km) || 0) + (Number(r.rhs_length_km) || 0) ||
      Math.abs((Number(r.to_km) || 0) - (Number(r.from_km) || 0));
    const isVup = /TCS\s*-\s*[56]\b/i.test(rem);
    if (isVup) {
      vupSections += 1;
      vupLengthKm += len;
    } else {
      mainCarriagewaySections += 1;
      mainCarriagewayLengthKm += len;
    }
  }

  return {
    totalSections: rows.length,
    vupSections,
    mainCarriagewaySections,
    vupLengthKm,
    mainCarriagewayLengthKm,
    overallLengthKm: vupLengthKm + mainCarriagewayLengthKm,
  };
}

export type ReWallInfo = {
  totalSections: number;
  totalLengthKm: number;
  vupSections: number;
  vupLengthKm: number;
  loopRampSections: number;
  loopRampLengthKm: number;
};

/**
 * Schedule-B RE wall summary.
 * VUP Approaches: remarks "VUP" (plus untagged approach stretch).
 * Loop / Ramp: all remaining RE wall stretches.
 */
export function reWallInfo(sb: ScheduleB | null): ReWallInfo | null {
  const rows = sb?.re_walls;
  if (!rows?.length) return null;

  let vupSections = 0;
  let vupLengthKm = 0;
  let loopRampSections = 0;
  let loopRampLengthKm = 0;

  for (const r of rows) {
    const rem = String(r.remarks ?? "").trim();
    const len =
      Number(r.total_length_km) ||
      (Number(r.lhs_length_km) || 0) + (Number(r.rhs_length_km) || 0) ||
      Math.abs((Number(r.to_km) || 0) - (Number(r.from_km) || 0));
    const isVup = /\bVUP\b/i.test(rem) || rem === "";
    if (isVup) {
      vupSections += 1;
      vupLengthKm += len;
    } else {
      loopRampSections += 1;
      loopRampLengthKm += len;
    }
  }

  return {
    totalSections: rows.length,
    totalLengthKm: vupLengthKm + loopRampLengthKm,
    vupSections,
    vupLengthKm,
    loopRampSections,
    loopRampLengthKm,
  };
}

export type DrainInfo = {
  structureType: string;
  drainCategory: string;
  totalSections: number;
  rccDrainSections: number;
  rccDrainCumFootpathSections: number;
  totalLengthKm: number;
};

/**
 * Schedule-B RCC drain summary.
 * LHS-only stretches → RCC Drain; both sides → RCC Drain cum Footpath.
 */
export function drainInfo(sb: ScheduleB | null): DrainInfo | null {
  const rows = sb?.drains;
  if (!rows?.length) return null;

  let rccDrainSections = 0;
  let rccDrainCumFootpathSections = 0;
  let totalLengthKm = 0;

  for (const r of rows) {
    const lhs = r.lhs_length_km != null ? Number(r.lhs_length_km) : null;
    const rhs = r.rhs_length_km != null ? Number(r.rhs_length_km) : null;
    const len =
      Number(r.total_length_km) ||
      (Number.isFinite(lhs) ? (lhs as number) : 0) + (Number.isFinite(rhs) ? (rhs as number) : 0) ||
      Math.abs((Number(r.to_km) || 0) - (Number(r.from_km) || 0));
    totalLengthKm += len;
    // Both sides present → drain cum footpath; otherwise RCC drain (typically LHS only)
    if (rhs != null && Number.isFinite(rhs) && rhs > 0) {
      rccDrainCumFootpathSections += 1;
    } else {
      rccDrainSections += 1;
    }
  }

  return {
    structureType: "RCC Drain",
    drainCategory: "RCC Drain / RCC Drain cum Footpath",
    totalSections: rows.length,
    rccDrainSections,
    rccDrainCumFootpathSections,
    totalLengthKm,
  };
}

export type ShoulderInfo = {
  totalSections: number;
  totalLengthKm: number;
  pavedSections: number;
  pavedLengthKm: number;
  earthenSections: number;
  earthenLengthKm: number;
};

/**
 * Schedule-B paved / earthen shoulder summary.
 * Excel often fills shoulder_type only on the first row of a block — propagate forward.
 * Total sections/length use unique From–To stretches (not paved+earthen double-count).
 */
export function shoulderInfo(sb: ScheduleB | null): ShoulderInfo | null {
  const rows = sb?.paved_shoulders;
  if (!rows?.length) return null;

  let curType: string | null = null;
  const filled: Array<{ from_km: number; to_km: number; length_km: number; shoulder_type: string }> =
    [];
  for (const r of rows) {
    const raw = String(r.shoulder_type ?? "").trim();
    if (raw) curType = raw;
    const fromKm = Number(r.from_km);
    const toKm = Number(r.to_km);
    if (!Number.isFinite(fromKm) || !Number.isFinite(toKm)) continue;
    const lengthKm =
      Number(r.length_km) || Math.abs(toKm - fromKm);
    filled.push({
      from_km: fromKm,
      to_km: toKm,
      length_km: lengthKm,
      shoulder_type: curType || "Paved Shoulder",
    });
  }
  if (!filled.length) return null;

  let pavedSections = 0;
  let pavedLengthKm = 0;
  let earthenSections = 0;
  let earthenLengthKm = 0;
  const unique = new Map<string, number>();

  for (const r of filled) {
    const key = `${r.from_km}-${r.to_km}`;
    if (!unique.has(key)) unique.set(key, r.length_km);

    const isEarthen = /earthen/i.test(r.shoulder_type);
    if (isEarthen) {
      earthenSections += 1;
      earthenLengthKm += r.length_km;
    } else {
      pavedSections += 1;
      pavedLengthKm += r.length_km;
    }
  }

  let totalLengthKm = 0;
  for (const len of unique.values()) totalLengthKm += len;

  return {
    totalSections: unique.size,
    totalLengthKm,
    pavedSections,
    pavedLengthKm,
    earthenSections,
    earthenLengthKm,
  };
}

export type StructureTypeCount = {
  type: string;
  label: string;
  count: number;
  color: string;
};

export type StructuresPointsInfo = {
  total: number;
  byType: StructureTypeCount[];
};

const STRUCTURE_TYPE_ORDER = ["underpass", "interchange", "overpass", "culvert", "elevated"] as const;

/** Point-structure inventory summary for Active layers (Underpasses, interchanges, etc.). */
export function structuresPointsInfo(sb: ScheduleB | null): StructuresPointsInfo | null {
  const rows = sb?.structures;
  if (!rows?.length) return null;

  const counts = new Map<string, number>();
  for (const s of rows) {
    const t = String(s.type || "other");
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  const byType: StructureTypeCount[] = [];
  const plural: Record<string, string> = {
    underpass: "Underpasses",
    interchange: "Interchanges",
    overpass: "Overpasses",
    culvert: "Culverts",
    elevated: "Elevated",
  };

  for (const type of STRUCTURE_TYPE_ORDER) {
    const count = counts.get(type) ?? 0;
    if (!count) continue;
    byType.push({
      type,
      label: plural[type] ?? structureTypeLabel(type),
      count,
      color: structureColor(type),
    });
  }
  for (const [type, count] of counts) {
    if ((STRUCTURE_TYPE_ORDER as readonly string[]).includes(type)) continue;
    byType.push({
      type,
      label: structureTypeLabel(type),
      count,
      color: structureColor(type),
    });
  }

  return { total: rows.length, byType };
}

export type ProjectAlignmentInfo = {
  totalLengthKm: number;
  existingLengthKm: number;
  numberOfLanes: number;
  alignmentType: string;
  elevatedSectionKm: number;
  atGradeSectionKm: number;
  medianWidthM: number;
  shoulderWidth: string;
  designSpeedKmh: number;
  designSpeedNote: string;
  serviceRoadsKm: number;
  startChainageKm: number;
  endChainageKm: number;
};

/** Project centreline / design alignment summary for Active layers. */
export function projectAlignmentInfo(sb: ScheduleB | null): ProjectAlignmentInfo {
  const elev = elevatedStructureInfo(sb);
  const roads = serviceRoadInfo(sb);
  const totalLengthKm = 35.215;
  const elevatedSectionKm = elev?.totalLengthKm ?? 17.488;
  const atGradeSectionKm = Math.max(0, totalLengthKm - elevatedSectionKm);

  return {
    totalLengthKm,
    existingLengthKm: 34.62,
    numberOfLanes: 4,
    alignmentType: "Divided Highway",
    elevatedSectionKm,
    atGradeSectionKm: Math.round(atGradeSectionKm * 1000) / 1000,
    medianWidthM: 2.5,
    shoulderWidth: "1.5–2.5 m",
    designSpeedKmh: 100,
    designSpeedNote: "*",
    serviceRoadsKm: roads?.overallLengthKm ?? 34.088,
    startChainageKm: 0,
    endChainageKm: 35.215,
  };
}

export {
  buildChainageIndex,
  chainageToCoord,
  createChainageResolver,
  sampleChainageRange,
} from "./chainage";

export function scheduleBFromStats(stats: { schedule_b?: ScheduleB }): ScheduleB | null {
  return stats.schedule_b ?? null;
}
