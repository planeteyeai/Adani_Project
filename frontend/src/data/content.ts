export const FEATURES = [
  { icon: "LineChart", name: "Existing Ground Level (EGL)", desc: "Longitudinal profile & cross sections with ground elevation every 10 m, exportable to Excel.", to: "/explorer?layers=alignment,markers&graph=elevation" },
  { icon: "Contrast", name: "Contour Mapping", desc: "0.5 m – 10 m interactive contours with elevation labels and 3D rendering.", to: "/explorer?layers=contours_1m,contours_0_5m" },
  { icon: "TriangleRight", name: "Slope Analysis", desc: "Colour-coded slope in % and degrees with construction difficulty & machine suitability.", to: "/explorer?layers=alignment,contours_1m&graph=elevation" },
  { icon: "Layers", name: "Cut & Fill", desc: "The core module — excavation, fill, volume, cost and earthwork balance in 3D.", to: "/explorer?layers=cut_fill" },
  { icon: "Waves", name: "Flood Analysis", desc: "River mapping, watershed, HFL, flood zones and probability with rainfall overlay.", to: "/explorer?layers=flood,water_bodies" },
  { icon: "Map", name: "Land Use Classification", desc: "AI land-cover classes with automatic area, percentage and statistics.", to: "/explorer?layers=lulc" },
  { icon: "Layers3", name: "Soil & Geology", desc: "Soil type, bearing capacity, foundation recommendation, faults and seismic zone.", to: "/explorer?layers=boreholes" },
  { icon: "Split", name: "Alignment Optimisation", desc: "AI suggests shortest, lowest-earthwork, lowest-cost and lowest-risk routes.", to: "/explorer?layers=alignment,sb_ramps" },
  { icon: "Truck", name: "Haul & Borrow Planning", desc: "Vehicle routing, borrow-area and disposal-site recommendation with cost.", to: "/explorer?layers=barren_land,road_network" },
  { icon: "Bot", name: "AI Assistant", desc: "Ask 'how much earthwork?', 'how many bridges?', 'suggest a better alignment'.", to: "/explorer?layers=alignment,structures" },
  { icon: "Gauge", name: "GIS Dashboard", desc: "Dark, modern widgets: length, elevation, slope, earthwork, structures, risk score.", to: "/dashboard" },
  { icon: "FileBarChart", name: "16+ Report Types", desc: "Engineering, earthwork, flood, soil, utility, alignment, cost and carbon reports.", to: "/reports" },
] as const;

export const STATS = [
  { value: "70%", label: "Less field survey time" },
  { value: "25%", label: "Lower earthwork cost" },
  { value: "10x", label: "Faster alignment studies" },
  { value: "16+", label: "Automated report types" },
] as const;
