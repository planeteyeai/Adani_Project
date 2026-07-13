// The heart of GeoVision: a catalogue of base layers so users can switch between
// many kinds of maps and satellite views. All providers here are free / keyless,
// which keeps the demo running anywhere. Swap in Mapbox / Google / Bing keys later.

export type BaseMap = {
  id: string;
  name: string;
  group: "Satellite" | "Terrain" | "Street" | "Dark" | "Hybrid";
  url: string;
  attribution: string;
  maxZoom: number;
  /** Tile subdomains, e.g. Google `mt0`–`mt3`. */
  subdomains?: string | string[];
  // optional overlay tiles rendered on top (e.g. labels/roads for hybrid)
  overlay?: { url: string; attribution: string; subdomains?: string | string[] };
  thumb: string; // gradient preview for the switcher
};

export const BASEMAPS: BaseMap[] = [
  {
    id: "topo",
    name: "Topographic (OpenTopoMap)",
    group: "Terrain",
    url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap, © OpenStreetMap contributors",
    maxZoom: 17,
    thumb: "linear-gradient(135deg,#d9d0b8,#b6a17a,#7d8a5a)",
  },
  {
    id: "street",
    name: "Street (OpenStreetMap)",
    group: "Street",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
    thumb: "linear-gradient(135deg,#e8ede4,#c7d6c0,#9db8d6)",
  },
  {
    id: "google-satellite",
    name: "Satellite (Google)",
    group: "Satellite",
    url: "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "© Google",
    maxZoom: 21,
    thumb: "linear-gradient(135deg,#1a2f4a,#2d4a6e,#4a7ab8)",
  },
  {
    id: "google-hybrid",
    name: "Hybrid (Google)",
    group: "Hybrid",
    url: "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "© Google",
    maxZoom: 21,
    thumb: "linear-gradient(135deg,#1e3a5f,#3d6b9e,#6b9fd4)",
  },
  {
    id: "google-roadmap",
    name: "Roadmap (Google)",
    group: "Street",
    url: "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "© Google",
    maxZoom: 21,
    thumb: "linear-gradient(135deg,#e8f0fe,#c5d9f7,#9bb8e8)",
  },
  {
    id: "google-terrain",
    name: "Terrain (Google)",
    group: "Terrain",
    url: "https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "© Google",
    maxZoom: 21,
    thumb: "linear-gradient(135deg,#c8e6c9,#81c784,#4caf50)",
  },
];

// Thematic analysis overlays that sit on top of any basemap.
export type AnalysisOverlay = {
  id: string;
  name: string;
  description: string;
  group: string;
  /** Optional swatch colour shown in the layers panel. */
  color?: string;
};

