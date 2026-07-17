import { useEffect, useRef } from "react";
import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  Credit,
  EllipsoidTerrainProvider,
  GeoJsonDataSource,
  HeightReference,
  Ion,
  JulianDate,
  Math as CesiumMath,
  PointGraphics,
  Rectangle,
  UrlTemplateImageryProvider,
  Viewer,
  createWorldTerrainAsync,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  DEFAULT_ELEVATION_VISIBILITY,
  type ElevationPoint,
  type ElevationSeriesVisibility,
} from "./ElevationGraphModal";
import type { Project } from "../lib/types";
import type { ContoursData } from "../lib/contours";
import { highwayStyle, type RoadNetworkData } from "../lib/roadNetwork";
import type { RailwayLinesData, RailwayPlatformsData, RailwayStationsData } from "../lib/railway";
import type { SubstationsData, TransmissionLinesData, TransmissionTowersData } from "../lib/transmission";
import type { WaterBodiesData } from "../lib/waterBodies";
import type { LulcData } from "../lib/lulc";
import type { TreesData } from "../lib/trees";
import type { AffectedHousesData } from "../lib/affectedHouses";
import type { FloodScene } from "../lib/flood";
import { structureColor } from "../lib/scheduleB";

type LineFeat = {
  coords: number[][];
  stroke: string;
  weight: number;
  name?: string;
  folder?: string;
};

type MapPt = { name: string; lon: number; lat: number };
type StructurePt = {
  label: string;
  type: string;
  lon: number;
  lat: number;
  chainage_km: number;
};
type SbLine = {
  positions: [number, number][]; // [lat, lon]
  label: string;
};
type RoadFormationLine = {
  positions: [number, number, number?][]; // [lat, lon, formation level m]
  label: string;
  color: string;
};
type BoreholePt = { id: string; lat: number; lon: number; name?: string };

export type Map3DOverlays = Record<string, boolean>;

type Props = {
  project: Project | null;
  overlays: Map3DOverlays;
  showElevation: boolean;
  elevationVisibility?: ElevationSeriesVisibility;
  lineFeatures: LineFeat[];
  elevationPoints: ElevationPoint[];
  contours1m: ContoursData | null;
  contours05m: ContoursData | null;
  chainagePoints: MapPt[];
  tollPlazaPoints: MapPt[];
  roadCategoryPoints: MapPt[];
  structureMarkers: StructurePt[];
  sbLines: {
    elevated: SbLine[];
    service_roads: SbLine[];
    re_walls: SbLine[];
    drains: SbLine[];
    ramps: SbLine[];
    paved_shoulders: SbLine[];
  };
  roadNetwork: RoadNetworkData | null;
  railwayLines: RailwayLinesData | null;
  railwayStations: RailwayStationsData | null;
  railwayPlatforms: RailwayPlatformsData | null;
  transmissionLines: TransmissionLinesData | null;
  substations: SubstationsData | null;
  transmissionTowers: TransmissionTowersData | null;
  waterBodies: WaterBodiesData | null;
  waterways: WaterBodiesData | null;
  lulcData: LulcData | null;
  treesData: TreesData | null;
  affectedHouses: AffectedHousesData | null;
  floodScene: FloodScene | null;
  boreholes: BoreholePt[];
  roadFormationLines: RoadFormationLine[];
  className?: string;
};

const EMPTY_FC = { type: "FeatureCollection" as const, features: [] as object[] };

function ionToken(): string {
  return (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined)?.trim() ?? "";
}

function propValue<T>(
  entity: { properties?: { [key: string]: { getValue?: (time: JulianDate) => T } | T } | undefined },
  key: string,
  fallback: T,
): T {
  const raw = entity.properties?.[key];
  if (raw == null) return fallback;
  if (typeof raw === "object" && typeof (raw as { getValue?: unknown }).getValue === "function") {
    const v = (raw as { getValue: (time: JulianDate) => T }).getValue(JulianDate.now());
    return v ?? fallback;
  }
  return (raw as T) ?? fallback;
}

function pointsFc(pts: MapPt[], kind: string) {
  return {
    type: "FeatureCollection" as const,
    features: pts.map((p, i) => ({
      type: "Feature" as const,
      properties: { id: `${kind}-${i}`, name: p.name, kind },
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
    })),
  };
}

