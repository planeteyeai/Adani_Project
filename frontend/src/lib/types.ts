export type GeoJSON = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: {
      type: "LineString" | "Point" | "Polygon";
      coordinates: number[] | number[][] | number[][][];
    };
  }>;
};

export type ProjectStats = {
  total_length_km: number;
  design_length_km?: number;
  line_count: number;
  point_count: number;
  bounds: [number, number, number, number];
  center: [number, number];
  schedule_b?: import("./scheduleB").ScheduleB;
};

export type Project = {
  id: number | string;
  name: string;
  location: string;
  industry: string;
  description?: string;
  stats: ProjectStats;
  geojson?: GeoJSON;
  source_filename?: string;
  created_at?: string;
};

export type Metrics = {
  length_km: number;
  drawn_line_km: number;
  avg_slope_pct: number;
  max_elevation_m: number;
  min_elevation_m: number;
  earthwork: {
    cut_m3: number;
    fill_m3: number;
    borrow_m3: number;
    waste_m3: number;
    balance_m3: number;
  };
  structures: Record<string, number>;
  total_structures: number;
  slope_bands: Record<string, number>;
  land_use: Record<string, number>;
  risks: Record<string, number>;
  risk_score: number;
  estimated_cost_cr: number;
  elevation_profile: Array<{ chainage_km: number; ground_level_m: number }>;
  schedule_b?: import("./scheduleB").ScheduleB | null;
};
