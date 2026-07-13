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
  elevated: "#12c9b0",
};

export function structureColor(type: string): string {
  return STRUCTURE_COLORS[type] ?? "#94a3b8";
}

export function structureTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