function sbFc(lines: SbLine[], color: string) {
  return {
    type: "FeatureCollection" as const,
    features: lines.map((f, i) => ({
      type: "Feature" as const,
      properties: { id: i, name: f.label, stroke: color, weight: 4 },
      geometry: {
        type: "LineString" as const,
        coordinates: f.positions.map(([lat, lon]) => [lon, lat]),
      },
    })),
  };
}

function alignmentFc(lineFeatures: LineFeat[]) {
  return {
    type: "FeatureCollection" as const,
    features: lineFeatures.map((line, i) => ({
      type: "Feature" as const,
      properties: {
        id: i,
        name: line.name ?? line.folder ?? "Alignment",
        stroke: line.stroke || "#c026d3",
        weight: line.weight || 3,
      },
      geometry: { type: "LineString" as const, coordinates: line.coords },
    })),
  };
}

const ELEV_BRANCH_STYLES: Record<string, { label: string; color: string }> = {
  lhs: { label: "LHS (30 m)", color: "#3b82f6" },
  centerline: { label: "Centre line", color: "#12c9b0" },
  rhs: { label: "RHS (30 m)", color: "#f59e0b" },
};

function elevBranchCoords(points: ElevationPoint[], branch: string): [number, number, number][] {
  const sorted = points
    .filter((p) => (p.branch ?? "centerline") === branch)
    .filter(
      (p) =>
        p.latitude != null &&
        p.longitude != null &&
        Number.isFinite(p.elevation) &&
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude),
    )
    .sort((a, b) => Number(a.chainage) - Number(b.chainage));
  if (!sorted.length) return [];
  const step = Math.max(1, Math.floor(sorted.length / 600));
  const coords: [number, number, number][] = [];
  for (let i = 0; i < sorted.length; i += step) {
    const p = sorted[i];
    coords.push([p.longitude as number, p.latitude as number, Number(p.elevation)]);
  }
  if ((sorted.length - 1) % step !== 0) {
    const p = sorted[sorted.length - 1];
    coords.push([p.longitude as number, p.latitude as number, Number(p.elevation)]);
  }
  return coords;
}

/** Centre + LHS + RHS ground elevation ribbons for 3D. */
function elevFc(points: ElevationPoint[], visibility: ElevationSeriesVisibility) {
  const features: object[] = [];
  for (const branch of ["lhs", "centerline", "rhs"] as const) {
    if (!visibility[branch]) continue;
    const coords = elevBranchCoords(points, branch);
    if (coords.length < 2) continue;
    const style = ELEV_BRANCH_STYLES[branch];
    features.push({
      type: "Feature",
      properties: {
        name: style.label,
        stroke: style.color,
        weight: branch === "centerline" ? 3.5 : 2.5,
        branch,
      },
      geometry: { type: "LineString", coordinates: coords },
    });
  }
  return { type: "FeatureCollection" as const, features };
}

function contoursFc(data: ContoursData | null | undefined) {
  if (!data?.features?.length) return EMPTY_FC;
  const stride = data.features.length > 500 ? 2 : 1;
  return {
    type: "FeatureCollection" as const,
    features: data.features
      .filter((_, i) => i % stride === 0)
      .map((f) => ({
        type: "Feature" as const,
        properties: { elevation: f.properties.elevation, stroke: "#38bdf8", weight: 1 },
        geometry: f.geometry,
      })),
  };
}

function treesFc(data: TreesData | null) {
  const trees = data?.trees ?? [];
  if (!trees.length) return EMPTY_FC;
  const stride = Math.max(1, Math.ceil(trees.length / 2500));
  return {
    type: "FeatureCollection" as const,
    features: trees
      .filter((_, i) => i % stride === 0)
      .map((t) => ({
        type: "Feature" as const,
        properties: { name: t.id, kind: "tree" },
        geometry: { type: "Point" as const, coordinates: [t.lon, t.lat] },
      })),
  };
}

