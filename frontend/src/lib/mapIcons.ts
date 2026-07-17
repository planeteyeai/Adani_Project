import L from "leaflet";
import type { ScheduleBStructure } from "./scheduleB";

/** PNG pins in `frontend/public/icons/structures/` */
export const STRUCTURE_ICON_DIR = "/icons/structures";

export const STRUCTURE_ICON_FILES = {
  vup: "VUP.png",
  trumpet: "Trumpet.png",
  cloverLeaf: "Clover_Leaf.png",
  elevated: "Elevated_Section .png",
} as const;

export function structureIconUrl(filename: string): string {
  return `${STRUCTURE_ICON_DIR}/${encodeURIComponent(filename)}`;
}

export function createStructureIcon(filename: string): L.Icon {
  return L.icon({
    iconUrl: structureIconUrl(filename),
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -44],
    tooltipAnchor: [20, -40],
    shadowUrl: "",
    className: "geovision-map-icon",
  });
}

export function structureIconFile(s: ScheduleBStructure): string | null {
  const remarks = String(s.details?.remarks ?? s.label ?? "");
  const upper = remarks.toUpperCase();
  const label = s.label.toUpperCase();

  if (s.type === "elevated") return STRUCTURE_ICON_FILES.elevated;

  if (s.type === "underpass") {
    if (upper.includes("VUP")) return STRUCTURE_ICON_FILES.vup;
    if (upper.includes("TRUMPET")) return STRUCTURE_ICON_FILES.trumpet;
  }

  if (s.type === "overpass" && upper.includes("CLOVER")) {
    return STRUCTURE_ICON_FILES.cloverLeaf;
  }

  if (s.type === "interchange") {
    if (label.includes("CLOVER") || upper.includes("CLOVER")) return STRUCTURE_ICON_FILES.cloverLeaf;
    if (label.includes("TRUMPET") || upper.includes("TRUMPET")) return STRUCTURE_ICON_FILES.trumpet;
  }

  if (s.type === "culvert") return null;

  return null;
}

export function createTollPlazaIcon(): L.DivIcon {
  return L.divIcon({
    className: "geovision-toll-icon",
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:linear-gradient(135deg,#fbbf24,#f59e0b);
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;
      font-size:9px;font-weight:800;color:#422006;letter-spacing:-0.5px;
    ">TOLL</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    tooltipAnchor: [14, -12],
  });
}

export function createAdjacentRoadIcon(): L.DivIcon {
  return L.divIcon({
    className: "geovision-adjacent-road-icon",
    html: `<div style="
      width:28px;height:28px;border-radius:8px;
      background:linear-gradient(135deg,#38bdf8,#0284c7);
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;
      font-size:8px;font-weight:800;color:#082f49;letter-spacing:-0.3px;
    ">ADJ</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    tooltipAnchor: [14, -12],
  });
}

const ROAD_CATEGORY_RE = /\d[\d+]*-?\s*LANE/i;

export function isRoadCategoryName(name: string): boolean {
  return ROAD_CATEGORY_RE.test(name);
}

export type RoadCategoryStyle = {
  label: string;
  shortLabel: string;
  color: string;
  gradient: [string, string];
};

export function roadCategoryStyle(name: string): RoadCategoryStyle {
  const upper = name.toUpperCase();
  if (upper.includes("8-LANE")) {
    return { label: "8-Lane", shortLabel: "8L", color: "#8b5cf6", gradient: ["#c4b5fd", "#8b5cf6"] };
  }
  if (upper.includes("6-LANE")) {
    return { label: "6-Lane", shortLabel: "6L", color: "#3b82f6", gradient: ["#93c5fd", "#3b82f6"] };
  }
  if (upper.includes("2+2-LANE")) {
    return { label: "2+2-Lane Both Side", shortLabel: "2+2", color: "#14b8a6", gradient: ["#5eead4", "#14b8a6"] };
  }
  if (upper.includes("2-LANE")) {
    return { label: "2-Lane", shortLabel: "2L", color: "#22c55e", gradient: ["#86efac", "#22c55e"] };
  }
  return { label: name, shortLabel: "RD", color: "#94a3b8", gradient: ["#cbd5e1", "#94a3b8"] };
}

export type RoadCategoryDetail = {
  category: string;
  structureType: string;
  tcs: string;
  stretch: string;
  color: string;
};

/** Design / Schedule-B road category inventory for Active layers. */
export const ROAD_CATEGORY_DETAILS: RoadCategoryDetail[] = [
  {
    category: "6-Lane Divided (Elevated)",
    structureType: "Elevated Main Carriageway",
    tcs: "TCS-1",
    stretch: "CH 0.000–17.488",
    color: "#3b82f6",
  },
  {
    category: "6-Lane Grade-Separated",
    structureType: "VUP / Grade-Separated Structure",
    tcs: "TCS-5 / TCS-6",
    stretch: "VUP approaches",
    color: "#2563eb",
  },
  {
    category: "4-Lane Divided",
    structureType: "Main Carriageway",
    tcs: "TCS-3 / TCS-4",
    stretch: "CH 17.488–35.215",
    color: "#22c55e",
  },
  {
    category: "4-Lane Loop/Ramp",
    structureType: "Loop/Ramp with RE Wall",
    tcs: "TCS-8",
    stretch: "Trumpet at CH 34.532",
    color: "#14b8a6",
  },
  {
    category: "2-Lane Loop/Ramp",
    structureType: "Interchange Ramp",
    tcs: "TCS-2",
    stretch: "Interchanges",
    color: "#84cc16",
  },
  {
    category: "2-Lane Loop/Ramp with Retaining Wall",
    structureType: "Ramp",
    tcs: "TCS-7",
    stretch: "Interchanges",
    color: "#65a30d",
  },
];

const roadCategoryIconCache = new Map<string, L.DivIcon>();

export function createRoadCategoryIcon(name: string): L.DivIcon {
  const key = name.toUpperCase();
  const cached = roadCategoryIconCache.get(key);
  if (cached) return cached;

  const style = roadCategoryStyle(name);
  const icon = L.divIcon({
    className: "geovision-road-category-icon",
    html: `<div style="
      min-width:28px;height:28px;padding:0 5px;border-radius:14px;
      background:linear-gradient(135deg,${style.gradient[0]},${style.gradient[1]});
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;
      font-size:9px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;
      white-space:nowrap;
    ">${style.shortLabel}</div>`,
    iconSize: [32, 28],
    iconAnchor: [16, 14],
    popupAnchor: [0, -14],
    tooltipAnchor: [16, -12],
  });
  roadCategoryIconCache.set(key, icon);
  return icon;
}