export const ANALYSIS_OVERLAYS: AnalysisOverlay[] = [
  // Alignment & markers
  { id: "alignment", name: "Project Alignment", description: "Plan & profile centreline and lanes", group: "Alignment & Markers", color: "#c026d3" },
  { id: "markers", name: "Chainage Points", description: "KMZ chainage markers along alignment", group: "Alignment & Markers", color: "#3b82f6" },
  { id: "toll_plazas", name: "Toll Plaza Locations", description: "Toll plaza markers from KMZ", group: "Alignment & Markers", color: "#f59e0b" },
  { id: "road_categories", name: "Road Categories", description: "Lane configuration (2/6/8-lane)", group: "Alignment & Markers", color: "#22c55e" },
  {
    id: "road_network",
    name: "Road Network (1 km buffer)",
    description: "OSM roads within 1000 m of the corridor",
    group: "Alignment & Markers",
    color: "#f59e0b",
  },
  {
    id: "railway_lines",
    name: "Railway Lines",
    description: "Railway track centreline in the project area",
    group: "Alignment & Markers",
    color: "#e2e8f0",
  },
  {
    id: "railway_stations",
    name: "Railway Stations",
    description: "Railway station locations",
    group: "Alignment & Markers",
    color: "#f97316",
  },
  {
    id: "railway_platforms",
    name: "Railway Platforms",
    description: "Railway platform footprints",
    group: "Alignment & Markers",
    color: "#1e293b",
  },

  // Power / utilities
  {
    id: "transmission_lines",
    name: "Transmission Lines",
    description: "High-voltage transmission lines",
    group: "Utilities",
    color: "#facc15",
  },
  {
    id: "substations",
    name: "Substations",
    description: "Electrical substation footprints",
    group: "Utilities",
    color: "#fbbf24",
  },
  {
    id: "transmission_towers",
    name: "Transmission Towers",
    description: "Transmission tower locations",
    group: "Utilities",
    color: "#eab308",
  },

  // Schedule-B point structures
  { id: "structures", name: "Structures (points)", description: "Underpasses, interchanges, culverts, elevated", group: "Schedule-B Structures", color: "#f59e0b" },

  // Schedule-B linear corridor features (drawn along the alignment)
  { id: "sb_elevated", name: "Elevated Viaduct", description: "Elevated / structure stretches", group: "Schedule-B Corridor", color: "#12c9b0" },
  { id: "sb_service_roads", name: "Service Roads", description: "Service / slip / connecting roads", group: "Schedule-B Corridor", color: "#3b82f6" },
  { id: "sb_re_walls", name: "RE Walls", description: "Reinforced-earth retaining walls", group: "Schedule-B Corridor", color: "#f97316" },
  { id: "sb_drains", name: "Drains", description: "Longitudinal drainage stretches", group: "Schedule-B Corridor", color: "#06b6d4" },
  { id: "sb_ramps", name: "Interchange Ramps", description: "Interchange ramp alignments", group: "Schedule-B Corridor", color: "#eab308" },
  { id: "sb_paved_shoulders", name: "Paved Shoulders", description: "Paved shoulder stretches", group: "Schedule-B Corridor", color: "#94a3b8" },

  // Geotechnical
  { id: "boreholes", name: "Soil Analysis", description: "Geotechnical borehole & soil-test locations", group: "Geotechnical", color: "#a855f7" },

  // Environment
  {
    id: "water_bodies",
    name: "Water Bodies",
    description: "Ponds, lakes and water polygons along the corridor",
    group: "Environment",
    color: "#0ea5e9",
  },
  {
    id: "lulc",
    name: "LULC",
    description: "Land use / land cover: agriculture, forest, built-up, bareland, water",
    group: "Environment",
    color: "#33a02c",
  },
  {
    id: "trees",
    name: "Trees",
    description: "Tree inventory along the project corridor",
    group: "Environment",
    color: "#22c55e",
  },
  {
    id: "contours_1m",
    name: "Contours 1 m",
    description: "1 metre interval ground elevation contours",
    group: "Environment",
    color: "#14b8a6",
  },
  {
    id: "contours_0_5m",
    name: "Contours 0.5 m",
    description: "0.5 metre interval ground elevation contours",
    group: "Environment",
    color: "#0ea5e9",
  },

  // Social impact
  {
    id: "affected_houses",
    name: "Structures within Acquisition Boundary",
    description: "Building footprints inside the land acquisition boundary",
    group: "Social Impact",
    color: "#ef4444",
  },

  // Analysis
  {
    id: "flood",
    name: "Flood water time series",
    description: "Satellite water & inundation extent over time",
    group: "Analysis",
    color: "#0ea5e9",
  },
  { id: "corridor", name: "RoW Corridor Buffer", description: "Right-of-way influence buffer", group: "Analysis", color: "#38e1c6" },
  { id: "slope", name: "Slope Heat (sim)", description: "Simulated slope severity along route", group: "Analysis", color: "#f97316" },
];

/** Ordered list of overlay groups for rendering the layers panel. */
export const ANALYSIS_OVERLAY_GROUPS = [
  "Alignment & Markers",
  "Utilities",
  "Schedule-B Structures",
  "Schedule-B Corridor",
  "Geotechnical",
  "Environment",
  "Social Impact",
  "Analysis",
] as const;