function floodFc(scene: FloodScene | null) {
  const pts = scene?.points ?? [];
  if (!pts.length) return EMPTY_FC;
  const stride = Math.max(1, Math.ceil(pts.length / 3000));
  return {
    type: "FeatureCollection" as const,
    features: pts
      .filter((_, i) => i % stride === 0)
      .map((p, i) => ({
        type: "Feature" as const,
        properties: {
          name: p.class === "flood" ? "Flood" : "Water",
          kind: p.class,
          fill: p.class === "flood" ? "#f97316" : "#0ea5e9",
        },
        geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      })),
  };
}

function styleLines(
  ds: GeoJsonDataSource,
  opts: { defaultColor: string; width?: number; clamp?: boolean; dash?: boolean },
) {
  for (const entity of ds.entities.values) {
    if (!entity.polyline) continue;
    const stroke = String(propValue(entity, "stroke", opts.defaultColor));
    const weight = Number(propValue(entity, "weight", opts.width ?? 3)) || (opts.width ?? 3);
    const name = String(propValue(entity, "name", ""));
    if (name) entity.name = name;
    entity.polyline.width = new ConstantProperty(Math.min(8, Math.max(1, weight)));
    try {
      entity.polyline.material = new ColorMaterialProperty(Color.fromCssColorString(stroke));
    } catch {
      entity.polyline.material = new ColorMaterialProperty(Color.fromCssColorString(opts.defaultColor));
    }
    entity.polyline.clampToGround = new ConstantProperty(opts.clamp !== false);
  }
}

function styleRoadNetwork(ds: GeoJsonDataSource) {
  for (const entity of ds.entities.values) {
    if (!entity.polyline) continue;
    const hw = String(propValue(entity, "highway", "unknown"));
    const s = highwayStyle(hw);
    const name = String(propValue(entity, "name", s.label));
    entity.name = name || s.label;
    entity.polyline.width = new ConstantProperty(s.weight);
    entity.polyline.material = new ColorMaterialProperty(Color.fromCssColorString(s.color));
    entity.polyline.clampToGround = new ConstantProperty(true);
  }
}

function stylePolygons(
  ds: GeoJsonDataSource,
  opts: { fill: string; stroke: string; fillAlpha?: number },
) {
  for (const entity of ds.entities.values) {
    const name = String(propValue(entity, "name", propValue(entity, "class", "")));
    if (name) entity.name = name;
    const fill = String(propValue(entity, "color", opts.fill));
    if (entity.polygon) {
      try {
        entity.polygon.material = new ColorMaterialProperty(
          Color.fromCssColorString(fill).withAlpha(opts.fillAlpha ?? 0.45),
        );
      } catch {
        entity.polygon.material = new ColorMaterialProperty(
          Color.fromCssColorString(opts.fill).withAlpha(opts.fillAlpha ?? 0.45),
        );
      }
      entity.polygon.outline = new ConstantProperty(true);
      entity.polygon.outlineColor = new ConstantProperty(Color.fromCssColorString(opts.stroke));
      entity.polygon.heightReference = new ConstantProperty(HeightReference.CLAMP_TO_GROUND);
    }
  }
}

function stylePoints(ds: GeoJsonDataSource, color: string, size = 8) {
  for (const entity of ds.entities.values) {
    const name = String(propValue(entity, "name", ""));
    if (name) entity.name = name;
    const fill = String(propValue(entity, "fill", color));
    if (entity.billboard) {
      entity.billboard.show = new ConstantProperty(false);
    }
    let c: Color;
    try {
      c = Color.fromCssColorString(fill);
    } catch {
      c = Color.fromCssColorString(color);
    }
    entity.point = new PointGraphics({
      pixelSize: size,
      color: c,
      outlineColor: Color.WHITE,
      outlineWidth: 1,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  }
}

function styleStructures(ds: GeoJsonDataSource) {
  for (const entity of ds.entities.values) {
    const type = String(propValue(entity, "type", ""));
    const name = String(propValue(entity, "name", "Structure"));
    entity.name = name;
    const fill = structureColor(type);
    if (entity.billboard) {
      entity.billboard.show = new ConstantProperty(false);
    }
    entity.point = new PointGraphics({
      pixelSize: 10,
      color: Color.fromCssColorString(fill),
      outlineColor: Color.WHITE,
      outlineWidth: 1.5,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  }
}

async function upsert(
  viewer: Viewer,
  name: string,
  geojson: object,
  style: (ds: GeoJsonDataSource) => void,
  clampToGround = true,
) {
  const existing = viewer.dataSources.getByName(name);
  for (const ds of existing) viewer.dataSources.remove(ds, true);
  const features = (geojson as { features?: unknown[] }).features;
  if (!features?.length) return;
  const ds = await GeoJsonDataSource.load(geojson, {
    clampToGround,
    stroke: Color.WHITE,
    strokeWidth: 2,
    markerSize: 24,
  });
  ds.name = name;
  style(ds);
  await viewer.dataSources.add(ds);
}

async function removeDs(viewer: Viewer, name: string) {
  const existing = viewer.dataSources.getByName(name);
  for (const ds of existing) viewer.dataSources.remove(ds, true);
}

/** Bounding rectangle (padded) that frames the whole project, if known. */
function projectRectangle(
  project: Project | null,
  lineFeatures: LineFeat[],
): Rectangle | null {
  let minLon: number;
  let minLat: number;
  let maxLon: number;
  let maxLat: number;

  if (project?.stats?.bounds) {
    [minLon, minLat, maxLon, maxLat] = project.stats.bounds;
  } else {
    const coords = lineFeatures.flatMap((l) => l.coords);
    if (!coords.length) return null;
    minLon = maxLon = coords[0][0];
    minLat = maxLat = coords[0][1];
    for (const [lon, lat] of coords) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  const padLon = Math.max((maxLon - minLon) * 0.15, 0.01);
  const padLat = Math.max((maxLat - minLat) * 0.15, 0.01);
  return Rectangle.fromDegrees(
    minLon - padLon,
    minLat - padLat,
    maxLon + padLon,
    maxLat + padLat,
  );
}

/**
 * Rotate the globe in from space, then settle on a view that frames the whole
 * project extent.
 */
function flyToProject(viewer: Viewer, project: Project | null, lineFeatures: LineFeat[]) {
  const rect = projectRectangle(project, lineFeatures);
  if (!rect || viewer.isDestroyed()) return;

  const centerLon = CesiumMath.toDegrees((rect.west + rect.east) / 2);
  const centerLat = CesiumMath.toDegrees((rect.south + rect.north) / 2);

  try {
    viewer.camera.cancelFlight();
  } catch {
    /* no active flight */
  }

  // Start high in space, offset ~90° west so the globe visibly rotates in.
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(
      centerLon - 90,
      Math.max(-35, Math.min(35, centerLat * 0.4)),
      20_000_000,
    ),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
  });

  let settled = false;
  const settle = () => {
    if (settled || viewer.isDestroyed()) return;
    settled = true;
    // Frame the entire project extent (top-down fit of the bounding rectangle).
    viewer.camera.flyTo({ destination: rect, duration: 3 });
  };

  // Rotate the Earth toward the project at high altitude, then fit the extent.
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(centerLon, centerLat, 6_500_000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 3,
    complete: settle,
  });
}

/**
 * Cesium 3D globe — mirrors Map Explorer layer toggles.
 */
export default function Map3DView(props: Props) {
  const {
    project,
    overlays,
    showElevation,
    elevationVisibility = DEFAULT_ELEVATION_VISIBILITY,
    lineFeatures,
    elevationPoints,
    contours1m,
    contours05m,
    chainagePoints,
    tollPlazaPoints,
    roadCategoryPoints,
    structureMarkers,
    sbLines,
    roadNetwork,
    railwayLines,
    railwayStations,
    railwayPlatforms,
    transmissionLines,
    substations,
    transmissionTowers,
    waterBodies,
    waterways,
    lulcData,
    treesData,
    affectedHouses,
    floodScene,
    boreholes,
    roadFormationLines,
    className = "",
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const hasTerrainRef = useRef(false);
  const propsRef = useRef(props);
  propsRef.current = props;
  const flownRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    const token = ionToken();
    if (token) Ion.defaultAccessToken = token;

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: true,
      sceneModePicker: true,
      navigationHelpButton: true,
      fullscreenButton: true,
      infoBox: true,
      selectionIndicator: true,
      terrainProvider: new EllipsoidTerrainProvider(),
      baseLayer: false,
    });
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.fog.enabled = true;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maximumLevel: 19,
        credit: new Credit("© Esri, Maxar, Earthstar Geographics"),
      }),
    );
    viewerRef.current = viewer;

    // Home button resets to the project extent instead of the global view.
    const homeCommand = viewer.homeButton?.viewModel?.command;
    if (homeCommand) {
      homeCommand.beforeExecute.addEventListener((e: { cancel: boolean }) => {
        e.cancel = true;
        const rect = projectRectangle(
          propsRef.current.project,
          propsRef.current.lineFeatures,
        );
        if (rect && !viewer.isDestroyed()) {
          viewer.camera.flyTo({ destination: rect, duration: 1.5 });
        }
      });
    }

    void (async () => {
      if (token) {
        try {
          viewer.terrainProvider = await createWorldTerrainAsync();
          hasTerrainRef.current = true;
        } catch {
          hasTerrainRef.current = false;
        }
      }
      await syncAll(viewer, propsRef.current, hasTerrainRef.current);
      if (!flownRef.current) {
        flyToProject(viewer, propsRef.current.project, propsRef.current.lineFeatures);
        flownRef.current = true;
      }
    })();

    const ro = new ResizeObserver(() => viewer.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    void syncAll(viewer, props, hasTerrainRef.current);
  }, [
    overlays,
    showElevation,
    elevationVisibility,
    lineFeatures,
    elevationPoints,
    contours1m,
    contours05m,
    chainagePoints,
    tollPlazaPoints,
    roadCategoryPoints,
    structureMarkers,
    sbLines,
    roadNetwork,
    railwayLines,
    railwayStations,
    railwayPlatforms,
    transmissionLines,
    substations,
    transmissionTowers,
    waterBodies,
    waterways,
    lulcData,
    treesData,
    affectedHouses,
    floodScene,
    boreholes,
    roadFormationLines,
    project,
  ]);

  return (
    <div className={`relative h-full w-full ${className}`}>
      <div
        ref={containerRef}
        className="h-full w-full [&_.cesium-viewer]:h-full [&_.cesium-viewer-cesiumWidgetContainer]:h-full [&_.cesium-widget]:h-full [&_.cesium-widget>canvas]:h-full"
      />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[13rem] rounded-lg border border-white/10 bg-ink-950/85 px-2 py-1.5 text-[10px] text-slate-300 backdrop-blur-md">
        <div className="text-[10px] text-slate-400">
          Left-drag rotate · Scroll zoom
        </div>
        {showElevation && (
          <div className="mt-1.5 space-y-0.5">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
              Ground elevation
            </div>
            {(
              Object.entries(ELEV_BRANCH_STYLES) as Array<
                [keyof typeof ELEV_BRANCH_STYLES, { color: string; label: string }]
              >
            )
              .filter(([branch]) => elevationVisibility[branch as "lhs" | "centerline" | "rhs"])
              .map(([, { color, label }]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-slate-300">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function syncAll(viewer: Viewer, p: Props, hasTerrain: boolean) {
  const o = p.overlays;

  // Alignment
  if (o.alignment) {
    await upsert(viewer, "3d-alignment", alignmentFc(p.lineFeatures), (ds) =>
      styleLines(ds, { defaultColor: "#c026d3" }),
    );
  } else await removeDs(viewer, "3d-alignment");

  // Corridor buffer (wider alignment)
  if (o.corridor) {
    await upsert(
      viewer,
      "3d-corridor",
      {
        type: "FeatureCollection",
        features: p.lineFeatures.map((line, i) => ({
          type: "Feature",
          properties: { name: "RoW buffer", stroke: "#38e1c6", weight: 10 },
          geometry: { type: "LineString", coordinates: line.coords },
        })),
      },
      (ds) => styleLines(ds, { defaultColor: "#38e1c6", width: 10 }),
    );
  } else await removeDs(viewer, "3d-corridor");

  // Ground elevation
  if (p.showElevation) {
    await upsert(
      viewer,
      "3d-elev",
      elevFc(p.elevationPoints, p.elevationVisibility ?? DEFAULT_ELEVATION_VISIBILITY),
      (ds) => styleLines(ds, { defaultColor: "#12c9b0", clamp: hasTerrain }),
      !hasTerrain ? false : true,
    );
  } else await removeDs(viewer, "3d-elev");

  // Contours
  if (o.contours_1m) {
    await upsert(viewer, "3d-c1", contoursFc(p.contours1m), (ds) =>
      styleLines(ds, { defaultColor: "#14b8a6", width: 1.2 }),
    );
  } else await removeDs(viewer, "3d-c1");
  if (o.contours_0_5m) {
    await upsert(viewer, "3d-c05", contoursFc(p.contours05m), (ds) =>
      styleLines(ds, { defaultColor: "#0ea5e9", width: 1 }),
    );
  } else await removeDs(viewer, "3d-c05");

  // Markers
  if (o.markers) {
    await upsert(viewer, "3d-chainage", pointsFc(p.chainagePoints, "chainage"), (ds) =>
      stylePoints(ds, "#3b82f6", 6),
    );
  } else await removeDs(viewer, "3d-chainage");

  if (o.toll_plazas) {
    await upsert(viewer, "3d-toll", pointsFc(p.tollPlazaPoints, "toll"), (ds) =>
      stylePoints(ds, "#f59e0b", 10),
    );
  } else await removeDs(viewer, "3d-toll");

  if (o.road_categories) {
    await upsert(viewer, "3d-roadcat", pointsFc(p.roadCategoryPoints, "roadcat"), (ds) =>
      stylePoints(ds, "#22c55e", 9),
    );
  } else await removeDs(viewer, "3d-roadcat");

  // Road network
  if (o.road_network && p.roadNetwork) {
    await upsert(viewer, "3d-roads", p.roadNetwork, styleRoadNetwork);
  } else await removeDs(viewer, "3d-roads");

  // Road formation level drawn at the workbook's design elevation.
  if (o.road_formation && p.roadFormationLines.length) {
    await upsert(
      viewer,
      "3d-roadformation",
      {
        type: "FeatureCollection",
        features: p.roadFormationLines.map((l, i) => ({
          type: "Feature",
          properties: { id: i, name: l.label, stroke: l.color, weight: 3 },
          geometry: {
            type: "LineString",
            coordinates: l.positions.map(([lat, lon, height]) => [
              lon,
              lat,
              height ?? 0,
            ]),
          },
        })),
      },
      (ds) =>
        styleLines(ds, {
          defaultColor: "#f59e0b",
          width: 3,
          clamp: false,
        }),
      false,
    );
  } else await removeDs(viewer, "3d-roadformation");

  // Railway
  if (o.railway_lines && p.railwayLines) {
    await upsert(viewer, "3d-rline", p.railwayLines, (ds) =>
      styleLines(ds, { defaultColor: "#e2e8f0", width: 2.5 }),
    );
  } else await removeDs(viewer, "3d-rline");

  if (o.railway_stations && p.railwayStations) {
    await upsert(
      viewer,
      "3d-rstat",
      {
        type: "FeatureCollection",
        features: p.railwayStations.features.map((f) => ({
          type: "Feature",
          properties: { name: f.properties.name, fill: "#f97316" },
          geometry: f.geometry,
        })),
      },
      (ds) => stylePoints(ds, "#f97316", 9),
    );
  } else await removeDs(viewer, "3d-rstat");

  if (o.railway_platforms && p.railwayPlatforms) {
    await upsert(viewer, "3d-rplat", p.railwayPlatforms, (ds) =>
      stylePolygons(ds, { fill: "#0f172a", stroke: "#38bdf8", fillAlpha: 0.75 }),
    );
  } else await removeDs(viewer, "3d-rplat");

  // Utilities
  if (o.transmission_lines && p.transmissionLines) {
    await upsert(viewer, "3d-tline", p.transmissionLines, (ds) =>
      styleLines(ds, { defaultColor: "#facc15", width: 3 }),
    );
  } else await removeDs(viewer, "3d-tline");

  if (o.substations && p.substations) {
    await upsert(viewer, "3d-sub", p.substations, (ds) =>
      stylePolygons(ds, { fill: "#854d0e", stroke: "#fbbf24", fillAlpha: 0.65 }),
    );
  } else await removeDs(viewer, "3d-sub");

  if (o.transmission_towers && p.transmissionTowers) {
    await upsert(
      viewer,
      "3d-tower",
      {
        type: "FeatureCollection",
        features: p.transmissionTowers.features.map((f) => ({
          type: "Feature",
          properties: { name: f.properties.name, fill: "#facc15" },
          geometry: f.geometry,
        })),
      },
      (ds) => stylePoints(ds, "#facc15", 7),
    );
  } else await removeDs(viewer, "3d-tower");

  // Schedule-B structures
  if (o.structures) {
    await upsert(
      viewer,
      "3d-struct",
      {
        type: "FeatureCollection",
        features: p.structureMarkers.map((s, i) => ({
          type: "Feature",
          properties: {
            name: `${s.label} · Ch ${s.chainage_km} km`,
            type: s.type,
          },
          geometry: { type: "Point", coordinates: [s.lon, s.lat] },
        })),
      },
      styleStructures,
    );
  } else await removeDs(viewer, "3d-struct");

  // Schedule-B corridor lines
  const sbMap: Array<[string, keyof Props["sbLines"], string]> = [
    ["3d-sb-elev", "elevated", "#4de8ff"], // ELEVATED_VIADUCT_COLOR
    ["3d-sb-ramp", "ramps", "#eab308"],
    ["3d-sb-srv", "service_roads", "#3b82f6"],
    ["3d-sb-rew", "re_walls", "#f97316"],
    ["3d-sb-drn", "drains", "#06b6d4"],
    ["3d-sb-psh", "paved_shoulders", "#94a3b8"],
  ];
  const sbOverlay: Record<string, string> = {
    "3d-sb-elev": "sb_elevated",
    "3d-sb-ramp": "sb_ramps",
    "3d-sb-srv": "sb_service_roads",
    "3d-sb-rew": "sb_re_walls",
    "3d-sb-drn": "sb_drains",
    "3d-sb-psh": "sb_paved_shoulders",
  };
  for (const [dsName, key, color] of sbMap) {
    if (o[sbOverlay[dsName]]) {
      await upsert(viewer, dsName, sbFc(p.sbLines[key], color), (ds) =>
        styleLines(ds, { defaultColor: color, width: 4 }),
      );
    } else await removeDs(viewer, dsName);
  }

  // Geotech
  if (o.boreholes) {
    await upsert(
      viewer,
      "3d-bh",
      {
        type: "FeatureCollection",
        features: p.boreholes.map((b) => ({
          type: "Feature",
          properties: { name: b.name || b.id, fill: "#a855f7" },
          geometry: { type: "Point", coordinates: [b.lon, b.lat] },
        })),
      },
      (ds) => stylePoints(ds, "#a855f7", 8),
    );
  } else await removeDs(viewer, "3d-bh");

  // Environment
  if (o.water_bodies && p.waterBodies) {
    await upsert(viewer, "3d-wb", p.waterBodies, (ds) =>
      stylePolygons(ds, { fill: "#38bdf8", stroke: "#0369a1", fillAlpha: 0.35 }),
    );
  } else await removeDs(viewer, "3d-wb");

  if (o.water_bodies && p.waterways) {
    await upsert(viewer, "3d-ww", p.waterways, (ds) =>
      stylePolygons(ds, { fill: "#0ea5e9", stroke: "#075985", fillAlpha: 0.45 }),
    );
  } else await removeDs(viewer, "3d-ww");

  if (o.lulc && p.lulcData) {
    await upsert(viewer, "3d-lulc", p.lulcData, (ds) =>
      stylePolygons(ds, { fill: "#33a02c", stroke: "#166534", fillAlpha: 0.4 }),
    );
  } else await removeDs(viewer, "3d-lulc");

  if (o.trees && p.treesData) {
    await upsert(viewer, "3d-trees", treesFc(p.treesData), (ds) => stylePoints(ds, "#22c55e", 4));
  } else await removeDs(viewer, "3d-trees");

  if (o.affected_houses && p.affectedHouses) {
    await upsert(viewer, "3d-houses", p.affectedHouses, (ds) =>
      stylePolygons(ds, { fill: "#ef4444", stroke: "#b91c1c", fillAlpha: 0.5 }),
    );
  } else await removeDs(viewer, "3d-houses");

  if (o.flood && p.floodScene) {
    await upsert(viewer, "3d-flood", floodFc(p.floodScene), (ds) => stylePoints(ds, "#0ea5e9", 4));
  } else await removeDs(viewer, "3d-flood");
}
