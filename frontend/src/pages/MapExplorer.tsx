import L from "leaflet";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Circle,
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  Activity,
  Building2,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  CloudRain,
  Compass,
  Crosshair,
  Droplets,
  Factory,
  Fence,
  GitBranch,
  Home,
  Info,
  LandPlot,
  Layers as LayersIcon,
  Box,
  MapPinned,
  Maximize2,
  MapPin,
  Milestone,
  Mountain,
  MountainSnow,
  Pentagon,
  Redo2,
  Route,
  Ruler,
  Trees,
  Undo2,
  TrainFront,
  TowerControl,
  Users,
  Waves,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ElevationGraphModal, {
  type ElevationPoint,
  type ElevationScrubSample,
  type ElevationSeriesVisibility,
  DEFAULT_ELEVATION_VISIBILITY,
} from "../components/ElevationGraphModal";
import RoadFormationGraphPanel, {
  type RoadFormationScrubSample,
  type RoadFormationSeriesVisibility,
  DEFAULT_ROAD_FORMATION_VISIBILITY,
} from "../components/RoadFormationGraphPanel";
import BoreholeCard from "../components/BoreholeCard";
import WeatherForecastModal from "../components/WeatherForecastModal";
import BaseMapSwitcher from "../components/BaseMapSwitcher";
import StreetViewModal from "../components/StreetViewModal";
import StreetViewPegman from "../components/StreetViewPegman";
import Map3DView from "../components/Map3DView";
import { STREET_VIEW_COVERAGE } from "../lib/streetView";
import { ANALYSIS_OVERLAYS, ANALYSIS_OVERLAY_GROUPS, BASEMAPS, type AnalysisOverlay } from "../lib/basemaps";
import { fetchProject } from "../lib/api";
import { useTopBarWeather } from "../lib/topBarWeather";
import { createChainageResolver, sampleChainageRange } from "../lib/chainage";
import { elevationMapSample, fetchElevationProfile } from "../lib/elevation";
import { fetchDesignHfl, type DesignHflPoint } from "../lib/designHfl";
import {
  MEASURE_TOOLS,
  bearingDeg,
  formatBearing,
  haversineKm,
  pathLengthKm,
  polygonAreaM2,
  type LatLon,
  type MeasureTool,
} from "../lib/measure";
import {
  ELEVATED_VIADUCT_COLOR,
  fetchElevatedScour,
  type ElevatedScourData,
} from "../lib/elevatedScour";
import {
  fetchGroundScour,
  groundScourDepthColor,
  groundScourZoneColor,
  summarizeGroundScour,
  type GroundScourData,
  type GroundScourPoint,
  type GroundScourSummary,
} from "../lib/groundScour";
import {
  fetchRoadFormation,
  summarizeRoadFormation,
  ROAD_FORMATION_BRANCH_COLORS,
  type RoadFormationData,
  type RoadFormationSummary,
} from "../lib/roadFormation";
import { fetchAffectedHouses, type AffectedHousesData } from "../lib/affectedHouses";
import { fetchWaterBodies, fetchWaterways, type WaterBodiesData } from "../lib/waterBodies";
import { fetchVillages, type VillagesData } from "../lib/villages";
import { fetchLulc, lulcSummaryInfo, type LulcData, type LulcSummaryInfo } from "../lib/lulc";
import { fetchBarrenLand, type BarrenLandData } from "../lib/barrenLand";
import { fetchContours05m, fetchContours1m, type ContoursData } from "../lib/contours";
import { fetchAdjacentRoads, type AdjacentRoadsData } from "../lib/adjacentRoads";
import { fetchRoadNetwork, highwayStyle, type RoadNetworkData } from "../lib/roadNetwork";
import {
  fetchRailwayLines,
  fetchRailwayPlatforms,
  fetchRailwayStations,
  railwayLinesSummary,
  railwayPlatformsSummary,
  railwayStationsSummary,
  RAILWAY_LINE_STYLE,
  RAILWAY_PLATFORM_STYLE,
  type RailwayLinesData,
  type RailwayLinesSummary,
  type RailwayPlatformsData,
  type RailwayPlatformsSummary,
  type RailwayStationsData,
  type RailwayStationsSummary,
} from "../lib/railway";
import {
  fetchSubstations,
  fetchTransmissionLines,
  fetchTransmissionTowers,
  SUBSTATION_STYLE,
  TRANSMISSION_LINE_STYLE,
  type SubstationsData,
  type TransmissionLinesData,
  type TransmissionTowersData,
} from "../lib/transmission";
import { fetchTrees, treesSummaryInfo, type TreesData, type TreesSummaryInfo } from "../lib/trees";
import { fetchFloodTimeseries, type FloodData } from "../lib/flood";
import TreesLayer from "../components/TreesLayer";
import ContoursLayer from "../components/ContoursLayer";
import FloodLayer from "../components/FloodLayer";
import FloodTimeSeriesPanel from "../components/FloodTimeSeriesPanel";
import ChainageLayer from "../components/ChainageLayer";
import { boreholeSummary, fetchGeotech, type Borehole, type GeotechData } from "../lib/geotech";
import {
  createAdjacentRoadIcon,
  createRoadCategoryIcon,
  createStructureIcon,
  createTollPlazaIcon,
  isRoadCategoryName,
  roadCategoryStyle,
  ROAD_CATEGORY_DETAILS,
  type RoadCategoryDetail,
  structureIconFile,
  structureIconUrl,
} from "../lib/mapIcons";
import {
  drainInfo,
  elevatedStructureInfo,
  projectAlignmentInfo,
  scheduleBFromStats,
  serviceRoadInfo,
  shoulderInfo,
  structureColor,
  structuresPointsInfo,
  structureTypeLabel,
  type DrainInfo,
  type ElevatedStructureInfo,
  type ProjectAlignmentInfo,
  type ScheduleBStructure,
  type ServiceRoadInfo,
  type ShoulderInfo,
  type StructuresPointsInfo,
} from "../lib/scheduleB";
import {
  fetchReWalls,
  reWallLocationsSummary,
  type ReWallLocationSummary,
  type ReWallsData,
} from "../lib/reWalls";
import {
  fetchInterchanges,
  interchangesSummary,
  type InterchangeSummary,
  type InterchangesData,
} from "../lib/interchanges";
import type { Project } from "../lib/types";

type MapPoint = {
  name: string;
  kind: string;
  coord: [number, number];
  lon: number;
  lat: number;
  alt?: number;
  properties: Record<string, unknown>;
};

type SbLineFeature = {
  positions: [number, number][];
  from: number;
  to: number;
  label: string;
  details: Record<string, unknown>;
  color?: string;
};

const DEFAULT_OVERLAYS: Record<string, boolean> = {
    alignment: true,
    markers: false,
    structures: true,
  toll_plazas: false,
  road_categories: false,
  road_network: false,
  adjacent_roads: false,
  railway_lines: false,
  railway_stations: false,
  railway_platforms: false,
  transmission_lines: false,
  substations: false,
  transmission_towers: false,
  sb_elevated: false,
    sb_service_roads: false,
    sb_re_walls: false,
    sb_drains: false,
    sb_ramps: false,
    sb_paved_shoulders: false,
  boreholes: false,
  water_bodies: false,
  lulc: false,
  barren_land: false,
  trees: false,
  contours_1m: false,
  contours_0_5m: false,
  villages: false,
  affected_houses: false,
  flood: false,
  ground_scour: false,
  road_formation: false,
      corridor: false,
      slope: false,
    };

/** Overlays allowed in 3D view — everything else is forced off. */
const MAP_3D_OVERLAY_IDS = new Set(["alignment"]);

function overlaysFor3d(current: Record<string, boolean>): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const id of Object.keys(current)) {
    next[id] = MAP_3D_OVERLAY_IDS.has(id);
  }
  next.alignment = true;
  return next;
}

/**
 * Run async tasks with a bounded number in flight at once.
 *
 * Browsers cap concurrent connections per host (~6 on HTTP/1.1); firing every
 * layer fetch simultaneously makes the queued ones wait while their
 * AbortSignal.timeout keeps ticking, so slower requests spuriously abort and a
 * layer silently fails to load. Limiting concurrency starts each request's
 * timeout only when it actually begins, so nothing aborts while merely queued.
 */
async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  limit = 5,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    async () => {
      while (cursor < tasks.length) {
        const index = cursor++;
        try {
          await tasks[index]();
        } catch {
          // Individual fetchers already handle their own failures.
        }
      }
    },
  );
  await Promise.all(workers);
}

export default function MapExplorer() {
  const [project, setProject] = useState<Project | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [baseId, setBaseId] = useState("google-satellite");
  const [opacity, setOpacity] = useState(0.7);
  const [showElevation, setShowElevation] = useState(false);
  const [elevationVisibility, setElevationVisibility] =
    useState<ElevationSeriesVisibility>(DEFAULT_ELEVATION_VISIBILITY);
  const [showRoadFormationGraph, setShowRoadFormationGraph] = useState(false);
  const [roadFormationVisibility, setRoadFormationVisibility] =
    useState<RoadFormationSeriesVisibility>(DEFAULT_ROAD_FORMATION_VISIBILITY);
  const [roadFormationScrub, setRoadFormationScrub] =
    useState<RoadFormationScrubSample | null>(null);
  const [showWeather, setShowWeather] = useState(false);
  const topBarWeather = useTopBarWeather();
  const [elevationPoints, setElevationPoints] = useState<ElevationPoint[]>([]);
  const [designHflPoints, setDesignHflPoints] = useState<DesignHflPoint[]>([]);
  const [geotech, setGeotech] = useState<GeotechData | null>(null);
  const [affectedHouses, setAffectedHouses] = useState<AffectedHousesData | null>(null);
  const [elevatedScour, setElevatedScour] = useState<ElevatedScourData | null>(null);
  const [groundScour, setGroundScour] = useState<GroundScourData | null>(null);
  const [roadFormation, setRoadFormation] = useState<RoadFormationData | null>(null);
  const [hoveredGroundScour, setHoveredGroundScour] = useState<GroundScourPoint | null>(null);
  const [groundScourCursor, setGroundScourCursor] = useState<{ x: number; y: number } | null>(null);
  const [waterBodies, setWaterBodies] = useState<WaterBodiesData | null>(null);
  const [waterways, setWaterways] = useState<WaterBodiesData | null>(null);
  const [villagesData, setVillagesData] = useState<VillagesData | null>(null);
  const [lulcData, setLulcData] = useState<LulcData | null>(null);
  const [barrenLand, setBarrenLand] = useState<BarrenLandData | null>(null);
  const [reWalls, setReWalls] = useState<ReWallsData | null>(null);
  const [interchanges, setInterchanges] = useState<InterchangesData | null>(null);
  const [contours1m, setContours1m] = useState<ContoursData | null>(null);
  const [contours05m, setContours05m] = useState<ContoursData | null>(null);
  const [roadNetwork, setRoadNetwork] = useState<RoadNetworkData | null>(null);
  const [adjacentRoads, setAdjacentRoads] = useState<AdjacentRoadsData | null>(null);
  const [railwayLines, setRailwayLines] = useState<RailwayLinesData | null>(null);
  const [railwayStations, setRailwayStations] = useState<RailwayStationsData | null>(null);
  const [railwayPlatforms, setRailwayPlatforms] = useState<RailwayPlatformsData | null>(null);
  const [transmissionLines, setTransmissionLines] = useState<TransmissionLinesData | null>(null);
  const [substations, setSubstations] = useState<SubstationsData | null>(null);
  const [transmissionTowers, setTransmissionTowers] = useState<TransmissionTowersData | null>(null);
  const [treesData, setTreesData] = useState<TreesData | null>(null);
  const [floodData, setFloodData] = useState<FloodData | null>(null);
  const [floodDate, setFloodDate] = useState<string | null>(null);
  const [showFloodPanel, setShowFloodPanel] = useState(false);
  const [selectedBorehole, setSelectedBorehole] = useState<Borehole | null>(null);
  const [overlays, setOverlays] = useState<Record<string, boolean>>(DEFAULT_OVERLAYS);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const sections: Record<string, boolean> = {};
    for (const group of ANALYSIS_OVERLAY_GROUPS) {
      sections[group] = false;
    }
    return sections;
  });
  const [mapControlsOpen, setMapControlsOpen] = useState(true);
  const [projectOverviewOpen, setProjectOverviewOpen] = useState(true);
  const [baseMapOpen, setBaseMapOpen] = useState(false);
  const [activeLayersOpen, setActiveLayersOpen] = useState(true);
  const layersSectionRef = useRef<HTMLDivElement>(null);
  /** Which active-layer accordion is open on the right panel (`null` = all collapsed). */
  const [expandedActiveLayerId, setExpandedActiveLayerId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d");
  const overlaysBefore3dRef = useRef<{
    overlays: Record<string, boolean>;
    showElevation: boolean;
  } | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [mapScaleLabel, setMapScaleLabel] = useState("—");
  const [measureTool, setMeasureTool] = useState<MeasureTool | null>(null);
  const [measureMenuOpen, setMeasureMenuOpen] = useState(false);
  const [measurePts, setMeasurePts] = useState<LatLon[]>([]);
  const [measurePast, setMeasurePast] = useState<LatLon[][]>([]);
  const [measureFuture, setMeasureFuture] = useState<LatLon[][]>([]);
  const measure = measureTool != null;
  const canMeasureUndo = measurePast.length > 0;
  const canMeasureRedo = measureFuture.length > 0;
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [streetViewDragging, setStreetViewDragging] = useState(false);
  const [streetViewPoint, setStreetViewPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [elevationFocus, setElevationFocus] = useState<{
    lat: number;
    lon: number;
    chainage: number;
    elevation: number;
  } | null>(null);
  const [elevationCrossSection, setElevationCrossSection] = useState<Array<{
    lat: number;
    lon: number;
    elevation: number;
    branch: string;
    chainage: number;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const set = <T,>(setter: (v: T) => void) => (v: T) => {
      if (!cancelled) setter(v);
    };
    const tasks: Array<() => Promise<void>> = [
      () => fetchProject("demo").then(set(setProject)),
      () => fetchElevationProfile().then(set(setElevationPoints)),
      () => fetchDesignHfl().then(set(setDesignHflPoints)),
      () => fetchGeotech().then(set(setGeotech)),
      () => fetchAffectedHouses().then(set(setAffectedHouses)),
      () => fetchElevatedScour().then(set(setElevatedScour)),
      () => fetchGroundScour().then(set(setGroundScour)),
      () => fetchRoadFormation().then(set(setRoadFormation)),
      () => fetchWaterBodies().then(set(setWaterBodies)),
      () => fetchWaterways().then(set(setWaterways)),
      () => fetchVillages().then(set(setVillagesData)),
      () => fetchLulc().then(set(setLulcData)),
      () => fetchBarrenLand().then(set(setBarrenLand)),
      () => fetchReWalls().then(set(setReWalls)),
      () => fetchInterchanges().then(set(setInterchanges)),
      () => fetchContours1m().then(set(setContours1m)),
      () => fetchContours05m().then(set(setContours05m)),
      () => fetchRoadNetwork().then(set(setRoadNetwork)),
      () => fetchAdjacentRoads().then(set(setAdjacentRoads)),
      () => fetchRailwayLines().then(set(setRailwayLines)),
      () => fetchRailwayStations().then(set(setRailwayStations)),
      () => fetchRailwayPlatforms().then(set(setRailwayPlatforms)),
      () => fetchTransmissionLines().then(set(setTransmissionLines)),
      () => fetchSubstations().then(set(setSubstations)),
      () => fetchTransmissionTowers().then(set(setTransmissionTowers)),
      () => fetchTrees().then(set(setTreesData)),
      () =>
        fetchFloodTimeseries().then((data) => {
          if (cancelled) return;
          setFloodData(data);
          if (data?.dates?.length) setFloodDate(data.dates[0]);
        }),
    ];
    runWithConcurrency(tasks, 5);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!overlays.ground_scour) {
      setHoveredGroundScour(null);
      setGroundScourCursor(null);
    }
  }, [overlays.ground_scour]);

  useEffect(() => {
    setShowRoadFormationGraph(!!overlays.road_formation);
    if (!overlays.road_formation) {
      setRoadFormationScrub(null);
      setRoadFormationVisibility(DEFAULT_ROAD_FORMATION_VISIBILITY);
    }
  }, [overlays.road_formation]);

  // Opening the flood overlay also opens the time-series panel
  useEffect(() => {
    if (overlays.flood && floodData?.dates.length) {
      setShowFloodPanel(true);
      if (!floodDate) setFloodDate(floodData.dates[0]);
    }
  }, [overlays.flood]); // eslint-disable-line react-hooks/exhaustive-deps

  const floodScene = useMemo(() => {
    if (!floodData || !floodDate) return null;
    return floodData.scenes[floodDate] ?? null;
  }, [floodData, floodDate]);

  const boreholes = useMemo(
    () => (geotech?.boreholes ?? []).filter((b) => b.lat != null && b.lon != null),
    [geotech],
  );

  const base = BASEMAPS.find((b) => b.id === baseId)!;

  const { lineFeatures, chainageTickLines, points } = useMemo(() => {
    const lineFeatures: Array<{
      coords: number[][];
      stroke: string;
      weight: number;
      lengthKm: number;
      name?: string;
      folder?: string;
    }> = [];
    const chainageTickLines: Array<{
      coords: number[][];
      stroke: string;
    }> = [];
    const points: MapPoint[] = [];
    if (project?.geojson) {
      for (const f of project.geojson.features) {
        if (f.geometry.type === "LineString") {
          const props = f.properties ?? {};
          const coords = f.geometry.coordinates as number[][];
          // KMZ station ticks are short 2-point crossbars — keep them out of the main
          // alignment strokes (which force a min weight + fat hit strip).
          if (coords.length === 2) {
            const a = coords[0];
            const b = coords[1];
            const lenM = haversineKm(a[1], a[0], b[1], b[0]) * 1000;
            if (lenM < 90) {
              chainageTickLines.push({
                coords,
                stroke: String(props.stroke ?? "#e2e8f0"),
              });
              continue;
            }
          }
          lineFeatures.push({
            coords,
            stroke: String(props.stroke ?? "#c026d3"),
            weight: Number(props.stroke_width ?? 4) || 4,
            lengthKm: Number(props.length_km ?? 0) || 0,
            name: props.name != null ? String(props.name) : undefined,
            folder: props.folder != null ? String(props.folder) : undefined,
          });
        } else if (f.geometry.type === "Point") {
          const c = f.geometry.coordinates as number[];
          points.push({
            name: String(f.properties?.name ?? "Point"),
            kind: String(f.properties?.kind ?? "marker"),
            coord: [c[1], c[0]],
            lon: c[0],
            lat: c[1],
            alt: c.length > 2 ? c[2] : undefined,
            properties: f.properties ?? {},
          });
        }
      }
    }
    return { lineFeatures, chainageTickLines, points };
  }, [project]);

  const alignmentLegend = useMemo(() => {
    const map = new Map<
      string,
      { color: string; label: string; lengthKm: number; segmentCount: number; folder?: string }
    >();
    for (const line of lineFeatures) {
      const label = line.folder?.split(" / ").pop() ?? line.name ?? "Alignment";
      const existing = map.get(line.stroke);
      if (existing) {
        existing.lengthKm += line.lengthKm || 0;
        existing.segmentCount += 1;
      } else {
        map.set(line.stroke, {
          color: line.stroke,
          label,
          lengthKm: line.lengthKm || 0,
          segmentCount: 1,
          folder: line.folder,
        });
      }
    }
    return [...map.values()];
  }, [lineFeatures]);

  const primaryAlignmentFolder = useMemo(() => {
    const totals = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const line of lineFeatures) {
      if (!line.folder) continue;
      totals.set(line.folder, (totals.get(line.folder) ?? 0) + (line.lengthKm || 0));
      counts.set(line.folder, (counts.get(line.folder) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestLen = -1;
    for (const [folder, totalLen] of totals) {
      if (totalLen > bestLen) {
        best = folder;
        bestLen = totalLen;
      }
    }
    if (best) return best;
    // Fallback: choose the folder that appears most often.
    let bestCount = -1;
    for (const [folder, c] of counts) {
      if (c > bestCount) {
        best = folder;
        bestCount = c;
      }
    }
    return best;
  }, [lineFeatures]);

  const chainageGeojson = useMemo(() => {
    if (!project?.geojson) return project?.geojson;
    if (!primaryAlignmentFolder) return project.geojson;
    return {
      ...project.geojson,
      features: project.geojson.features.filter((f) => {
        if (f.geometry.type !== "LineString") return true;
        return String(f.properties?.folder ?? "") === primaryAlignmentFolder;
      }),
    };
  }, [project, primaryAlignmentFolder]);

  const chainagePoints = useMemo(
    () => points.filter((p) => /^\d+\+\d+$/.test(p.name)),
    [points]
  );

  /** All chainage markers (including LHS/RHS duplicates), sorted by station. */
  const sortedChainagePoints = useMemo(
    () =>
      [...chainagePoints].sort((a, b) => {
        const [ak, am] = a.name.split("+").map(Number);
        const [bk, bm] = b.name.split("+").map(Number);
        return ak - bk || am - bm;
      }),
    [chainagePoints],
  );

  const chainagePointsSummary = useMemo(() => {
    if (!sortedChainagePoints.length) return null;
    const first = sortedChainagePoints[0];
    const last = sortedChainagePoints[sortedChainagePoints.length - 1];
    return {
      totalCount: sortedChainagePoints.length,
      startChainage: first.name,
      endChainage: last.name,
    };
  }, [sortedChainagePoints]);

  const tollPlazaPoints = useMemo(
    () => points.filter((p) => /toll\s*plaza/i.test(p.name)),
    [points]
  );

  const tollPlazaSummary = useMemo(() => {
    if (!tollPlazaPoints.length) return null;

    const stations = sortedChainagePoints;

    const items = tollPlazaPoints.map((toll, index) => {
      let nearestLabel: string | null = null;
      let nearestKm: number | null = null;
      let distM: number | null = null;

      if (stations.length) {
        let best = Infinity;
        for (const s of stations) {
          const d = haversineKm(toll.lat, toll.lon, s.lat, s.lon) * 1000;
          if (d < best) {
            best = d;
            nearestLabel = s.name;
            const [ak, am] = s.name.split("+").map(Number);
            nearestKm = ak + am / 1000;
            distM = d;
          }
        }
      }

      return {
        id: `toll-${index + 1}`,
        index,
        label: toll.name !== "TOLL PLAZA" ? toll.name : `Toll Plaza ${index + 1}`,
        lat: toll.lat,
        lon: toll.lon,
        nearestChainage: nearestLabel,
        nearestChainageKm: nearestKm,
        distM,
      };
    });

    const byIndex = items.slice();
    items.sort((a, b) => {
      if (a.nearestChainageKm == null && b.nearestChainageKm == null) return 0;
      if (a.nearestChainageKm == null) return 1;
      if (b.nearestChainageKm == null) return -1;
      return a.nearestChainageKm - b.nearestChainageKm;
    });

    return { totalCount: items.length, items, byIndex };
  }, [tollPlazaPoints, sortedChainagePoints]);

  const roadCategoryPoints = useMemo(
    () => points.filter((p) => isRoadCategoryName(p.name)),
    [points]
  );

  const tollPlazaIcon = useMemo(() => createTollPlazaIcon(), []);
  const adjacentRoadIcon = useMemo(() => createAdjacentRoadIcon(), []);

  const scheduleB = useMemo(() => scheduleBFromStats(project?.stats ?? {}), [project]);

  const resolveChainage = useMemo(
    () => createChainageResolver(chainageGeojson),
    [chainageGeojson]
  );

  const structureMarkers = useMemo(() => {
    if (!scheduleB?.structures?.length) return [];
    const markers: Array<ScheduleBStructure & { coord: [number, number]; lon: number; lat: number }> = [];
    for (const s of scheduleB.structures) {
      const coord = resolveChainage(s.chainage_km);
      if (!coord) continue;
      markers.push({
        ...s,
        lon: coord[0],
        lat: coord[1],
        coord: [coord[1], coord[0]],
      });
    }
    return markers;
  }, [scheduleB, resolveChainage]);

  // Schedule-B linear corridor features drawn along the alignment.
  const sbLines = useMemo(() => {
    const build = (
      rows: Array<Record<string, unknown>> | undefined,
      opts: {
        fromKey?: string;
        toKey?: string;
        offset?: number;
        label: (r: Record<string, unknown>) => string;
      }
    ) => {
      if (!rows?.length) return [] as SbLineFeature[];
      const fromKey = opts.fromKey ?? "from_km";
      const toKey = opts.toKey ?? "to_km";
      const out: SbLineFeature[] = [];
      for (const r of rows) {
        const from = Number(r[fromKey]);
        const to = Number(r[toKey]);
        if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) continue;
        let positions = sampleChainageRange(resolveChainage, from, to);
        if (positions.length < 2) continue;
        if (opts.offset) positions = offsetPath(positions, opts.offset);
        out.push({ positions, from, to, label: opts.label(r), details: r });
      }
      return out;
    };

    return {
      elevated: (elevatedScour?.features ?? []).map((f) => ({
        positions: f.geometry.coordinates.map(
          ([lon, lat]) => [lat, lon] as [number, number],
        ),
        from: f.properties.from_km,
        to: f.properties.to_km,
        label: f.properties.name,
        details: {
          hydraulic_zone: f.properties.hydraulic_zone,
          from_km: f.properties.from_km,
          to_km: f.properties.to_km,
          length_km: f.properties.length_km,
          scour_min_m: f.properties.scour_min_m,
          scour_max_m: f.properties.scour_max_m,
          screening_points: f.properties.point_count,
          source: "Elevated Section Scour Screening",
        },
      })),
      service_roads: build(scheduleB?.service_roads, {
        offset: 0.00016,
        label: (r) => `Service Road ${r.from_km}–${r.to_km} km`,
      }),
      re_walls: build(scheduleB?.re_walls, {
        offset: -0.00012,
        label: (r) => `RE Wall ${r.from_km}–${r.to_km} km`,
      }),
      drains: build(scheduleB?.drains, {
        offset: 0.00024,
        label: (r) => `Drain ${r.from_km}–${r.to_km} km`,
      }),
      ramps: interchanges
        ? interchanges.features.map((f) => ({
            positions: f.geometry.coordinates.map(
              ([lon, lat]) => [lat, lon] as [number, number],
            ),
            from: 0,
            to: 0,
            label: f.properties.name,
            details: {
              length_km: f.properties.length_km,
              source: "Interchanges KML",
            },
          }))
        : build(scheduleB?.interchange_ramps, {
            offset: 0,
            label: (r) => String(r.description ?? r.interchange ?? "Ramp"),
          }),
      paved_shoulders: build(scheduleB?.paved_shoulders, {
        offset: -0.00024,
        label: (r) => `Paved Shoulder ${r.from_km}–${r.to_km} km`,
      }),
    };
  }, [scheduleB, resolveChainage, elevatedScour, interchanges]);

  const elevatedInfo = useMemo(
    () => elevatedStructureInfo(scheduleB),
    [scheduleB],
  );

  const serviceRoadSummary = useMemo(
    () => serviceRoadInfo(scheduleB),
    [scheduleB],
  );

  const reWallSummary = useMemo(
    () => reWallLocationsSummary(reWalls),
    [reWalls],
  );

  const interchangeSummary = useMemo(
    () => interchangesSummary(interchanges),
    [interchanges],
  );

  const drainSummary = useMemo(
    () => drainInfo(scheduleB),
    [scheduleB],
  );

  const shoulderSummary = useMemo(
    () => shoulderInfo(scheduleB),
    [scheduleB],
  );

  const structuresSummary = useMemo(
    () => structuresPointsInfo(scheduleB),
    [scheduleB],
  );

  const alignmentSummary = useMemo(
    () => projectAlignmentInfo(scheduleB),
    [scheduleB],
  );

  const overlayGroupBadges = useMemo(() => {
    const badges: Record<string, string> = {};
    for (const group of ANALYSIS_OVERLAY_GROUPS) {
      const activeCount = ANALYSIS_OVERLAYS.filter(
        (o) => o.group === group && overlays[o.id],
      ).length;
      if (activeCount > 0) badges[group] = String(activeCount);
    }
    return badges;
  }, [overlays]);

  const treesSummary = useMemo(() => treesSummaryInfo(treesData), [treesData]);

  const groundScourSummary = useMemo(
    () => summarizeGroundScour(groundScour),
    [groundScour],
  );

  const roadFormationSummary = useMemo(
    () => summarizeRoadFormation(roadFormation),
    [roadFormation],
  );

  const lulcSummary = useMemo(() => lulcSummaryInfo(lulcData), [lulcData]);

  const railwayLinesInfo = useMemo(
    () => railwayLinesSummary(railwayLines),
    [railwayLines],
  );
  const railwayStationsInfo = useMemo(
    () => railwayStationsSummary(railwayStations),
    [railwayStations],
  );
  const railwayPlatformsInfo = useMemo(
    () => railwayPlatformsSummary(railwayPlatforms),
    [railwayPlatforms],
  );

  /** SVG renderer so CSS blink animation works (map preferCanvas would otherwise draw canvas paths). */
  const blinkSvgRenderer = useMemo(() => L.svg({ padding: 0.5 }), []);
  /** Draw ground scour above the canvas overlay pane so markers stay visible; hover uses map proximity. */
  const groundScourSvgRenderer = useMemo(
    () => L.svg({ padding: 0.5, pane: "markerPane" }),
    [],
  );
  const layerBlinkBright = useLayerBlinkPulse(expandedActiveLayerId != null);

  /** Remount key suffix so a GeoJSON layer switches to the blink SVG renderer. */
  const blinkKey = (id: string) => (expandedActiveLayerId === id ? "blink" : "steady");
  /** Bump the stroke weight of a path style while its active-layer card is open. */
  const withBlink = (id: string, base: L.PathOptions): L.PathOptions =>
    expandedActiveLayerId === id ? { ...base, weight: (base.weight ?? 1) + 1.5 } : base;
  /**
   * Top-level GeoJSON options that force the SVG renderer + glow class on the
   * child paths (needed because the map uses preferCanvas). Spread onto <GeoJSON>.
   * Returned as `object` so the untyped `renderer`/`className` props pass through.
   */
  const blinkGeoJson = (id: string): object =>
    expandedActiveLayerId === id
      ? { renderer: blinkSvgRenderer, className: "active-layer-blink" }
      : {};

  const activeOverlayItems = useMemo(
    () => ANALYSIS_OVERLAYS.filter((o) => overlays[o.id]),
    [overlays],
  );

  useEffect(() => {
    if (expandedActiveLayerId && !overlays[expandedActiveLayerId]) {
      setExpandedActiveLayerId(null);
    }
  }, [overlays, expandedActiveLayerId]);

  const center: [number, number] = project
    ? [project.stats.center[1], project.stats.center[0]]
    : [25.61, 84.95];

  const weatherHudCoords = useMemo(
    () => ({ lat: center[0], lon: center[1] }),
    [center],
  );

  const { setCoords, clearCoords, registerOpenDetails } = topBarWeather;

  useEffect(() => {
    setCoords(weatherHudCoords.lat, weatherHudCoords.lon);
    registerOpenDetails(() => setShowWeather(true));
    return () => {
      clearCoords();
      registerOpenDetails(null);
    };
  }, [weatherHudCoords.lat, weatherHudCoords.lon, setCoords, clearCoords, registerOpenDetails]);

  const weatherModalCoords = useMemo(() => {
    if (cursor) return { lat: cursor[0], lon: cursor[1] };
    return { lat: center[0], lon: center[1] };
  }, [cursor, center]);

  const measureMeta = MEASURE_TOOLS.find((t) => t.id === measureTool) ?? null;

  const structureIconCache = useMemo(() => {
    const cache = new Map<string, L.Icon>();
    for (const s of structureMarkers) {
      const file = structureIconFile(s);
      if (file && !cache.has(file)) cache.set(file, createStructureIcon(file));
    }
    return cache;
  }, [structureMarkers]);

  const elevationGraphPoints = useMemo(
    () =>
      [...elevationPoints].sort(
        (a, b) => Number(a.chainage) - Number(b.chainage) || String(a.branch).localeCompare(String(b.branch)),
      ),
    [elevationPoints],
  );

  const roadFormationLines = useMemo(() => {
    if (!roadFormation) return [];
    const lines: Array<{
      positions: [number, number, number][];
      label: string;
      color: string;
    }> = [];

    for (const branch of roadFormation.branches) {
      if (
        roadFormationVisibility[branch.id as keyof RoadFormationSeriesVisibility] ===
        false
      ) {
        continue;
      }
      const color = ROAD_FORMATION_BRANCH_COLORS[branch.id] ?? "#f59e0b";
      let segment: [number, number, number][] = [];
      let previous: { lat: number; lon: number } | null = null;

      for (const point of branch.points) {
        if (
          previous &&
          haversineKm(previous.lat, previous.lon, point.lat, point.lon) > 0.15
        ) {
          if (segment.length > 1) {
            lines.push({ positions: segment, label: branch.name, color });
          }
          segment = [];
        }
        segment.push([
          point.lat,
          point.lon,
          point.formation_level_m ?? point.ground_elev_m ?? 0,
        ]);
        previous = point;
      }

      if (segment.length > 1) {
        lines.push({ positions: segment, label: branch.name, color });
      }
    }
    return lines;
  }, [roadFormation, roadFormationVisibility]);

  const elevationMapPoints = useMemo(() => {
    return elevationMapSample(elevationPoints, 1)
      .map((p) => {
        let lat = p.latitude;
        let lon = p.longitude;
        if (lat == null || lon == null) {
          const coord = resolveChainage(p.chainage);
          if (!coord) return null;
          lon = coord[0];
          lat = coord[1];
        }
        return { ...p, latitude: lat, longitude: lon };
      })
      .filter((p): p is ElevationPoint & { latitude: number; longitude: number } => p != null);
  }, [elevationPoints, resolveChainage]);

  const measureResult = useMemo(() => {
    if (!measureTool) return null;
    const pts = measurePts;
    if (measureTool === "distance") {
      if (pts.length < 2) return { lines: ["Click to add points along a path"] };
      const km = pathLengthKm(pts);
      return {
        lines: [
          `Distance: ${km.toFixed(4)} km (${(km * 1000).toFixed(1)} m)`,
          `${pts.length} points · click to add · Esc / ruler to exit`,
        ],
      };
    }
    if (measureTool === "area") {
      if (pts.length < 3) return { lines: [`Area · need ${3 - pts.length} more point(s)`] };
      const m2 = polygonAreaM2(pts);
      const ha = m2 / 10_000;
      return {
        lines: [
          `Area: ${m2.toLocaleString(undefined, { maximumFractionDigits: 0 })} m² · ${ha.toFixed(3)} ha`,
          `${pts.length} vertices · click to add`,
        ],
      };
    }
    if (measureTool === "bearing") {
      if (pts.length < 2) return { lines: ["Bearing · click start, then end"] };
      const deg = bearingDeg(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      const km = haversineKm(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      return {
        lines: [
          `Bearing: ${formatBearing(deg)}`,
          `Length: ${km.toFixed(4)} km · click to restart`,
        ],
      };
    }
    if (measureTool === "elev") {
      if (pts.length < 2) return { lines: ["Elevation Δ · click two survey points"] };
      const nearest = (lat: number, lon: number) => {
        let best: (typeof elevationMapPoints)[number] | null = null;
        let bestD = Infinity;
        for (const p of elevationMapPoints) {
          const d = haversineKm(lat, lon, p.latitude, p.longitude) * 1000;
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        return best && bestD <= 150 ? { p: best, distM: bestD } : null;
      };
      const a = nearest(pts[0][0], pts[0][1]);
      const b = nearest(pts[1][0], pts[1][1]);
      if (!a || !b) {
        return {
          lines: [
            !a && !b
              ? "No survey points within 150 m of clicks"
              : !a
                ? "No survey point near first click"
                : "No survey point near second click",
          ],
        };
      }
      const dElev = Number(b.p.elevation) - Number(a.p.elevation);
      return {
        lines: [
          `Elev Δ: ${dElev >= 0 ? "+" : ""}${dElev.toFixed(2)} m`,
          `${Number(a.p.elevation).toFixed(2)} → ${Number(b.p.elevation).toFixed(2)} m · ch ${a.p.chainage} → ${b.p.chainage}`,
        ],
      };
    }
    return null;
  }, [measureTool, measurePts, elevationMapPoints]);

  /** Fast lookup: branch + chainage → map point */
  const elevationPointIndex = useMemo(() => {
    const map = new Map<string, ElevationPoint & { latitude: number; longitude: number }>();
    for (const p of elevationMapPoints) {
      map.set(`${p.branch ?? "centerline"}:${p.chainage}`, p);
    }
    return map;
  }, [elevationMapPoints]);

  const [elevationScrubbing, setElevationScrubbing] = useState(false);

  const resetMeasureHistory = useCallback(() => {
    setMeasurePts([]);
    setMeasurePast([]);
    setMeasureFuture([]);
  }, []);

  const commitMeasurePts = useCallback((next: LatLon[] | ((prev: LatLon[]) => LatLon[])) => {
    setMeasurePts((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      setMeasurePast((past) => [...past, prev]);
      setMeasureFuture([]);
      return resolved;
    });
  }, []);

  const undoMeasure = useCallback(() => {
    setMeasurePast((past) => {
      if (!past.length) return past;
      const prev = past[past.length - 1];
      setMeasurePts((current) => {
        setMeasureFuture((future) => [current, ...future]);
        return prev;
      });
      return past.slice(0, -1);
    });
  }, []);

  const redoMeasure = useCallback(() => {
    setMeasureFuture((future) => {
      if (!future.length) return future;
      const [next, ...rest] = future;
      setMeasurePts((current) => {
        setMeasurePast((past) => [...past, current]);
        return next;
      });
      return rest;
    });
  }, []);

  const handleStreetViewDrop = useCallback((lat: number, lon: number) => {
    setMeasureTool(null);
    setMeasureMenuOpen(false);
    resetMeasureHistory();
    setStreetViewPoint({ lat, lon });
  }, [resetMeasureHistory]);

  const startMeasureTool = useCallback((tool: MeasureTool) => {
    setMeasureTool(tool);
    resetMeasureHistory();
    setMeasureMenuOpen(false);
    setElevationFocus(null);
    setElevationCrossSection(null);
    setSelectedBorehole(null);
  }, [resetMeasureHistory]);

  const exitMeasure = useCallback(() => {
    setMeasureTool(null);
    setMeasureMenuOpen(false);
    resetMeasureHistory();
  }, [resetMeasureHistory]);

  useEffect(() => {
    if (!measureTool && !measureMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        exitMeasure();
        setMeasureMenuOpen(false);
        return;
      }
      if (!measureTool) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undoMeasure();
      } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redoMeasure();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [measureTool, measureMenuOpen, exitMeasure, undoMeasure, redoMeasure]);

  const handleElevationPointClick = (point: ElevationPoint) => {
    const key = `${point.branch ?? "centerline"}:${point.chainage}`;
    const mapped =
      elevationPointIndex.get(key) ??
      elevationMapPoints.find(
      (p) =>
        p.chainage === point.chainage &&
          (point.branch == null || p.branch === point.branch),
    );
    if (!mapped) return;
    setElevationFocus({
      lat: mapped.latitude,
      lon: mapped.longitude,
      chainage: point.chainage,
      elevation: point.elevation,
    });
  };

  const handleElevationScrub = useCallback(
    (sample: ElevationScrubSample) => {
      setElevationScrubbing(!!sample.dragging);

      const resolve = (p?: ElevationPoint) => {
        if (!p) return null;
        const key = `${p.branch ?? "centerline"}:${p.chainage}`;
        const mapped = elevationPointIndex.get(key);
        if (mapped) {
          return {
            lat: mapped.latitude,
            lon: mapped.longitude,
            elevation: mapped.elevation,
            branch: mapped.branch ?? "centerline",
            chainage: mapped.chainage,
          };
        }
        if (p.latitude != null && p.longitude != null) {
          return {
            lat: p.latitude,
            lon: p.longitude,
            elevation: p.elevation,
            branch: p.branch ?? "centerline",
            chainage: p.chainage,
          };
        }
        return null;
      };

      const lhs = elevationVisibility.lhs ? resolve(sample.lhs) : null;
      const center = elevationVisibility.centerline ? resolve(sample.centerline) : null;
      const rhs = elevationVisibility.rhs ? resolve(sample.rhs) : null;
      const section = [lhs, center, rhs].filter(
        (x): x is NonNullable<typeof x> => x != null,
      );
      setElevationCrossSection(section.length ? section : null);

      const focusPt = center ?? lhs ?? rhs ?? resolve(sample.centerline);
      if (focusPt) {
        setElevationFocus({
          lat: focusPt.lat,
          lon: focusPt.lon,
          chainage: focusPt.chainage,
          elevation: focusPt.elevation,
        });
      }
    },
    [elevationPointIndex, elevationVisibility],
  );

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden pt-16">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left sidebar — map controls, project overview, layers */}
        <aside
          className={`flex shrink-0 flex-col overflow-hidden bg-[#0b0e14] transition-[width,border-color] duration-300 ease-out ${
            sidebarOpen ? "w-80 border-r border-white/10" : "w-0 border-r-0 border-transparent"
          }`}
          aria-hidden={!sidebarOpen}
        >
          <div className="flex w-80 min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            <SidebarSection
              title="MAP CONTROLS"
              open={mapControlsOpen}
              onToggle={() => setMapControlsOpen((v) => !v)}
            >
              <div className="grid grid-cols-4 gap-2">
                <MapControlBtn
                  icon={Box}
                  label="3D Map"
                  color="#12c9b0"
                  active={mapMode === "3d"}
                  onClick={() => {
                    if (mapMode === "2d") {
                      overlaysBefore3dRef.current = {
                        overlays: { ...overlays },
                        showElevation,
                      };
                      setOverlays(overlaysFor3d(overlays));
                      setShowElevation(true);
                      setShowFloodPanel(false);
                      setMapMode("3d");
                    } else {
                      const prev = overlaysBefore3dRef.current;
                      if (prev) {
                        setOverlays(prev.overlays);
                        setShowElevation(prev.showElevation);
                        if (!prev.showElevation) {
                          setElevationFocus(null);
                          setElevationCrossSection(null);
                        }
                      }
                      overlaysBefore3dRef.current = null;
                      setMapMode("2d");
                    }
                  }}
                />
                <MapControlBtn
                  icon={LayersIcon}
                  label="Layers"
                  color="#3b82f6"
                  onClick={() => {
                    layersSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
                <MapControlBtn
                  icon={Mountain}
                  label="Elevation"
                  color="#f59e0b"
                  active={showElevation}
                  disabled={!elevationPoints.length}
                  onClick={() => {
                    setShowElevation((v) => {
                      if (v) {
                        setElevationFocus(null);
                        setElevationCrossSection(null);
                      }
                      return !v;
                    });
                  }}
                />
                <MapControlBtn
                  icon={CloudRain}
                  label="Weather"
                  color="#facc15"
                  onClick={() => setShowWeather(true)}
                />
              </div>
            </SidebarSection>

            <SidebarSection
              title="PROJECT OVERVIEW"
              open={projectOverviewOpen}
              onToggle={() => setProjectOverviewOpen((v) => !v)}
            >
              {project && (
                <div className="rounded-xl border border-white/10 bg-[#161b22] p-3">
                  <div className="text-sm font-bold leading-snug text-white">{project.name}</div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {project.location}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
                    <OverviewStat
                      label="Length"
                      value={`${(alignmentSummary?.totalLengthKm ?? project.stats.total_length_km).toFixed(3)} km`}
                      color="#22c55e"
                    />
                    <OverviewStat
                      label="Structures"
                      value={(structuresSummary?.total ?? structureMarkers.length).toLocaleString()}
                      color="#60a5fa"
                    />
                    <OverviewStat
                      label="Chainage"
                      value={`${Math.round(alignmentSummary?.endChainageKm ?? project.stats.total_length_km)} km`}
                      color="#12c9b0"
                    />
                  </div>
                </div>
              )}
            </SidebarSection>

            <div ref={layersSectionRef} className="space-y-2">
              {mapMode === "3d" && (
                <p className="rounded-lg border border-brand-500/20 bg-brand-500/10 px-2.5 py-2 text-[10px] leading-snug text-brand-200">
                  3D view: Project Alignment and Elevation only. Other layers stay off until you return to 2D.
                </p>
              )}
              {ANALYSIS_OVERLAY_GROUPS.map((group) => {
                const items = ANALYSIS_OVERLAYS.filter((o) => o.group === group);
                if (!items.length) return null;
                const groupStyle = OVERLAY_GROUP_STYLES[group];
                return (
                  <LayerDropdown
                    key={group}
                    title={group}
                    icon={groupStyle?.icon}
                    color={groupStyle?.color}
                    open={!!expandedSections[group]}
                    onToggle={() =>
                      setExpandedSections((s) => ({ ...s, [group]: !s[group] }))
                    }
                    badge={overlayGroupBadges[group]}
                  >
                    <OverlayCheckboxList
                      items={items}
                      overlays={overlays}
                      lockedIds={mapMode === "3d" ? MAP_3D_OVERLAY_IDS : null}
                      onChange={(id, checked) => {
                        if (mapMode === "3d" && !MAP_3D_OVERLAY_IDS.has(id)) return;
                        if (mapMode === "3d" && id === "alignment" && !checked) return;
                        setOverlays((s) => ({ ...s, [id]: checked }));
                      }}
                    />
                    {group === "Alignment & Markers" && overlays.alignment && alignmentLegend.length > 1 && (
                      <div className="mt-3">
                        <AlignmentColorLegend items={alignmentLegend} />
                      </div>
                    )}
                    {group === "Alignment & Markers" && overlays.road_categories && (
                      <div className="mt-3">
                        <RoadCategoryLegend />
                      </div>
                    )}
                    {group === "Alignment & Markers" && overlays.road_network && roadNetwork && (
                      <div className="mt-3 space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-slate-400">
                        <div className="font-semibold text-white">
                          Road network · {roadNetwork.count.toLocaleString()} segments
                        </div>
                        {roadNetwork.highway_counts.slice(0, 8).map((row) => {
                          const s = highwayStyle(row.highway);
                          return (
                            <div key={row.highway} className="flex items-center gap-2">
                              <span
                                className="h-0.5 w-4 shrink-0 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="flex-1 text-slate-300">{s.label}</span>
                              <span className="tabular-nums text-slate-500">{row.count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {group === "Alignment & Markers" && overlays.adjacent_roads && adjacentRoads && (
                      <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-2.5 text-xs text-slate-400">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white">Adjacent roads</span>
                          <span className="tabular-nums text-slate-300">{adjacentRoads.count}</span>
                        </div>
                        <p className="mt-1 text-[10px] leading-snug text-slate-500">
                          Access points along the corridor
                        </p>
                      </div>
                    )}
                    {group === "Alignment & Markers" &&
                      (overlays.railway_lines ||
                        overlays.railway_stations ||
                        overlays.railway_platforms) && (
                        <div className="mt-3 space-y-1 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-slate-400">
                          <div className="font-semibold text-white">Railway</div>
                          {overlays.railway_lines && railwayLines && (
                            <div className="flex items-center gap-2">
                              <span className="h-0.5 w-4 shrink-0 border-t-2 border-dashed border-slate-200" />
                              <span className="flex-1 text-slate-300">Lines</span>
                              <span className="tabular-nums text-slate-500">{railwayLines.count}</span>
                            </div>
                          )}
                          {overlays.railway_stations && railwayStations && (
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" />
                              <span className="flex-1 text-slate-300">Stations</span>
                              <span className="tabular-nums text-slate-500">
                                {railwayStations.count}
                              </span>
                            </div>
                          )}
                          {overlays.railway_platforms && railwayPlatforms && (
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-slate-900 ring-1 ring-slate-500" />
                              <span className="flex-1 text-slate-300">Platforms</span>
                              <span className="tabular-nums text-slate-500">
                                {railwayPlatforms.count}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    {group === "Utilities" &&
                      (overlays.transmission_lines ||
                        overlays.substations ||
                        overlays.transmission_towers) && (
                        <div className="mt-3 space-y-1 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-slate-400">
                          <div className="font-semibold text-white">Power utilities</div>
                          {overlays.transmission_lines && transmissionLines && (
                            <div className="flex items-center gap-2">
                              <span className="h-0.5 w-4 shrink-0 border-t-2 border-dashed border-yellow-400" />
                              <span className="flex-1 text-slate-300">Lines</span>
                              <span className="tabular-nums text-slate-500">
                                {transmissionLines.count}
                              </span>
                            </div>
                          )}
                          {overlays.substations && substations && (
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-amber-700 ring-1 ring-amber-400" />
                              <span className="flex-1 text-slate-300">Substations</span>
                              <span className="tabular-nums text-slate-500">{substations.count}</span>
                            </div>
                          )}
                          {overlays.transmission_towers && transmissionTowers && (
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-400" />
                              <span className="flex-1 text-slate-300">Towers</span>
                              <span className="tabular-nums text-slate-500">
                                {transmissionTowers.count}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    {group === "Schedule-B Corridor" && overlays.sb_elevated && (
                      <p className="mt-3 text-[10px] leading-snug text-slate-500">
                        Open <span className="text-sky-300">Elevated Viaduct</span> in the Active layers
                        panel on the right for length, area, and scour summary.
                      </p>
                    )}
                    {group === "Environment" && overlays.lulc && lulcData && lulcData.classes?.length > 0 && (
                      <div className="mt-3 space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-slate-400">
                        <div className="font-semibold text-white">LULC area (m²)</div>
                        {lulcData.classes.map((c) => (
                          <div key={c.name} className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: c.color }}
                            />
                            <span className="flex-1 text-slate-300">{c.name}</span>
                            <span className="tabular-nums text-slate-300">
                              {c.area_m2 != null
                                ? `${c.area_m2.toLocaleString()} m²`
                                : c.area_ha != null
                                  ? `${c.area_ha.toFixed(3)} ha`
                                  : c.count}
                            </span>
                          </div>
                        ))}
                        {(lulcData.total_area_m2 != null || lulcData.total_area_ha != null) && (
                          <div className="flex items-center justify-between border-t border-white/10 pt-1.5 font-semibold text-slate-200">
                            <span>TOTAL</span>
                            <span className="tabular-nums">
                              {lulcData.total_area_m2 != null
                                ? `${lulcData.total_area_m2.toLocaleString()} m²`
                                : `${lulcData.total_area_ha!.toFixed(3)} ha`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {group === "Environment" &&
                      (overlays.contours_1m || overlays.contours_0_5m) &&
                      (contours1m || contours05m) && (
                        <div className="mt-3 space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-slate-400">
                          <div className="font-semibold text-white">Contour elevation</div>
                          <div
                            className="h-2 w-full rounded-full"
                            style={{
                              background: "linear-gradient(90deg,#0ea5e9,#14b8a6,#f59e0b)",
                            }}
                          />
                          <div className="flex justify-between tabular-nums text-[10px] text-slate-500">
                            <span>
                              {Math.min(
                                contours1m?.elev_min ?? Infinity,
                                contours05m?.elev_min ?? Infinity,
                              )}{" "}
                              m
                            </span>
                            <span>
                              {Math.max(
                                contours1m?.elev_max ?? -Infinity,
                                contours05m?.elev_max ?? -Infinity,
                              )}{" "}
                              m
                            </span>
                          </div>
                          {overlays.contours_1m && contours1m && (
                            <div>1 m · {contours1m.count.toLocaleString()} lines</div>
                          )}
                          {overlays.contours_0_5m && contours05m && (
                            <div>0.5 m · {contours05m.count.toLocaleString()} lines</div>
                          )}
                        </div>
                      )}
                    {group === "Social Impact" && overlays.villages && villagesData && (
                      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-slate-400">
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <span className="h-2.5 w-2.5 rounded-sm bg-yellow-600" />
                          Villages
                        </div>
                        <div className="mt-1">
                          {villagesData.count} village boundaries (Digha–Koilwar)
                        </div>
                      </div>
                    )}
                    {group === "Social Impact" && affectedHouses && affectedHouses.count > 0 && (
                      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-slate-400">
                        <div className="font-semibold text-white">Structures within Acquisition Boundary</div>
                        <div className="mt-1">
                          {affectedHouses.count.toLocaleString()} building footprints inside the land
                          acquisition boundary
                        </div>
                      </div>
                    )}
                    {group === "Analysis" && overlays.flood && floodData && (
                      <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-2.5 text-xs text-slate-400">
                        <div className="font-semibold text-sky-300">Flood water time series</div>
                        <div className="mt-1">
                          {floodData.dates.length} observation dates · water &amp; inundation extent (ha)
                        </div>
                        <button
                          type="button"
                          className="mt-2 text-[10px] font-medium text-sky-300 hover:text-sky-200"
                          onClick={() => {
                            setOverlays((s) => ({ ...s, flood: true }));
                            setShowFloodPanel(true);
                          }}
                        >
                          Open graph panel
                        </button>
                      </div>
                    )}
                    {group === "Analysis" && overlays.ground_scour && groundScourSummary && (
                      <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5 text-xs text-slate-400">
                        <div className="font-semibold text-rose-300">
                          Predictive_Bridge_Scour_Analysis
                        </div>
                        <div className="mt-1 space-y-0.5">
                          <div>
                            {groundScourSummary.pointCount.toLocaleString()} points ·{" "}
                            {groundScourSummary.stretchCount} stretches
                          </div>
                          <div>
                            Chainage {groundScourSummary.fromKm?.toFixed(2) ?? "—"}–
                            {groundScourSummary.toKm?.toFixed(2) ?? "—"} km
                          </div>
                          <div>
                            Scour {groundScourSummary.scourMinM?.toFixed(2) ?? "—"}–
                            {groundScourSummary.scourMaxM?.toFixed(2) ?? "—"} m
                          </div>
                          <div>
                            Design HFL {groundScourSummary.designHflMinM?.toFixed(2) ?? "—"}–
                            {groundScourSummary.designHflMaxM?.toFixed(2) ?? "—"} m
                          </div>
                        </div>
                      </div>
                    )}
                    {group === "Analysis" && overlays.road_formation && roadFormationSummary && (
                      <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-slate-400">
                        <div className="font-semibold text-amber-300">Road Formation Level</div>
                        <div className="mt-1 space-y-0.5">
                          <div>
                            {roadFormationSummary.pointCount.toLocaleString()} points ·{" "}
                            {roadFormationSummary.branchCount} lines (LHS / CL / RHS)
                          </div>
                          <div>
                            Chainage {roadFormationSummary.fromKm?.toFixed(2) ?? "—"}–
                            {roadFormationSummary.toKm?.toFixed(2) ?? "—"} km
                          </div>
                          <div>
                            Formation {roadFormationSummary.formationMinM?.toFixed(1) ?? "—"}–
                            {roadFormationSummary.formationMaxM?.toFixed(1) ?? "—"} m
                          </div>
                          <div>
                            Ground {roadFormationSummary.groundMinM?.toFixed(1) ?? "—"}–
                            {roadFormationSummary.groundMaxM?.toFixed(1) ?? "—"} m
                          </div>
                        </div>
                      </div>
                    )}
                    {group === "Analysis" && overlays.slope && (
                      <div className="mt-3">
                        <SlopeLegend />
                      </div>
                    )}
                  </LayerDropdown>
                );
              })}
            </div>

            {elevationPoints.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-[#161b22] p-3 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-slate-300">
                  Terrain data
                  <Info className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-2 leading-relaxed">
                  Elevation range:{" "}
                  {Math.min(...elevationGraphPoints.map((p) => p.elevation)).toFixed(2)} m to{" "}
                  {Math.max(...elevationGraphPoints.map((p) => p.elevation)).toFixed(2)} m
                </div>
                <div className="mt-1 text-slate-500">
                  LHS/RHS/FS @ 50 m | Δ ~
                  {(
                    Math.max(...elevationGraphPoints.map((p) => p.elevation)) -
                    Math.min(...elevationGraphPoints.map((p) => p.elevation))
                  ).toFixed(2)}{" "}
                  m
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          className="absolute left-0 top-1/2 z-[1200] flex h-14 w-8 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-white/15 bg-[#111820]/95 text-slate-200 shadow-xl backdrop-blur transition hover:w-9 hover:bg-[#18222d] hover:text-white"
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>
        <div className="relative min-h-0 flex-1 overflow-hidden">
        {mapMode === "3d" ? (
          <Map3DView
            project={project}
            overlays={overlays}
            showElevation={showElevation}
            elevationVisibility={elevationVisibility}
            lineFeatures={lineFeatures}
            elevationPoints={elevationPoints}
            contours1m={contours1m}
            contours05m={contours05m}
            chainagePoints={chainagePoints.map((p) => ({
              name: p.name,
              lon: p.lon,
              lat: p.lat,
            }))}
            tollPlazaPoints={tollPlazaPoints.map((p) => ({
              name: p.name,
              lon: p.lon,
              lat: p.lat,
            }))}
            roadCategoryPoints={roadCategoryPoints.map((p) => ({
              name: p.name,
              lon: p.lon,
              lat: p.lat,
            }))}
            structureMarkers={structureMarkers.map((s) => ({
              label: s.label,
              type: s.type,
              lon: s.lon,
              lat: s.lat,
              chainage_km: s.chainage_km,
            }))}
            sbLines={sbLines}
            roadNetwork={roadNetwork}
            railwayLines={railwayLines}
            railwayStations={railwayStations}
            railwayPlatforms={railwayPlatforms}
            transmissionLines={transmissionLines}
            substations={substations}
            transmissionTowers={transmissionTowers}
            waterBodies={waterBodies}
            waterways={waterways}
            lulcData={lulcData}
            treesData={treesData}
            affectedHouses={affectedHouses}
            floodScene={floodScene}
            boreholes={boreholes.map((b) => ({
              id: b.id,
              lat: b.lat as number,
              lon: b.lon as number,
              name: b.name,
            }))}
            roadFormationLines={roadFormationLines}
          />
        ) : (
        <MapContainer
          center={center}
          zoom={12}
          className={`h-full w-full${measure ? " measure-mode" : ""}`}
          zoomControl={false}
          preferCanvas
        >
          <TileLayer
            key={base.id}
            url={base.url}
            attribution={base.attribution}
            maxZoom={base.maxZoom}
            opacity={opacity}
            {...(base.subdomains ? { subdomains: base.subdomains } : {})}
          />
          {base.overlay && (
            <TileLayer
              key={base.id + "-ov"}
              url={base.overlay.url}
              attribution=""
              opacity={opacity}
              {...(base.overlay.subdomains ? { subdomains: base.overlay.subdomains } : {})}
            />
          )}

          {/* Street View coverage (blue roads) — visible while dragging pegman */}
          {streetViewDragging && (
            <TileLayer
              key="street-view-coverage"
              url={STREET_VIEW_COVERAGE.url}
              subdomains={STREET_VIEW_COVERAGE.subdomains}
              maxZoom={STREET_VIEW_COVERAGE.maxZoom}
              opacity={STREET_VIEW_COVERAGE.opacity}
              zIndex={450}
              pane="overlayPane"
            />
          )}

          <FitBounds project={project} />
          <MapAutoResize />
          <MapResizeOnPanel active={sidebarOpen} />
          <MapResizeOnPanel active={showElevation && elevationPoints.length > 0} />
          <MapResizeOnPanel active={showFloodPanel} />
          {showElevation && elevationMapPoints.length > 0 && (
            <ElevationProfileMarkers
              points={elevationMapPoints.filter((p) => {
                const b = (p.branch ?? "centerline") as keyof ElevationSeriesVisibility;
                if (b === "lhs") return elevationVisibility.lhs;
                if (b === "rhs") return elevationVisibility.rhs;
                return elevationVisibility.centerline;
              })}
              focus={elevationFocus}
              onPointClick={handleElevationPointClick}
              interactive={!measure}
            />
          )}
          <FlyToElevationPoint
            focus={elevationFocus}
            crossSection={
              elevationCrossSection?.filter((p) => {
                if (p.branch === "lhs") return elevationVisibility.lhs;
                if (p.branch === "rhs") return elevationVisibility.rhs;
                return elevationVisibility.centerline;
              }) ?? null
            }
            scrubbing={elevationScrubbing}
          />
          {showRoadFormationGraph && overlays.road_formation && (
            <RoadFormationScrubMarkers
              sample={roadFormationScrub}
              visibility={roadFormationVisibility}
            />
          )}
          <CursorTracker onMove={setCursor} />
          <ZoomTracker onScaleLabel={setMapScaleLabel} />
          <MapInstanceCapture onReady={setMapInstance} />
          {measureTool && (
            <MeasureHandler
              maxPts={measureMeta?.maxPts ?? null}
              commitPts={commitMeasurePts}
            />
          )}
          <MeasureModeEffects active={measure} />

          {/* Right-of-way corridor buffer (drawn under alignment) */}
          {overlays.corridor &&
            lineFeatures.map((line, i) => (
              <Polyline
                key={"corr" + i}
                positions={line.coords.map((c) => [c[1], c[0]]) as [number, number][]}
                pathOptions={{
                  color: "#38e1c6",
                  opacity: 0.28,
                  weight: 12,
                  lineCap: "butt",
                  lineJoin: "miter",
                }}
              />
            ))}

          {/* Alignment strokes */}
          {overlays.alignment &&
            lineFeatures.map((line, i) => {
              const positions = line.coords.map((c) => [c[1], c[0]]) as [number, number][];
              const color = overlays.slope ? slopeColor(i) : line.stroke;
              const weight = overlays.slope ? 3 : Math.min(6, Math.max(2, line.weight));
              return (
              <Polyline
                key={"al" + i}
                  positions={positions}
                pathOptions={{
                    color,
                    weight,
                  opacity: 0.95,
                    interactive: false,
                    className:
                      expandedActiveLayerId === "alignment" ? "active-layer-blink" : undefined,
                }}
                  {...(expandedActiveLayerId === "alignment"
                    ? { renderer: blinkSvgRenderer }
                    : {})}
              >
                {(line.folder || line.name) && (
                  <Tooltip sticky opacity={0.9} className="geovision-tooltip">
                      <span className="font-semibold">
                        {line.folder?.split(" / ").pop() ?? line.name}
                      </span>
                  </Tooltip>
                )}
              </Polyline>
              );
            })}

          {/* Schedule-B linear corridor features */}
          {overlays.sb_elevated && (
            <SbLineLayer
              features={sbLines.elevated}
              color={ELEVATED_VIADUCT_COLOR}
              weight={8}
              opacity={1}
              unit="Elevated viaduct"
              blink={expandedActiveLayerId === "sb_elevated"}
            />
          )}
          {overlays.sb_ramps &&
            (interchanges ? (
              <GeoJSON
                key={`interchanges-${interchanges.source_file ?? "kml"}-${interchanges.count}-${blinkKey("sb_ramps")}`}
                data={interchanges}
                {...blinkGeoJson("sb_ramps")}
                style={() =>
                  withBlink("sb_ramps", {
                    color: interchanges.color,
                    weight: 4,
                    opacity: 0.9,
                    lineCap: "round",
                    lineJoin: "round",
                  })
                }
                onEachFeature={(feature, layer) => {
                  const props = feature.properties as {
                    name?: string;
                    length_km?: number | null;
                  };
                  const len =
                    props.length_km != null ? `${props.length_km.toFixed(3)} km` : "";
                  layer.bindTooltip(
                    `<span class="font-semibold">${props.name ?? "Interchange ramp"}</span>` +
                      (len ? `<br/><span class="text-slate-400">Length ${len}</span>` : ""),
                    { direction: "top", opacity: 0.95, className: "geovision-tooltip", sticky: true },
                  );
                }}
              />
            ) : (
              <SbLineLayer
                features={sbLines.ramps}
                color="#eab308"
                weight={4}
                opacity={0.85}
                unit="Interchange ramp"
                blink={expandedActiveLayerId === "sb_ramps"}
              />
            ))}
          {overlays.sb_service_roads && (
            <SbLineLayer
              features={sbLines.service_roads}
              color="#3b82f6"
              weight={3}
              opacity={0.85}
              dash="6 5"
              unit="Service road"
              blink={expandedActiveLayerId === "sb_service_roads"}
            />
          )}
          {overlays.sb_re_walls && reWalls && (
            <GeoJSON
              key={`re-walls-${reWalls.source_file ?? "kml"}-${reWalls.count}-${blinkKey("sb_re_walls")}`}
              data={reWalls}
              {...blinkGeoJson("sb_re_walls")}
              style={withBlink("sb_re_walls", {
                color: reWalls.color,
                weight: 2,
                fillColor: reWalls.color,
                fillOpacity: 0.45,
              })}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  name?: string;
                  from_km?: number | null;
                  to_km?: number | null;
                  length_km?: number | null;
                };
                const range =
                  props.from_km != null && props.to_km != null
                    ? `Ch ${props.from_km}–${props.to_km} km`
                    : "";
                const len = props.length_km != null ? ` · ${props.length_km} km` : "";
                layer.bindTooltip(
                  `<span class="font-semibold">${props.name ?? "RE Wall"}</span>` +
                    (range ? `<br/><span class="text-slate-400">${range}${len}</span>` : ""),
                  { direction: "top", opacity: 0.95, className: "geovision-tooltip" },
                );
              }}
            />
          )}
          {overlays.sb_drains && (
            <SbLineLayer
              features={sbLines.drains}
              color="#06b6d4"
              weight={2.5}
              opacity={0.85}
              dash="2 5"
              unit="Drain"
              blink={expandedActiveLayerId === "sb_drains"}
            />
          )}
          {overlays.sb_paved_shoulders && (
            <SbLineLayer
              features={sbLines.paved_shoulders}
              color="#94a3b8"
              weight={3}
              opacity={0.7}
              dash="4 4"
              unit="Paved shoulder"
              blink={expandedActiveLayerId === "sb_paved_shoulders"}
            />
          )}

          {/* Chainage ticks + IDs (canvas, viewport-culled — avoids 1k React layers) */}
          {(overlays.alignment || overlays.markers) && (
            <ChainageLayer
              ticks={chainageTickLines}
              stations={sortedChainagePoints}
              showTicks={overlays.alignment || overlays.markers}
              showLabels={overlays.markers}
              blink={expandedActiveLayerId === "markers"}
            />
          )}

          {/* Toll plaza locations from KMZ */}
          {overlays.toll_plazas &&
            tollPlazaPoints.map((p, i) => {
              const info = tollPlazaSummary?.byIndex[i];
              return (
              <Marker key={"toll" + i} position={p.coord} icon={tollPlazaIcon}>
                <Tooltip direction="top" offset={[0, -16]} opacity={0.95} className="geovision-tooltip">
                  <span className="font-semibold">{info?.label ?? "Toll Plaza"}</span>
                  <br />
                  {info?.nearestChainage && (
                    <>
                      <span className="text-amber-300">Ch {info.nearestChainage}</span>
                      <br />
                    </>
                  )}
                  <span className="text-slate-400">
                    {p.lat.toFixed(6)}, {p.lon.toFixed(6)}
                  </span>
                </Tooltip>
                <Popup className="geovision-popup" minWidth={260} maxWidth={340}>
                  <TollPlazaPopupContent
                    point={p}
                    project={project}
                    index={i}
                    nearestChainage={info?.nearestChainage ?? null}
                    distM={info?.distM ?? null}
                  />
                </Popup>
              </Marker>
            );
            })}

          {/* Road category markers (2-lane, 6-lane, etc.) */}
          {overlays.road_categories &&
            roadCategoryPoints.map((p, i) => {
              const style = roadCategoryStyle(p.name);
              return (
                <Marker key={"roadcat" + i} position={p.coord} icon={createRoadCategoryIcon(p.name)}>
                  <Tooltip direction="top" offset={[0, -16]} opacity={0.95} className="geovision-tooltip">
                    <span className="font-semibold">{style.label}</span>
                    <br />
                    <span className="text-slate-400">
                      {p.lat.toFixed(6)}, {p.lon.toFixed(6)}
                    </span>
                  </Tooltip>
                  <Popup className="geovision-popup" minWidth={260} maxWidth={340}>
                    <RoadCategoryPopupContent point={p} project={project} index={i} />
                  </Popup>
                </Marker>
              );
            })}

          {/* Adjacent road access points */}
          {overlays.adjacent_roads &&
            adjacentRoads?.points.map((p) => (
              <Marker
                key={p.id}
                position={[p.lat, p.lon]}
                icon={adjacentRoadIcon}
              >
                <Tooltip direction="top" offset={[0, -16]} opacity={0.95} className="geovision-tooltip">
                  <span className="font-semibold">{p.name}</span>
                  <br />
                  <span className="text-slate-400">{p.id}</span>
                  <br />
                  <span className="text-slate-500">
                    {p.lat.toFixed(6)}, {p.lon.toFixed(6)}
                  </span>
                </Tooltip>
                <Popup className="geovision-popup" minWidth={220} maxWidth={300}>
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-slate-100">{p.name}</div>
                    <div className="text-slate-400">{p.id}</div>
                    <div className="tabular-nums text-slate-500">
                      {p.lat.toFixed(6)}, {p.lon.toFixed(6)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* OSM road network within 1 km buffer */}
          {overlays.road_network && roadNetwork && (
            <GeoJSON
              key={`road-network-${blinkKey("road_network")}`}
              data={roadNetwork}
              {...blinkGeoJson("road_network")}
              style={(feature) => {
                const hw =
                  (feature?.properties as { highway?: string } | undefined)?.highway ?? "unknown";
                const s = highwayStyle(hw);
                return withBlink("road_network", {
                  color: s.color,
                  weight: s.weight,
                  opacity: 0.9,
                });
              }}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  name?: string | null;
                  highway?: string;
                  surface?: string | null;
                  lanes?: string | null;
                  ref?: string | null;
                };
                const style = highwayStyle(props.highway ?? "unknown");
                const title = props.name || props.ref || style.label;
                const bits = [
                  `<span class="font-semibold">${title}</span>`,
                  `<span class="text-slate-400">${style.label}</span>`,
                  props.surface ? `<span class="text-slate-500">${props.surface}</span>` : null,
                  props.lanes ? `<span class="text-slate-500">${props.lanes} lanes</span>` : null,
                  props.id ? `<span class="text-[10px] text-slate-500">${props.id}</span>` : null,
                ].filter(Boolean);
                layer.bindTooltip(bits.join("<br/>"), {
                  direction: "top",
                  opacity: 0.95,
                  className: "geovision-tooltip",
                });
              }}
            />
          )}

          {/* Railway lines */}
          {overlays.railway_lines && railwayLines && (
            <GeoJSON
              key={`railway-lines-${blinkKey("railway_lines")}`}
              data={railwayLines}
              {...blinkGeoJson("railway_lines")}
              style={() => withBlink("railway_lines", { ...RAILWAY_LINE_STYLE })}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  name?: string | null;
                  usage?: string | null;
                  electrified?: string | null;
                  passenger_lines?: string | null;
                };
                const title = props.name || "Railway line";
                const bits = [
                  `<span class="font-semibold">${title}</span>`,
                  props.usage ? `<span class="text-slate-400">${props.usage}</span>` : null,
                  props.electrified
                    ? `<span class="text-slate-500">Electrified: ${props.electrified}</span>`
                    : null,
                  props.passenger_lines
                    ? `<span class="text-slate-500">${props.passenger_lines} passenger lines</span>`
                    : null,
                  props.id ? `<span class="text-[10px] text-slate-500">${props.id}</span>` : null,
                ].filter(Boolean);
                layer.bindTooltip(bits.join("<br/>"), {
                  direction: "top",
                  opacity: 0.95,
                  className: "geovision-tooltip",
                });
              }}
            />
          )}

          {/* Railway platforms */}
          {overlays.railway_platforms && railwayPlatforms && (
            <GeoJSON
              key={`railway-platforms-${blinkKey("railway_platforms")}`}
              data={railwayPlatforms}
              {...blinkGeoJson("railway_platforms")}
              style={() => withBlink("railway_platforms", { ...RAILWAY_PLATFORM_STYLE })}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  name?: string;
                  ref?: string | null;
                };
                const title = props.name || props.ref || "Platform";
                layer.bindTooltip(title, {
                  permanent: true,
                  direction: "center",
                  className: "geovision-map-label",
                  opacity: 1,
                });
              }}
            />
          )}

          {/* Railway stations */}
          {overlays.railway_stations &&
            railwayStations?.features.map((f, i) => {
              const [lon, lat] = f.geometry.coordinates as [number, number];
              const name = f.properties.name;
              return (
                <CircleMarker
                  key={"rst" + i}
                  center={[lat, lon]}
                  radius={7}
                  pathOptions={{
                    color: "#ea580c",
                    fillColor: "#f97316",
                    fillOpacity: 0.95,
                    weight: 2,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -8]} opacity={0.95} className="geovision-tooltip">
                    <span className="font-semibold">{name}</span>
                    <br />
                    <span className="text-slate-400">Railway station</span>
                    <br />
                    <span className="text-[10px] text-slate-500">
                      {lat.toFixed(6)}, {lon.toFixed(6)}
                    </span>
                  </Tooltip>
                </CircleMarker>
              );
            })}

          {/* Transmission lines */}
          {overlays.transmission_lines && transmissionLines && (
            <GeoJSON
              key={`transmission-lines-${blinkKey("transmission_lines")}`}
              data={transmissionLines}
              {...blinkGeoJson("transmission_lines")}
              style={() => withBlink("transmission_lines", { ...TRANSMISSION_LINE_STYLE })}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  name?: string;
                  voltage?: string | null;
                  circuits?: string | null;
                  cables?: string | null;
                };
                const bits = [
                  `<span class="font-semibold">${props.name ?? "Transmission line"}</span>`,
                  props.voltage ? `<span class="text-slate-400">${props.voltage} kV</span>` : null,
                  props.circuits ? `<span class="text-slate-500">${props.circuits} circuits</span>` : null,
                  props.cables ? `<span class="text-slate-500">${props.cables} cables</span>` : null,
                  props.id ? `<span class="text-[10px] text-slate-500">${props.id}</span>` : null,
                ].filter(Boolean);
                layer.bindTooltip(bits.join("<br/>"), {
                  direction: "top",
                  opacity: 0.95,
                  className: "geovision-tooltip",
                });
              }}
            />
          )}

          {/* Substations */}
          {overlays.substations && substations && (
            <GeoJSON
              key={`substations-${blinkKey("substations")}`}
              data={substations}
              {...blinkGeoJson("substations")}
              style={() => withBlink("substations", { ...SUBSTATION_STYLE })}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as { id?: string; name?: string };
                const title = props.name || "Substation";
                layer.bindTooltip(title, {
                  permanent: true,
                  direction: "center",
                  className: "geovision-map-label-static",
                  opacity: 1,
                });
              }}
            />
          )}

          {/* Transmission towers */}
          {overlays.transmission_towers &&
            transmissionTowers?.features.map((f, i) => {
              const [lon, lat] = f.geometry.coordinates as [number, number];
              const name = f.properties.name;
              return (
                <CircleMarker
                  key={"tt" + i}
                  center={[lat, lon]}
                  radius={5}
                  pathOptions={{
                    color: "#ca8a04",
                    fillColor: "#facc15",
                    fillOpacity: 0.95,
                    weight: 2,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={0.95} className="geovision-tooltip">
                    <span className="font-semibold">{name}</span>
                    <br />
                    <span className="text-slate-400">Transmission tower</span>
                    <br />
                    <span className="text-[10px] text-slate-500">
                      {lat.toFixed(6)}, {lon.toFixed(6)}
                    </span>
                  </Tooltip>
                </CircleMarker>
              );
            })}

          {/* Schedule-B structures */}
          {overlays.structures &&
            structureMarkers.map((s, i) => {
              const iconFile = structureIconFile(s);
              const icon = iconFile ? structureIconCache.get(iconFile) : undefined;

              if (icon) {
                return (
                  <Marker
                    key={"sb" + i}
                    position={s.coord}
                    icon={icon}
                    opacity={
                      expandedActiveLayerId === "structures" ? (layerBlinkBright ? 1 : 0.2) : 1
                    }
                  >
                    <Tooltip direction="top" offset={[0, -44]} opacity={0.95} className="geovision-tooltip">
                      <span className="font-semibold">{s.label}</span>
                      <span className="ml-1.5 text-slate-400">· Ch {s.chainage_km} km</span>
                      <br />
                      <span className="text-slate-400">
                        {s.lat.toFixed(6)}, {s.lon.toFixed(6)}
                      </span>
                    </Tooltip>
                    <Popup className="geovision-popup" minWidth={260} maxWidth={360}>
                      <StructurePopupContent structure={s} project={project} />
                    </Popup>
                  </Marker>
                );
              }

              return (
                <CircleMarker
                  key={"sb" + i}
                  center={s.coord}
                  radius={8}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: structureColor(s.type),
                    fillOpacity: 0.9,
                    weight: 2,
                    className:
                      expandedActiveLayerId === "structures"
                        ? "active-layer-marker-blink"
                        : undefined,
                  }}
                  {...(expandedActiveLayerId === "structures"
                    ? { renderer: blinkSvgRenderer }
                    : {})}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95} className="geovision-tooltip">
                    <span className="font-semibold">{s.label}</span>
                    <span className="ml-1.5 text-slate-400">· Ch {s.chainage_km} km</span>
                    <br />
                    <span className="text-slate-400">
                      {s.lat.toFixed(6)}, {s.lon.toFixed(6)}
                    </span>
                  </Tooltip>
                  <Popup className="geovision-popup" minWidth={260} maxWidth={360}>
                    <StructurePopupContent structure={s} project={project} />
                  </Popup>
                </CircleMarker>
              );
            })}

          {/* Waterways + water bodies (same layer toggle) */}
          {overlays.water_bodies && waterBodies && (
            <GeoJSON
              key={`water-bodies-${waterBodies.source_file ?? "legacy"}-${waterBodies.count}-${blinkKey("water_bodies")}`}
              data={waterBodies}
              {...blinkGeoJson("water_bodies")}
              style={() =>
                withBlink("water_bodies", {
                  color: "#0369a1",
                  weight: 1.25,
                  fillColor: "#38bdf8",
                  fillOpacity: 0.35,
                })
              }
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  name?: string;
                  index?: number;
                };
                const label = props.name ?? `Water body ${props.index ?? ""}`;
                layer.bindTooltip(
                  `<span class="font-semibold">${label}</span><br/><span class="text-slate-400">Water body · ${props.id ?? ""}</span>`,
                  { direction: "top", opacity: 0.95, className: "geovision-tooltip" },
                );
              }}
            />
          )}
          {overlays.water_bodies && waterways && (
            <GeoJSON
              key={`waterways-${waterways.source_file ?? "legacy"}-${waterways.count}-${blinkKey("water_bodies")}`}
              data={waterways}
              {...blinkGeoJson("water_bodies")}
              style={() =>
                withBlink("water_bodies", {
                  color: "#075985",
                  weight: 1.75,
                  fillColor: "#0ea5e9",
                  fillOpacity: 0.45,
                })
              }
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  name?: string;
                  index?: number;
                };
                const label = props.name ?? `Waterway ${props.index ?? ""}`;
                layer.bindTooltip(
                  `<span class="font-semibold">${label}</span><br/><span class="text-slate-400">Waterway · ${props.id ?? ""}</span>`,
                  { direction: "top", opacity: 0.95, className: "geovision-tooltip" },
                );
              }}
            />
          )}

          {/* Villages */}
          {overlays.villages && villagesData && (
            <GeoJSON
              key={`villages-${blinkKey("villages")}`}
              data={villagesData}
              {...blinkGeoJson("villages")}
              style={() =>
                withBlink("villages", {
                  color: "#a16207",
                  weight: 1.5,
                  fillColor: "#ca8a04",
                  fillOpacity: 0.28,
                })
              }
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  name?: string;
                  type?: string;
                  sub_district?: string;
                  district?: string;
                  state?: string;
                  census_2001?: string;
                };
                const name = props.name ?? "Village";
                layer.bindTooltip(name, {
                  permanent: true,
                  direction: "center",
                  opacity: 0.95,
                  className: "geovision-map-label-static",
                });
                layer.bindPopup(
                  `<div class="geovision-popup__body">
                    <div class="geovision-popup__title">${name}</div>
                    <div class="geovision-popup__subtitle">${props.type ?? "Village"} · ${props.id ?? ""}</div>
                    <dl class="geovision-popup__rows">
                      ${props.sub_district ? `<div class="geovision-popup__row"><dt>Sub-district</dt><dd>${props.sub_district}</dd></div>` : ""}
                      ${props.district ? `<div class="geovision-popup__row"><dt>District</dt><dd>${props.district}</dd></div>` : ""}
                      ${props.state ? `<div class="geovision-popup__row"><dt>State</dt><dd>${props.state}</dd></div>` : ""}
                      ${props.census_2001 ? `<div class="geovision-popup__row"><dt>Census 2001</dt><dd>${props.census_2001}</dd></div>` : ""}
                    </dl>
                  </div>`,
                  { className: "geovision-popup", minWidth: 220 },
                );
              }}
            />
          )}

          {/* LULC (land use / land cover) */}
          {overlays.lulc && lulcData && (
            <GeoJSON
              key={`lulc-${lulcData.source_file ?? "legacy"}-${lulcData.count}-${blinkKey("lulc")}`}
              data={lulcData}
              {...blinkGeoJson("lulc")}
              style={(feature) => {
                const color =
                  (feature?.properties as { color?: string } | undefined)?.color ?? "#94a3b8";
                return withBlink("lulc", {
                  color,
                  weight: 1,
                  fillColor: color,
                  fillOpacity: 0.4,
                });
              }}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  class?: string;
                  name?: string;
                };
                const label = props.class ?? props.name ?? "LULC";
                layer.bindTooltip(
                  `<span class="font-semibold">${label}</span><br/><span class="text-slate-400">${props.id ?? ""}</span>`,
                  { direction: "top", opacity: 0.95, className: "geovision-tooltip" },
                );
              }}
            />
          )}

          {/* Barren land parcels */}
          {overlays.barren_land && barrenLand && (
            <GeoJSON
              key={`barren-${barrenLand.source_file ?? "legacy"}-${barrenLand.count}-${blinkKey("barren_land")}`}
              data={barrenLand}
              {...blinkGeoJson("barren_land")}
              style={withBlink("barren_land", {
                color: barrenLand.color,
                weight: 1,
                fillColor: barrenLand.color,
                fillOpacity: 0.45,
              })}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  area_ha?: number | null;
                  area_acre?: number | null;
                };
                const areaHa =
                  props.area_ha != null ? `${props.area_ha.toFixed(4)} ha` : "";
                const areaAcre =
                  props.area_acre != null ? ` · ${props.area_acre.toFixed(4)} acre` : "";
                layer.bindTooltip(
                  `<span class="font-semibold">Barren Land</span><br/>` +
                    `<span class="text-slate-400">${props.id ?? ""}</span><br/>` +
                    `<span class="text-slate-400">${areaHa}${areaAcre}</span>`,
                  { direction: "top", opacity: 0.95, className: "geovision-tooltip" },
                );
              }}
            />
          )}

          {/* Trees (emoji markers) */}
          {overlays.trees && treesData && treesData.trees.length > 0 && (
            <TreesLayer
              trees={treesData.trees}
              interactive={!measure}
              blink={expandedActiveLayerId === "trees"}
            />
          )}

          {/* Ground contours */}
          {overlays.contours_1m && contours1m && (
            <ContoursLayer
              data={contours1m}
              weight={1.4}
              blink={expandedActiveLayerId === "contours_1m"}
            />
          )}
          {overlays.contours_0_5m && contours05m && (
            <ContoursLayer
              data={contours05m}
              weight={1.1}
              opacity={0.75}
              blink={expandedActiveLayerId === "contours_0_5m"}
            />
          )}

          {/* Flood water / inundation heat map for selected date */}
          {overlays.flood && floodScene && <FloodLayer scene={floodScene} />}

          {/* Ground scour screening (Design HFL workbook) */}
          {overlays.ground_scour && groundScour && (
            <>
              <GroundScourHoverBridge
                points={groundScour.points}
                enabled={!measure}
                onHover={(point, cursor) => {
                  setHoveredGroundScour(point);
                  setGroundScourCursor(cursor);
                }}
              />
              {groundScour.features.map((f) => (
                <Polyline
                  key={`${f.properties.id}-${blinkKey("ground_scour")}`}
                  positions={f.geometry.coordinates.map(
                    ([lon, lat]) => [lat, lon] as [number, number],
                  )}
                  pathOptions={{
                    color: groundScourZoneColor(f.properties.hydraulic_zone),
                    weight: expandedActiveLayerId === "ground_scour" ? 7 : 5,
                    opacity: 0.85,
                    lineCap: "round",
                    lineJoin: "round",
                    interactive: false,
                    className:
                      expandedActiveLayerId === "ground_scour"
                        ? "active-layer-blink"
                        : undefined,
                  }}
                  renderer={groundScourSvgRenderer}
                />
              ))}
              {groundScour.points.map((p) => {
                const fill = groundScourDepthColor(p.scour_max_m);
                const active = hoveredGroundScour?.id === p.id;
                const blink = expandedActiveLayerId === "ground_scour";
                return (
                  <CircleMarker
                    key={`gs-${p.id}-${blink ? "blink" : "steady"}`}
                    center={[p.latitude, p.longitude]}
                    radius={active ? 9 : 7}
                    pane="markerPane"
                    renderer={groundScourSvgRenderer}
                    pathOptions={{
                      color: "#fff",
                      weight: active ? 2.5 : 1.5,
                      fillColor: fill,
                      fillOpacity: 1,
                      interactive: false,
                      className: blink ? "active-layer-marker-blink" : undefined,
                    }}
                  />
                );
              })}
            </>
          )}

          {/* Road formation level (LHS / centerline / RHS) */}
          {overlays.road_formation && roadFormation && (
            <>
              {roadFormation.branches.flatMap((branch) => {
                if (
                  roadFormationVisibility[
                    branch.id as keyof RoadFormationSeriesVisibility
                  ] === false
                ) {
                  return [];
                }
                const color = ROAD_FORMATION_BRANCH_COLORS[branch.id] ?? "#f59e0b";
                const fls = branch.points
                  .map((p) => p.formation_level_m)
                  .filter((v): v is number => v != null);
                const flMin = fls.length ? Math.min(...fls) : null;
                const flMax = fls.length ? Math.max(...fls) : null;

                // Points are ~10 m apart; a larger jump means a new stretch —
                // break the line there instead of drawing a connector across the map.
                const segments: [number, number][][] = [];
                let cur: [number, number][] = [];
                let prev: { lat: number; lon: number } | null = null;
                for (const p of branch.points) {
                  if (prev && haversineKm(prev.lat, prev.lon, p.lat, p.lon) > 0.15) {
                    if (cur.length > 1) segments.push(cur);
                    cur = [];
                  }
                  cur.push([p.lat, p.lon]);
                  prev = p;
                }
                if (cur.length > 1) segments.push(cur);

                const rfBlink = expandedActiveLayerId === "road_formation";
                return segments.map((positions, si) => (
                  <Polyline
                    key={`rf-${branch.id}-${si}-${rfBlink ? "blink" : "steady"}`}
                    positions={positions}
                    {...(rfBlink ? { renderer: blinkSvgRenderer } : {})}
                    pathOptions={{
                      color,
                      weight: (branch.id === "centerline" ? 4 : 3) + (rfBlink ? 2 : 0),
                      opacity: 0.9,
                      dashArray: branch.id === "centerline" ? undefined : "8 6",
                      lineCap: "round",
                      lineJoin: "round",
                      className: rfBlink ? "active-layer-blink" : undefined,
                    }}
                  >
                    <Tooltip sticky opacity={0.95} className="geovision-tooltip">
                      <span className="font-semibold">Road Formation · {branch.name}</span>
                      <br />
                      <span className="text-slate-400">
                        Min formation level{" "}
                        {flMin != null && flMax != null
                          ? flMin === flMax
                            ? `${flMin.toFixed(1)} m`
                            : `${flMin.toFixed(1)}–${flMax.toFixed(1)} m`
                          : "—"}
                      </span>
                      <br />
                      <span className="text-slate-400">
                        {branch.count.toLocaleString()} pts · Ch{" "}
                        {roadFormation.from_km?.toFixed(2)}–{roadFormation.to_km?.toFixed(2)} km
                      </span>
                    </Tooltip>
                  </Polyline>
                ));
              })}
            </>
          )}

          {/* Structures within acquisition boundary (building footprints) */}
          {overlays.affected_houses && affectedHouses && (
            <GeoJSON
              key={`affected-houses-${affectedHouses.source_file ?? "legacy"}-${affectedHouses.count}-${blinkKey("affected_houses")}`}
              data={affectedHouses}
              {...blinkGeoJson("affected_houses")}
              style={() =>
                withBlink("affected_houses", {
                  color: "#ef4444",
                  weight: 1,
                  fillColor: "#ef4444",
                  fillOpacity: 0.35,
                })
              }
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  name?: string;
                  index?: number;
                };
                const label = props.name ?? `Building ${props.index ?? ""}`;
                layer.bindTooltip(
                  `<span class="font-semibold">${label}</span><br/><span class="text-slate-400">${props.id ?? ""}</span>`,
                  { direction: "top", opacity: 0.95, className: "geovision-tooltip" },
                );
              }}
            />
          )}

          {/* Geotechnical boreholes */}
          {overlays.boreholes && (
            <BoreholeClickBridge
              boreholes={boreholes}
              enabled={!measure}
              onSelect={setSelectedBorehole}
            />
          )}
          {overlays.boreholes &&
            boreholes.map((bh, i) => {
              const s = boreholeSummary(bh);
              const bhBlink = expandedActiveLayerId === "boreholes";
              return (
                <CircleMarker
                  key={"bh" + i + (bhBlink ? "-blink" : "-steady")}
                  center={[bh.lat as number, bh.lon as number]}
                  radius={bhBlink ? 9 : 7}
                  {...(bhBlink ? { renderer: blinkSvgRenderer } : {})}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: s.hasData ? "#a855f7" : "#7c6f9c",
                    fillOpacity: 0.9,
                    weight: 2,
                    className: bhBlink
                      ? "active-layer-marker-blink"
                      : s.hasData
                        ? "geovision-marker"
                        : undefined,
                  }}
                  eventHandlers={
                    !measure && s.hasData ? { click: () => setSelectedBorehole(bh) } : undefined
                  }
                >
                  <Tooltip direction="top" offset={[0, -8]} opacity={0.95} className="geovision-tooltip">
                    <span className="font-semibold">Soil analysis</span>
                    <br />
                    <span className="text-[10px] text-slate-400">
                      {(bh.lat as number).toFixed(6)}, {(bh.lon as number).toFixed(6)}
                    </span>
                    {s.hasData ? (
                      <>
                        <br />
                        <span className="text-slate-400">
                          {s.topSoilClass} · {s.maxDepth} m
                        </span>
                        <br />
                        <span className="text-fuchsia-300">click for borehole log</span>
                      </>
                    ) : (
                      <>
                        <br />
                        <span className="text-slate-500">No soil-test detail</span>
                      </>
                    )}
                  </Tooltip>
                </CircleMarker>
              );
            })}

          {/* Measurement graphics */}
          {measureTool === "area" && measurePts.length >= 3 && (
            <Polygon
              positions={measurePts}
              pathOptions={{
                color: "#f43f5e",
                weight: 2,
                fillColor: "#f43f5e",
                fillOpacity: 0.15,
                dashArray: "6 6",
              }}
            />
          )}
          {measureTool !== "area" && measurePts.length > 1 && (
            <Polyline
              positions={measurePts}
              pathOptions={{ color: "#f43f5e", weight: 2, dashArray: "6 6" }}
            />
          )}
          {measureTool === "area" && measurePts.length === 2 && (
            <Polyline
              positions={measurePts}
              pathOptions={{ color: "#f43f5e", weight: 2, dashArray: "6 6" }}
            />
          )}
          {measurePts.map((p, i) => (
            <CircleMarker
              key={"m" + i}
              center={p}
              radius={4}
              pathOptions={{
                color: "#9f1239",
                fillColor: "#f43f5e",
                fillOpacity: 1,
                opacity: 1,
                weight: 1.5,
              }}
            />
          ))}
        </MapContainer>
        )}

        {/* top-left controls (layers / elevation) — above Map & Layers panel */}
        <div className="pointer-events-none absolute inset-0 z-[500]">
          <div className="pointer-events-auto absolute right-4 top-14 z-[600] flex max-h-[calc(100vh-7rem)] max-w-[calc(100vw-22rem)] flex-col items-end gap-2 overflow-hidden">
            {mapMode === "2d" && (
              <>
            <div className="shrink-0">
            <BaseMapSwitcher
              baseId={baseId}
              opacity={opacity}
              open={baseMapOpen}
              onToggle={() => setBaseMapOpen((v) => !v)}
              onBaseChange={setBaseId}
              onOpacityChange={setOpacity}
            />
            </div>
            {activeOverlayItems.length > 0 && (
              <div
                className={`flex w-[min(100vw-2rem,16rem)] flex-col overflow-hidden rounded-xl border-2 border-sky-400/60 bg-ink-950/95 p-2.5 shadow-2xl ring-1 ring-sky-300/20 backdrop-blur-xl ${
                  activeLayersOpen ? "min-h-0 max-h-full flex-1" : "shrink-0"
                }`}
              >
            <button
                  type="button"
              onClick={() => {
                    setActiveLayersOpen((v) => {
                      if (v) setExpandedActiveLayerId(null);
                  return !v;
                });
              }}
                  className="mb-0 flex w-full shrink-0 items-center justify-between gap-2 px-1 text-left"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">
                    Active layers
                  </h3>
                  <span className="flex items-center gap-1.5">
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-400">
                      {activeOverlayItems.length}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
                        activeLayersOpen ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>
                {activeLayersOpen && (
                <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
                  {activeOverlayItems.map((item) => {
                    const Icon = OVERLAY_ICONS[item.id] ?? LayersIcon;
                    const open = expandedActiveLayerId === item.id;
                    const accent = item.color ?? "#94a3b8";
                    return (
                      <div
                        key={item.id}
                        className={`overflow-hidden rounded-xl border transition ${
                          open
                            ? "active-layer-row-open border-sky-400/50 bg-sky-500/10"
                            : "border-white/10 bg-white/5"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedActiveLayerId((id) =>
                              id === item.id ? null : item.id,
                            )
                          }
                          className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: accent }}
                          />
                          <Icon
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: accent }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white">
                            {item.name}
                          </span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
                              open ? "rotate-180" : ""
                            }`}
                          />
            </button>
                        {open && (
                          <div className="border-t border-white/10 px-2 pb-2 pt-2">
                            {item.id === "alignment" && alignmentSummary ? (
                              <ProjectAlignmentCard info={alignmentSummary} compact />
                            ) : item.id === "sb_elevated" && elevatedInfo ? (
                              <ElevatedViaductCard info={elevatedInfo} compact />
                            ) : item.id === "sb_service_roads" && serviceRoadSummary ? (
                              <ServiceRoadCard info={serviceRoadSummary} compact />
                            ) : item.id === "sb_re_walls" && reWallSummary ? (
                              <ReWallCard info={reWallSummary} compact />
                            ) : item.id === "sb_ramps" && interchangeSummary ? (
                              <InterchangeCard info={interchangeSummary} compact />
                            ) : item.id === "sb_drains" && drainSummary ? (
                              <DrainCard info={drainSummary} compact />
                            ) : item.id === "sb_paved_shoulders" && shoulderSummary ? (
                              <ShoulderCard info={shoulderSummary} compact />
                            ) : item.id === "structures" && structuresSummary ? (
                              <StructuresPointsCard info={structuresSummary} compact />
                            ) : item.id === "trees" && treesSummary ? (
                              <TreesSummaryCard info={treesSummary} compact />
                            ) : item.id === "road_network" && roadNetwork ? (
                              <RoadNetworkSummaryCard data={roadNetwork} compact />
                            ) : item.id === "railway_lines" && railwayLinesInfo ? (
                              <RailwayLinesSummaryCard info={railwayLinesInfo} compact />
                            ) : item.id === "railway_stations" && railwayStationsInfo ? (
                              <RailwayStationsSummaryCard info={railwayStationsInfo} compact />
                            ) : item.id === "railway_platforms" && railwayPlatformsInfo ? (
                              <RailwayPlatformsSummaryCard info={railwayPlatformsInfo} compact />
                            ) : item.id === "lulc" && lulcSummary ? (
                              <LulcSummaryCard info={lulcSummary} compact />
                            ) : item.id === "markers" && chainagePointsSummary ? (
                              <ChainagePointsSummaryCard info={chainagePointsSummary} compact />
                            ) : item.id === "toll_plazas" && tollPlazaSummary ? (
                              <TollPlazaSummaryCard info={tollPlazaSummary} compact />
                            ) : item.id === "road_categories" ? (
                              <RoadCategoriesSummaryCard compact />
                            ) : item.id === "ground_scour" && groundScourSummary ? (
                              <GroundScourSummaryCard info={groundScourSummary} compact />
                            ) : item.id === "road_formation" && roadFormationSummary ? (
                              <RoadFormationSummaryCard info={roadFormationSummary} compact />
                            ) : (
                              <p className="px-0.5 text-[10px] leading-snug text-slate-400">
                                {item.description || "Layer is active on the map."}
                              </p>
                            )}
          </div>
                        )}
          </div>
                    );
                  })}
              </div>
            )}
              </div>
            )}
              </>
            )}
        </div>

          {/* tools + readouts — centre bottom, horizontal */}
          <div className="pointer-events-auto absolute bottom-6 left-1/2 z-[600] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2">
            {mapMode === "2d" && (
            <div className="pointer-events-none flex flex-wrap items-center justify-center gap-2">
              <div className="glass rounded-lg px-3 py-1.5 text-xs text-slate-200">
                {mapScaleLabel}
            </div>
              {cursor && (
                <div className="glass flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-200">
                  <Crosshair className="h-3.5 w-3.5 text-brand-400" />
                  {cursor[0].toFixed(5)}, {cursor[1].toFixed(5)}
              </div>
            )}
              {measureTool && measureResult && (
                <div className="glass pointer-events-auto max-w-xs rounded-lg px-3 py-1.5 text-xs text-rose-300">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-rose-200">
                      {measureMeta?.label ?? "Measure"} · layers locked
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        disabled={!canMeasureUndo}
                        onClick={undoMeasure}
                        title="Undo (Ctrl+Z)"
                        className="rounded-md p-1 text-rose-200 transition enabled:hover:bg-white/10 disabled:opacity-30"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    <button
                        type="button"
                        disabled={!canMeasureRedo}
                        onClick={redoMeasure}
                        title="Redo (Ctrl+Y)"
                        className="rounded-md p-1 text-rose-200 transition enabled:hover:bg-white/10 disabled:opacity-30"
                      >
                        <Redo2 className="h-3.5 w-3.5" />
                    </button>
                    </div>
                  </div>
                  {measureResult.lines.map((line, i) => (
                    <div key={i} className={i === 0 ? "mt-0.5" : "text-rose-300/80"}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
              {streetViewDragging && (
                <div className="glass flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-sky-300">
                  <span className="h-2 w-4 rounded-sm bg-sky-400" />
                  Blue roads = Street View available
                  </div>
              )}
            </div>
            )}
            <div className="relative flex flex-row items-center gap-2">
              {mapMode === "2d" && (
                <>
              <StreetViewPegman
                map={mapInstance}
                onDrop={handleStreetViewDrop}
                onDraggingChange={setStreetViewDragging}
              />
              <div className="relative flex flex-row items-center gap-2">
                {measureMenuOpen && (
                  <div className="glass absolute bottom-12 left-1/2 z-[900] w-52 -translate-x-1/2 overflow-hidden rounded-xl border border-white/15 text-left shadow-xl">
                    <div className="border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Measure tools
                </div>
                    {MEASURE_TOOLS.map((t) => {
                      const Icon =
                        t.id === "distance"
                          ? Ruler
                          : t.id === "area"
                            ? Pentagon
                            : t.id === "bearing"
                              ? Compass
                              : Mountain;
                return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => startMeasureTool(t.id)}
                          className={`flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition hover:bg-white/10 ${
                            measureTool === t.id ? "bg-rose-500/20 text-rose-200" : "text-slate-200"
                          }`}
                        >
                          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                          <span>
                            <span className="font-semibold">{t.label}</span>
                            <span className="mt-0.5 block text-[10px] text-slate-400">{t.hint}</span>
                          </span>
                        </button>
                      );
                    })}
                    {measureTool && (
                      <button
                        type="button"
                        onClick={exitMeasure}
                        className="w-full border-t border-white/10 px-3 py-2 text-left text-xs font-semibold text-slate-300 hover:bg-white/10"
                      >
                        Exit measure
                      </button>
                    )}
                      </div>
                    )}
                {measure && (
                  <>
                    <ToolBtn
                      onClick={undoMeasure}
                      active={false}
                      title={canMeasureUndo ? "Undo last point (Ctrl+Z)" : "Nothing to undo"}
                      disabled={!canMeasureUndo}
                    >
                      <Undo2 className="h-4 w-4" />
                    </ToolBtn>
                    <ToolBtn
                      onClick={redoMeasure}
                      active={false}
                      title={canMeasureRedo ? "Redo point (Ctrl+Y)" : "Nothing to redo"}
                      disabled={!canMeasureRedo}
                    >
                      <Redo2 className="h-4 w-4" />
                    </ToolBtn>
                  </>
                )}
                <ToolBtn
                  active={measure}
                  onClick={() => {
                    if (measureTool) {
                      exitMeasure();
                      return;
                    }
                    setMeasureMenuOpen((v) => !v);
                  }}
                  title={measure ? "Exit measure mode" : "Measure tools"}
                >
                  <Ruler className="h-4 w-4" />
                </ToolBtn>
                      </div>
                </>
              )}
              <ToolBtn onClick={() => document.documentElement.requestFullscreen?.()} title="Fullscreen">
                <Maximize2 className="h-4 w-4" />
              </ToolBtn>
            </div>
                </div>
              </div>
        </div>

        {showElevation && elevationGraphPoints.length > 0 && (
          <ElevationGraphModal
            points={elevationGraphPoints}
            hflPoints={designHflPoints}
            exportPoints={elevationPoints}
            projectName={project?.name}
            visibility={elevationVisibility}
            onVisibilityChange={setElevationVisibility}
            onClose={() => {
              setShowElevation(false);
              setElevationFocus(null);
              setElevationCrossSection(null);
              setElevationVisibility(DEFAULT_ELEVATION_VISIBILITY);
            }}
            onPointClick={handleElevationPointClick}
            onScrub={handleElevationScrub}
          />
        )}

        {showRoadFormationGraph && overlays.road_formation && roadFormation && (
          <RoadFormationGraphPanel
            data={roadFormation}
            elevationPoints={elevationGraphPoints}
            hflPoints={designHflPoints}
            visibility={roadFormationVisibility}
            onVisibilityChange={setRoadFormationVisibility}
            onClose={() => {
              setShowRoadFormationGraph(false);
              setRoadFormationScrub(null);
              setRoadFormationVisibility(DEFAULT_ROAD_FORMATION_VISIBILITY);
            }}
            onScrub={setRoadFormationScrub}
          />
        )}

        {showFloodPanel && floodData && floodDate && (
          <FloodTimeSeriesPanel
            data={floodData}
            selectedDate={floodDate}
            onDateChange={setFloodDate}
            onClose={() => setShowFloodPanel(false)}
          />
        )}

        {selectedBorehole && (
          <BoreholeCard
            borehole={selectedBorehole}
            columns={geotech?.columns ?? []}
            onClose={() => setSelectedBorehole(null)}
          />
        )}

        {showWeather && (
          <WeatherForecastModal
            latitude={weatherModalCoords.lat}
            longitude={weatherModalCoords.lon}
            locationLabel={
              cursor
                ? `Cursor · ${weatherModalCoords.lat.toFixed(4)}°N, ${weatherModalCoords.lon.toFixed(4)}°E`
                : project?.location
            }
            onClose={() => setShowWeather(false)}
          />
        )}

        {streetViewPoint && (
          <StreetViewModal
            lat={streetViewPoint.lat}
            lon={streetViewPoint.lon}
            onClose={() => setStreetViewPoint(null)}
          />
        )}

        {overlays.ground_scour &&
          hoveredGroundScour &&
          groundScourCursor &&
          createPortal(
            <div
              className="pointer-events-none fixed z-[10000] w-[22rem] max-h-[min(88vh,34rem)] overflow-y-auto rounded-xl border border-rose-400/50 bg-ink-950 shadow-2xl ring-1 ring-rose-300/30"
              style={{
                left: Math.min(Math.max(groundScourCursor.x, 176), window.innerWidth - 176),
                top: groundScourCursor.y,
                transform:
                  groundScourCursor.y < window.innerHeight * 0.45
                    ? "translate(-50%, 16px)"
                    : "translate(-50%, calc(-100% - 16px))",
              }}
            >
              <GroundScourPointCard point={hoveredGroundScour} />
            </div>,
            document.body,
        )}
      </div>
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#161b22]/80">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-white/10 px-3 pb-3 pt-2">{children}</div>}
    </section>
  );
}

function MapControlBtn({
  icon: Icon,
  label,
  color,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-[#0f141c] p-2 transition hover:border-white/20 disabled:opacity-40 ${
        active ? "ring-1 ring-brand-400/50" : ""
      }`}
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-lg"
        style={{ backgroundColor: `${color}22`, color }}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <span className="text-center text-[10px] font-medium leading-tight text-slate-300">
        {label}
      </span>
    </button>
  );
}

function OverviewStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className="text-base font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function LayerDropdown({
  title,
  open,
  onToggle,
  badge,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  icon?: LucideIcon;
  color?: string;
  children: React.ReactNode;
}) {
  const accent = color ?? "#38e1c6";
  return (
    <div
      className="overflow-hidden rounded-xl border bg-white/5"
      style={{ borderColor: `${accent}33` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-white/5"
        style={{
          background: open
            ? `linear-gradient(90deg, ${accent}22 0%, transparent 70%)`
            : undefined,
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          {Icon && (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
          )}
          <span className="truncate text-xs font-semibold text-white">{title}</span>
        </span>
        <span className="flex items-center gap-2">
          {badge && (
            <span
              className="max-w-[8rem] truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              {badge}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && (
        <div className="border-t border-white/10 px-3 py-3" style={{ borderColor: `${accent}22` }}>
          {children}
        </div>
      )}
    </div>
  );
}

const OVERLAY_GROUP_STYLES: Record<string, { icon: LucideIcon; color: string }> = {
  "Alignment & Markers": { icon: Route, color: "#c026d3" },
  Utilities: { icon: Zap, color: "#facc15" },
  "Schedule-B Structures": { icon: Building2, color: "#f59e0b" },
  "Schedule-B Corridor": { icon: Box, color: "#12c9b0" },
  Geotechnical: { icon: Mountain, color: "#a855f7" },
  Environment: { icon: Trees, color: "#22c55e" },
  "Social Impact": { icon: Users, color: "#ca8a04" },
  Analysis: { icon: Activity, color: "#0ea5e9" },
};

const OVERLAY_ICONS: Record<string, LucideIcon> = {
  alignment: Route,
  markers: Milestone,
  toll_plazas: MapPinned,
  road_categories: GitBranch,
  road_network: Route,
  adjacent_roads: MapPinned,
  railway_lines: TrainFront,
  railway_stations: TrainFront,
  railway_platforms: LandPlot,
  transmission_lines: Zap,
  substations: Factory,
  transmission_towers: TowerControl,
  structures: Building2,
  sb_elevated: Box,
  sb_service_roads: Route,
  sb_re_walls: Fence,
  sb_drains: Droplets,
  sb_ramps: GitBranch,
  sb_paved_shoulders: Route,
  boreholes: Mountain,
  water_bodies: Waves,
  lulc: LandPlot,
  trees: Trees,
  contours_1m: MountainSnow,
  contours_0_5m: Activity,
  villages: Home,
  affected_houses: Building2,
  flood: CloudRain,
  ground_scour: Waves,
  road_formation: Route,
  corridor: Fence,
  slope: Mountain,
};

function OverlayCheckboxList({
  items,
  overlays,
  onChange,
  lockedIds = null,
}: {
  items: AnalysisOverlay[];
  overlays: Record<string, boolean>;
  onChange: (id: string, checked: boolean) => void;
  /** When set, only these overlay ids stay interactive (3D mode). */
  lockedIds?: Set<string> | null;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const locked = lockedIds != null && !lockedIds.has(item.id);
        const forceOn = lockedIds != null && lockedIds.has(item.id);
        const disabled = locked || forceOn;
        const Icon = OVERLAY_ICONS[item.id] ?? LayersIcon;
        return (
          <label
            key={item.id}
            className={`flex items-start gap-2.5 rounded-lg px-1 py-1.5 transition ${
              disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:bg-white/5"
            }`}
          >
            <input
              type="checkbox"
              checked={!!overlays[item.id]}
              disabled={disabled}
              onChange={(e) => onChange(item.id, e.target.checked)}
              className="mt-0.5 accent-brand-500"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/5"
                  style={{ color: item.color ?? "#94a3b8" }}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                <span className="text-xs font-medium text-white">{item.name}</span>
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                {item.description}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  active,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`grid h-10 w-10 place-items-center rounded-xl border backdrop-blur-xl transition disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "border-rose-400 bg-rose-500/20 text-rose-300"
          : "border-white/10 bg-ink-900/80 text-white enabled:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-950/60 py-1.5">
      <div className="text-sm font-bold text-brand-400">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

function parseChainageLabel(name: string): string | null {
  const m = name.match(/^(\d+)\+(\d+)$/);
  if (!m) return null;
  const km = parseInt(m[1], 10);
  const metres = parseInt(m[2], 10);
  const total = km + metres / 1000;
  return `Chainage ${total.toFixed(3)} km`;
}

function StructurePopupContent({
  structure,
  project,
}: {
  structure: ScheduleBStructure & { lon: number; lat: number };
  project: Project | null;
}) {
  const details = structure.details ?? {};
  const detailRows = Object.entries(details).filter(
    ([k, v]) => v != null && v !== "" && !["remarks"].includes(k)
  );
  const iconFile = structureIconFile(structure);

  return (
    <div className="geovision-popup__body">
      <div className="geovision-popup__header">
        {iconFile && (
          <img
            src={structureIconUrl(iconFile)}
            alt={structure.label}
            className="geovision-popup__icon"
            width={48}
            height={58}
          />
        )}
        <div className="geovision-popup__header-text">
          <div className="geovision-popup__title">{structure.label}</div>
          <div className="geovision-popup__subtitle">
            {structureTypeLabel(structure.type)} · Ch {structure.chainage_km} km
          </div>
          <div
            className="geovision-popup__badge"
            style={{ borderColor: structureColor(structure.type), color: structureColor(structure.type) }}
          >
            Schedule-B
          </div>
        </div>
      </div>

      <dl className="geovision-popup__rows">
        <PopupRow label="Latitude" value={structure.lat.toFixed(6)} />
        <PopupRow label="Longitude" value={structure.lon.toFixed(6)} />
        {detailRows.slice(0, 6).map(([k, v]) => (
          <PopupRow key={k} label={k.replace(/_/g, " ")} value={String(v)} />
        ))}
        {details.remarks != null && String(details.remarks) !== "" && (
          <PopupRow label="Remarks" value={String(details.remarks)} />
        )}
      </dl>

      {project && (
        <>
          <div className="geovision-popup__section">Project</div>
          <dl className="geovision-popup__rows">
            <PopupRow label="Name" value={project.name} />
            <PopupRow label="Design length" value={`${project.stats.design_length_km ?? "—"} km`} />
          </dl>
        </>
      )}
    </div>
  );
}

function RoadCategoryPopupContent({
  point,
  project,
  index,
}: {
  point: MapPoint;
  project: Project | null;
  index: number;
}) {
  const style = roadCategoryStyle(point.name);
  return (
    <div className="geovision-popup__body">
      <div className="geovision-popup__title">{style.label}</div>
      <div className="geovision-popup__subtitle">Road category · #{index + 1}</div>
      <div className="geovision-popup__badge" style={{ borderColor: style.color, color: style.color }}>
        {point.name}
      </div>

      <dl className="geovision-popup__rows">
        <PopupRow label="Category" value={style.label} />
        <PopupRow label="KMZ label" value={point.name} />
        <PopupRow label="Latitude" value={point.lat.toFixed(6)} />
        <PopupRow label="Longitude" value={point.lon.toFixed(6)} />
        {point.alt != null && !Number.isNaN(point.alt) && (
          <PopupRow label="Elevation" value={`${point.alt} m`} />
        )}
      </dl>

      {project && (
        <>
          <div className="geovision-popup__section">Project</div>
          <dl className="geovision-popup__rows">
            <PopupRow label="Name" value={project.name} />
            <PopupRow label="Location" value={project.location || "—"} />
          </dl>
        </>
      )}
    </div>
  );
}

function TollPlazaPopupContent({
  point,
  project,
  index,
  nearestChainage = null,
  distM = null,
}: {
  point: MapPoint;
  project: Project | null;
  index: number;
  nearestChainage?: string | null;
  distM?: number | null;
}) {
  return (
    <div className="geovision-popup__body">
      <div className="geovision-popup__title">Toll Plaza</div>
      <div className="geovision-popup__subtitle">Location #{index + 1}</div>
      <div className="geovision-popup__badge" style={{ borderColor: "#f59e0b", color: "#f59e0b" }}>
        Toll Plaza
      </div>

      <dl className="geovision-popup__rows">
        {nearestChainage && (
          <PopupRow label="Nearest chainage" value={`CH ${nearestChainage}`} />
        )}
        {distM != null && (
          <PopupRow label="Offset from alignment" value={`${Math.round(distM)} m`} />
        )}
        <PopupRow label="Latitude" value={point.lat.toFixed(6)} />
        <PopupRow label="Longitude" value={point.lon.toFixed(6)} />
        {point.alt != null && !Number.isNaN(point.alt) && (
          <PopupRow label="Elevation" value={`${point.alt} m`} />
        )}
        {point.name !== "TOLL PLAZA" && <PopupRow label="KMZ label" value={point.name} />}
      </dl>

      {project && (
        <>
          <div className="geovision-popup__section">Project</div>
          <dl className="geovision-popup__rows">
            <PopupRow label="Name" value={project.name} />
            <PopupRow label="Location" value={project.location || "—"} />
          </dl>
        </>
      )}
    </div>
  );
}

function PointPopupContent({
  point,
  project,
  index,
}: {
  point: MapPoint;
  project: Project | null;
  index: number;
}) {
  const chainage = parseChainageLabel(point.name);
  const extra = Object.entries(point.properties).filter(
    ([k]) => !["name", "kind"].includes(k)
  );

  return (
    <div className="geovision-popup__body">
      <div className="geovision-popup__title">{point.name}</div>
      {chainage && <div className="geovision-popup__subtitle">Chainage · {chainage}</div>}
      <div className="geovision-popup__badge">{point.kind}</div>

      <dl className="geovision-popup__rows">
        <PopupRow label="Latitude" value={point.lat.toFixed(6)} />
        <PopupRow label="Longitude" value={point.lon.toFixed(6)} />
        {point.alt != null && !Number.isNaN(point.alt) && (
          <PopupRow label="Elevation" value={`${point.alt} m`} />
        )}
        <PopupRow label="Point #" value={String(index + 1)} />
      </dl>

      {project && (
        <>
          <div className="geovision-popup__section">Project</div>
          <dl className="geovision-popup__rows">
            <PopupRow label="Name" value={project.name} />
            <PopupRow label="Location" value={project.location || "—"} />
            <PopupRow label="Industry" value={project.industry} />
            {project.source_filename && (
              <PopupRow label="Source file" value={project.source_filename} />
            )}
          </dl>
        </>
      )}

      {extra.length > 0 && (
        <>
          <div className="geovision-popup__section">Additional properties</div>
          <dl className="geovision-popup__rows">
            {extra.map(([k, v]) => (
              <PopupRow key={k} label={k} value={String(v)} />
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

function GroundScourPointCard({ point }: { point: GroundScourPoint }) {
  const fmt = (v: number | null | undefined, digits = 2) =>
    v != null && Number.isFinite(v) ? v.toFixed(digits) : "—";

  const accent = groundScourDepthColor(point.scour_max_m);

  const Metric = ({
    label,
    value,
    highlight = false,
  }: {
    label: string;
    value: string;
    highlight?: boolean;
  }) => (
    <div
      className={`min-w-0 rounded-md px-2 py-1.5 ${
        highlight ? "bg-amber-400/10 ring-1 ring-amber-400/40" : "bg-white/[0.03]"
      }`}
    >
      <div className="text-[9px] uppercase leading-tight tracking-wide text-slate-500">{label}</div>
      <div
        className={`mt-0.5 truncate font-semibold tabular-nums ${
          highlight ? "text-[15px] text-amber-300" : "text-[11px] text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div className="space-y-2.5 p-3 text-[11px]">
      <div className="border-b border-white/10 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">
              Predictive_Bridge_Scour_Analysis · {point.id}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slate-400">
              Ch {fmt(point.chainage_km, 3)} km · {point.hydraulic_zone ?? "Zone"}
              {point.flow ? ` · ${point.flow}` : ""}
            </div>
          </div>
          <div
            className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{ borderColor: accent, color: accent }}
          >
            {fmt(point.scour_max_m)} m
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Location
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Latitude" value={fmt(point.latitude, 6)} />
          <Metric label="Longitude" value={fmt(point.longitude, 6)} />
        </div>
      </div>

      <div>
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Ground elevation
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="SRTM" value={`${fmt(point.ground_elev_m)} m`} />
          <Metric
            label="Corrected"
            value={`${fmt(point.ground_elev_corrected_m)} m`}
          />
        </div>
      </div>

      <div>
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Hydraulics
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric
            label="Seasons wet"
            value={
              point.seasons_wet_of_4 != null ? `${point.seasons_wet_of_4}/4` : "—"
            }
          />
          <Metric label="Depth, Pre-monsoon" value={`${fmt(point.d_pre_m, 3)} m`} />
          <Metric
            label="Depth, Post-monsoon / Design Flood"
            value={`${fmt(point.d_post_m, 3)} m`}
          />
          <Metric label="Velocity, Pre-monsoon" value={`${fmt(point.v_pre_ms, 3)} m/s`} />
          <Metric label="Velocity, Post-monsoon" value={`${fmt(point.v_post_ms, 3)} m/s`} />
          <Metric
            label="Unit Discharge, Post-monsoon"
            value={`${fmt(point.q_post_m3sm, 4)} m³/s/m`}
          />
        </div>
      </div>

      <div>
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Scour & design HFL
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Scour Depth, Minimum" value={`${fmt(point.scour_min_m)} m`} highlight />
          <Metric label="Scour Depth, Maximum" value={`${fmt(point.scour_max_m)} m`} highlight />
          <Metric
            label="Design High Flood Level"
            value={`${fmt(point.design_hfl_continuous_m)} m`}
          />
        </div>
      </div>
    </div>
  );
}

function PopupRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-xs">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="m-0 text-right font-medium text-slate-200 break-words">{value}</dd>
    </div>
  );
}

function ElevatedViaductCard({
  info,
  compact = false,
}: {
  info: ElevatedStructureInfo;
  compact?: boolean;
}) {
  const rows: Array<{ label: string; value: string; multiline?: boolean }> = [
    { label: "Structure Type", value: info.structureType },
    { label: "Chainage (From)", value: `${info.fromKm.toFixed(3)} km` },
    { label: "Chainage (To)", value: `${info.toKm.toFixed(3)} km` },
    {
      label: "Total Length",
      value: `${info.totalLengthKm.toFixed(3)} km (${info.totalLengthM.toLocaleString()} m)`,
    },
    {
      label: "LHS Roadway Width",
      value: info.lhsWidthM != null ? `${info.lhsWidthM.toFixed(2)} m` : "—",
    },
    {
      label: "RHS Roadway Width",
      value: info.rhsWidthM != null ? `${info.rhsWidthM.toFixed(2)} m` : "—",
    },
    { label: "Superstructure Provision in Median", value: info.medianSuperstructure },
    { label: "Span Arrangement", value: info.spanArrangement, multiline: true },
    {
      label: "Minimum Vertical Clearance",
      value: info.verticalClearanceM != null ? `${info.verticalClearanceM.toFixed(1)} m` : "—",
    },
  ];

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-sky-400/25 bg-sky-500/5 p-2"
          : "rounded-xl border border-sky-400/35 bg-sky-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full shadow-[0_0_10px_rgba(77,232,255,0.45)]"
            : "mb-2 h-3 w-full shrink-0 rounded-sm shadow-[0_0_12px_rgba(77,232,255,0.55)]"
        }
        style={{ backgroundColor: ELEVATED_VIADUCT_COLOR }}
      />
      {!compact && (
        <div className="mb-1 text-[11px] font-semibold leading-snug text-white">Elevated Viaduct</div>
      )}
      <div className="text-[9px] font-medium uppercase tracking-wide text-sky-300">
        Schedule-B structure
      </div>
      <div className="mt-2 space-y-1.5 text-[10px] text-slate-400">
        {rows.map((row) => (
          <div
            key={row.label}
            className={row.multiline ? "flex flex-col gap-0.5" : "flex justify-between gap-2"}
          >
            <span className="shrink-0">{row.label}</span>
            <span
              className={`tabular-nums text-slate-100 ${
                row.multiline ? "font-medium leading-snug" : "text-right font-semibold"
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServiceRoadCard({
  info,
  compact = false,
}: {
  info: ServiceRoadInfo;
  compact?: boolean;
}) {
  const accent = "#3b82f6";

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="tabular-nums font-semibold text-slate-100">{value}</span>
    </div>
  );

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-blue-400/25 bg-blue-500/5 p-2"
          : "rounded-xl border border-blue-400/35 bg-blue-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      {!compact && (
        <div className="mb-1 text-[11px] font-semibold leading-snug text-white">Service Roads</div>
      )}
      <div className="space-y-1.5 text-[10px]">
        <Row label="Total Sections" value={String(info.totalSections)} />
        <Row label="Total Length" value={`${info.overallLengthKm.toFixed(3)} km`} />

        <div className="border-t border-white/10 pt-1.5">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-blue-300">
            VUP Section
          </div>
          <div className="space-y-1 pl-1.5">
            <div className="flex justify-between gap-2 text-slate-400">
              <span>• Sections</span>
              <span className="tabular-nums font-semibold text-slate-100">{info.vupSections}</span>
            </div>
            <div className="flex justify-between gap-2 text-slate-400">
              <span>• Total Length</span>
              <span className="tabular-nums font-semibold text-slate-100">
                {info.vupLengthKm.toFixed(3)} km
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-1.5">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-blue-300">
            Main Carriageway
          </div>
          <div className="space-y-1 pl-1.5">
            <div className="flex justify-between gap-2 text-slate-400">
              <span>• Sections</span>
              <span className="tabular-nums font-semibold text-slate-100">
                {info.mainCarriagewaySections}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-slate-400">
              <span>• Total Length</span>
              <span className="tabular-nums font-semibold text-slate-100">
                {info.mainCarriagewayLengthKm.toFixed(3)} km
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReWallCard({
  info,
  compact = false,
}: {
  info: ReWallLocationSummary;
  compact?: boolean;
}) {
  const accent = "#f97316";

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="tabular-nums font-semibold text-slate-100">{value}</span>
    </div>
  );

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-orange-400/25 bg-orange-500/5 p-2"
          : "rounded-xl border border-orange-400/35 bg-orange-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="space-y-1.5 text-[10px]">
        <Row label="RE Wall Locations" value={String(info.count)} />
        <Row label="Total Coverage" value={`${info.totalCoverageKm.toFixed(3)} km`} />
        {info.fromKm != null && info.toKm != null && (
          <Row label="Chainage Span" value={`Ch ${info.fromKm}–${info.toKm} km`} />
        )}

        <div className="border-t border-white/10 pt-1.5">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-orange-300">
            Segments
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto pl-1.5">
            {info.segments.map((s) => (
              <div key={s.name} className="flex justify-between gap-2 text-slate-400">
                <span className="truncate">
                  •{" "}
                  {s.fromKm != null && s.toKm != null
                    ? `Ch ${s.fromKm}–${s.toKm}`
                    : s.name}
                </span>
                <span className="shrink-0 tabular-nums font-semibold text-slate-100">
                  {s.lengthKm != null ? `${s.lengthKm.toFixed(3)} km` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InterchangeCard({
  info,
  compact = false,
}: {
  info: InterchangeSummary;
  compact?: boolean;
}) {
  const accent = "#eab308";

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="tabular-nums font-semibold text-slate-100">{value}</span>
    </div>
  );

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-yellow-400/25 bg-yellow-500/5 p-2"
          : "rounded-xl border border-yellow-400/35 bg-yellow-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="space-y-1.5 text-[10px]">
        <Row label="Ramp Alignments" value={String(info.count)} />
        <Row label="Total Length" value={`${info.totalLengthKm.toFixed(3)} km`} />
        {info.longestKm != null && (
          <Row label="Longest Ramp" value={`${info.longestKm.toFixed(3)} km`} />
        )}
        {info.avgKm != null && (
          <Row label="Average Length" value={`${info.avgKm.toFixed(3)} km`} />
        )}
      </div>
    </div>
  );
}

function DrainCard({
  info,
  compact = false,
}: {
  info: DrainInfo;
  compact?: boolean;
}) {
  const accent = "#06b6d4";

  const rows: Array<{ label: string; value: string; multiline?: boolean }> = [
    { label: "Structure Type", value: info.structureType },
    { label: "Drain Category", value: info.drainCategory, multiline: true },
    {
      label: "Total Sections",
      value: `${info.totalSections} (${info.rccDrainSections} RCC Drains + ${info.rccDrainCumFootpathSections} RCC Drain cum Footpath)`,
      multiline: true,
    },
    { label: "Total Drain Length", value: `${info.totalLengthKm.toFixed(3)} km` },
    { label: "Chainage", value: "Design Chainage (From–To)" },
    { label: "Side", value: "LHS / RHS / Both" },
  ];

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-cyan-400/25 bg-cyan-500/5 p-2"
          : "rounded-xl border border-cyan-400/35 bg-cyan-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="space-y-1.5 text-[10px] text-slate-400">
        {rows.map((row) => (
          <div
            key={row.label}
            className={row.multiline ? "flex flex-col gap-0.5" : "flex justify-between gap-2"}
          >
            <span className="shrink-0 leading-snug">{row.label}</span>
            <span
              className={`text-slate-100 ${
                row.multiline ? "font-medium leading-snug" : "text-right font-semibold tabular-nums"
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShoulderCard({
  info,
  compact = false,
}: {
  info: ShoulderInfo;
  compact?: boolean;
}) {
  const accent = "#94a3b8";

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="tabular-nums font-semibold text-slate-100">{value}</span>
    </div>
  );

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-slate-400/25 bg-slate-500/5 p-2"
          : "rounded-xl border border-slate-400/35 bg-slate-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="space-y-1.5 text-[10px]">
        <Row label="Total Sections" value={String(info.totalSections)} />
        <Row label="Total Length" value={`${info.totalLengthKm.toFixed(3)} km`} />

        <div className="border-t border-white/10 pt-1.5">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-300">
            Paved Shoulder
          </div>
          <div className="space-y-1 pl-1.5">
            <div className="flex justify-between gap-2 text-slate-400">
              <span>• Sections</span>
              <span className="tabular-nums font-semibold text-slate-100">{info.pavedSections}</span>
            </div>
            <div className="flex justify-between gap-2 text-slate-400">
              <span>• Total Length</span>
              <span className="tabular-nums font-semibold text-slate-100">
                {info.pavedLengthKm.toFixed(3)} km
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-1.5">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-300">
            Earthen Shoulder
          </div>
          <div className="space-y-1 pl-1.5">
            <div className="flex justify-between gap-2 text-slate-400">
              <span>• Sections</span>
              <span className="tabular-nums font-semibold text-slate-100">
                {info.earthenSections}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-slate-400">
              <span>• Total Length</span>
              <span className="tabular-nums font-semibold text-slate-100">
                {info.earthenLengthKm.toFixed(3)} km
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoadCategoriesSummaryCard({ compact = false }: { compact?: boolean }) {
  const accent = "#22c55e";
  const rows: RoadCategoryDetail[] = ROAD_CATEGORY_DETAILS;

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-emerald-400/25 bg-emerald-500/5 p-2"
          : "rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-emerald-300">
        Lane configuration / TCS
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto text-[10px]">
        {rows.map((row) => (
          <div
            key={row.category}
            className="space-y-0.5 rounded-md border border-white/10 bg-white/[0.03] p-1.5"
          >
            <div className="flex items-start gap-1.5">
              <span
                className="mt-0.5 h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: row.color }}
              />
              <span className="min-w-0 flex-1 font-semibold leading-snug text-slate-100">
                {row.category}
              </span>
            </div>
            <div className="flex justify-between gap-2 pl-3.5 text-slate-400">
              <span>Structure</span>
              <span className="text-right text-slate-200">{row.structureType}</span>
            </div>
            <div className="flex justify-between gap-2 pl-3.5 text-slate-400">
              <span>TCS</span>
              <span className="tabular-nums font-semibold text-slate-100">{row.tcs}</span>
            </div>
            <div className="flex justify-between gap-2 pl-3.5 text-slate-400">
              <span>Stretch</span>
              <span className="text-right font-semibold text-emerald-200">{row.stretch}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoadFormationSummaryCard({
  info,
  compact = false,
}: {
  info: RoadFormationSummary;
  compact?: boolean;
}) {
  const accent = "#f59e0b";
  const rows: Array<{ label: string; value: string }> = [
    { label: "Points", value: info.pointCount.toLocaleString() },
    { label: "Lines", value: `${info.branchCount} (LHS / CL / RHS)` },
    {
      label: "Chainage",
      value: `${info.fromKm?.toFixed(2) ?? "—"}–${info.toKm?.toFixed(2) ?? "—"} km`,
    },
    {
      label: "Formation level",
      value: `${info.formationMinM?.toFixed(1) ?? "—"}–${info.formationMaxM?.toFixed(1) ?? "—"} m`,
    },
    {
      label: "Ground elev",
      value: `${info.groundMinM?.toFixed(1) ?? "—"}–${info.groundMaxM?.toFixed(1) ?? "—"} m`,
    },
  ];

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-amber-400/25 bg-amber-500/5 p-2"
          : "rounded-xl border border-amber-400/35 bg-amber-500/10 p-2.5"
      }
    >
      <div
        className={compact ? "mb-2 h-1.5 w-full rounded-full" : "mb-2 h-3 w-full rounded-sm"}
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-amber-300">
        Road Formation Level · Schedule-B
      </div>
      <div className="space-y-1 text-[10px]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2">
            <span className="text-slate-400">{row.label}</span>
            <span className="tabular-nums font-medium text-white">{row.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[10px]">
        {(
          [
            ["lhs", "LHS 30M"],
            ["centerline", "Centerline"],
            ["rhs", "RHS 30M"],
          ] as const
        ).map(([id, label]) => (
          <div key={id} className="flex items-center gap-1.5 text-slate-300">
            <span
              className="h-1 w-4 shrink-0 rounded-full"
              style={{ backgroundColor: ROAD_FORMATION_BRANCH_COLORS[id] }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function GroundScourSummaryCard({
  info,
  compact = false,
}: {
  info: GroundScourSummary;
  compact?: boolean;
}) {
  const accent = "#f43f5e";
  const rows: Array<{ label: string; value: string }> = [
    { label: "Points", value: info.pointCount.toLocaleString() },
    { label: "Stretches", value: String(info.stretchCount) },
    {
      label: "Chainage",
      value: `${info.fromKm?.toFixed(2) ?? "—"}–${info.toKm?.toFixed(2) ?? "—"} km`,
    },
    {
      label: "Scour range",
      value: `${info.scourMinM?.toFixed(2) ?? "—"}–${info.scourMaxM?.toFixed(2) ?? "—"} m`,
    },
    {
      label: "Design HFL",
      value: `${info.designHflMinM?.toFixed(2) ?? "—"}–${info.designHflMaxM?.toFixed(2) ?? "—"} m`,
    },
  ];

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-rose-400/25 bg-rose-500/5 p-2"
          : "rounded-xl border border-rose-400/35 bg-rose-500/10 p-2.5"
      }
    >
      <div
        className={compact ? "mb-2 h-1.5 w-full rounded-full" : "mb-2 h-3 w-full rounded-sm"}
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-rose-300">
        Predictive_Bridge_Scour_Analysis
      </div>
      <div className="space-y-1 text-[10px]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2">
            <span className="text-slate-400">{row.label}</span>
            <span className="tabular-nums font-medium text-white">{row.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 border-t border-white/10 pt-2 text-[9px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> &lt;2 m
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-yellow-500" /> 2–5 m
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-orange-500" /> 5–8 m
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" /> ≥8 m
        </span>
      </div>
    </div>
  );
}

function TollPlazaSummaryCard({
  info,
  compact = false,
}: {
  info: {
    totalCount: number;
    items: Array<{
      id: string;
      label: string;
      nearestChainage: string | null;
      distM: number | null;
    }>;
  };
  compact?: boolean;
}) {
  const accent = "#f59e0b";

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-amber-400/25 bg-amber-500/5 p-2"
          : "rounded-xl border border-amber-400/35 bg-amber-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-amber-300">
        Toll plaza locations
      </div>
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between gap-2 text-slate-400">
          <span>• Total Toll Plazas</span>
          <span className="tabular-nums font-semibold text-slate-100">{info.totalCount}</span>
        </div>
        <div className="max-h-48 space-y-1.5 overflow-y-auto border-t border-white/10 pt-1.5">
          {info.items.map((row) => (
            <div key={row.id} className="space-y-0.5">
              <div className="flex justify-between gap-2 text-slate-300">
                <span className="min-w-0 truncate font-medium">• {row.label}</span>
              </div>
              <div className="flex justify-between gap-2 pl-2 text-slate-400">
                <span>Nearest chainage</span>
                <span className="tabular-nums font-semibold text-amber-200">
                  {row.nearestChainage ? `CH ${row.nearestChainage}` : "—"}
                </span>
              </div>
              {row.distM != null && (
                <div className="flex justify-between gap-2 pl-2 text-slate-500">
                  <span>Offset</span>
                  <span className="tabular-nums">{Math.round(row.distM)} m</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChainagePointsSummaryCard({
  info,
  compact = false,
}: {
  info: {
    totalCount: number;
    startChainage: string;
    endChainage: string;
  };
  compact?: boolean;
}) {
  const accent = "#3b82f6";
  const rows: Array<{ label: string; value: string }> = [
    { label: "Total Chainage Count", value: info.totalCount.toLocaleString() },
    { label: "Starting Chainage", value: `CH ${info.startChainage}` },
    { label: "Last Chainage", value: `CH ${info.endChainage}` },
  ];

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-blue-400/25 bg-blue-500/5 p-2"
          : "rounded-xl border border-blue-400/35 bg-blue-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-blue-300">
        Station ticks
      </div>
      <div className="space-y-1 text-[10px]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2 text-slate-400">
            <span className="shrink-0">• {row.label}</span>
            <span className="text-right font-semibold tabular-nums text-slate-100">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LulcSummaryCard({
  info,
  compact = false,
}: {
  info: LulcSummaryInfo;
  compact?: boolean;
}) {
  const accent = "#33a02c";
  const order = ["Water", "Built-up", "Bareland", "Agriculture", "Forest"];
  const classes = [...info.classes].sort(
    (a, b) => order.indexOf(a.name) - order.indexOf(b.name),
  );

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-emerald-400/25 bg-emerald-500/5 p-2"
          : "rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-emerald-300">
        Updated LULC area (m²)
      </div>
      <div className="space-y-1 text-[10px]">
        {classes.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-2 text-slate-400">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate">• {row.name}</span>
            </span>
            <span className="tabular-nums font-semibold text-slate-100">
              {row.areaM2.toLocaleString()} m²
            </span>
          </div>
        ))}
        <div className="flex justify-between gap-2 border-t border-white/10 pt-1.5 text-slate-300">
          <span className="font-semibold">• TOTAL</span>
          <span className="tabular-nums font-semibold text-white">
            {info.totalAreaM2.toLocaleString()} m²
          </span>
        </div>
      </div>
    </div>
  );
}

function RailwayLinesSummaryCard({
  info,
  compact = false,
}: {
  info: RailwayLinesSummary;
  compact?: boolean;
}) {
  const accent = "#e2e8f0";

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-slate-400/25 bg-slate-500/5 p-2"
          : "rounded-xl border border-slate-400/35 bg-slate-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-slate-300">
        Track centreline
      </div>
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between gap-2 text-slate-400">
          <span>• Total Segments</span>
          <span className="tabular-nums font-semibold text-slate-100">
            {info.segmentCount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-2 text-slate-400">
          <span>• Approx. Length</span>
          <span className="tabular-nums font-semibold text-slate-100">
            {info.lengthKm.toFixed(1)} km
          </span>
        </div>
        <div className="flex justify-between gap-2 text-slate-400">
          <span>• Named Routes</span>
          <span className="tabular-nums font-semibold text-slate-100">{info.namedRoutes}</span>
        </div>
        <div className="flex justify-between gap-2 text-slate-400">
          <span>• Main Usage</span>
          <span className="tabular-nums font-semibold text-slate-100">{info.mainUsageCount}</span>
        </div>
        <div className="flex justify-between gap-2 text-slate-400">
          <span>• Electrified</span>
          <span className="tabular-nums font-semibold text-slate-100">{info.electrifiedCount}</span>
        </div>
        {info.topRoutes.length > 0 && (
          <div className="border-t border-white/10 pt-1.5 space-y-1">
            {info.topRoutes.map((row) => (
              <div key={row.name} className="flex justify-between gap-2 text-slate-400">
                <span className="min-w-0 truncate">• {row.name}</span>
                <span className="shrink-0 tabular-nums font-semibold text-slate-100">
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RailwayStationsSummaryCard({
  info,
  compact = false,
}: {
  info: RailwayStationsSummary;
  compact?: boolean;
}) {
  const accent = "#f97316";

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-orange-400/25 bg-orange-500/5 p-2"
          : "rounded-xl border border-orange-400/35 bg-orange-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-orange-300">
        Station locations
      </div>
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between gap-2 text-slate-400">
          <span>• Total Stations</span>
          <span className="tabular-nums font-semibold text-slate-100">{info.count}</span>
        </div>
        <div className="border-t border-white/10 pt-1.5 space-y-1 max-h-40 overflow-y-auto">
          {info.names.map((name) => (
            <div key={name} className="text-slate-400">
              • {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RailwayPlatformsSummaryCard({
  info,
  compact = false,
}: {
  info: RailwayPlatformsSummary;
  compact?: boolean;
}) {
  const accent = "#38bdf8";

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-sky-400/25 bg-sky-500/5 p-2"
          : "rounded-xl border border-sky-400/35 bg-sky-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-sky-300">
        Platform footprints
      </div>
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between gap-2 text-slate-400">
          <span>• Total Platforms</span>
          <span className="tabular-nums font-semibold text-slate-100">{info.count}</span>
        </div>
        <div className="flex justify-between gap-2 text-slate-400">
          <span>• Named Platforms</span>
          <span className="tabular-nums font-semibold text-slate-100">{info.namedCount}</span>
        </div>
      </div>
    </div>
  );
}

function RoadNetworkSummaryCard({
  data,
  compact = false,
}: {
  data: RoadNetworkData;
  compact?: boolean;
}) {
  const accent = "#f59e0b";
  const rows = data.highway_counts.slice(0, 10);

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-amber-400/25 bg-amber-500/5 p-2"
          : "rounded-xl border border-amber-400/35 bg-amber-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-amber-300">
        Within 1 km buffer
      </div>
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between gap-2 text-slate-400">
          <span className="shrink-0">• Total Segments</span>
          <span className="text-right font-semibold tabular-nums text-slate-100">
            {data.count.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-2 text-slate-400">
          <span className="shrink-0">• Road Classes</span>
          <span className="text-right font-semibold tabular-nums text-slate-100">
            {data.highway_counts.length}
          </span>
        </div>
        <div className="border-t border-white/10 pt-1.5 space-y-1">
          {rows.map((row) => {
            const s = highwayStyle(row.highway);
            return (
              <div key={row.highway} className="flex items-center justify-between gap-2 text-slate-400">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-0.5 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="truncate">• {s.label}</span>
                </span>
                <span className="tabular-nums font-semibold text-slate-100">{row.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TreesSummaryCard({
  info,
  compact = false,
}: {
  info: TreesSummaryInfo;
  compact?: boolean;
}) {
  const accent = "#22c55e";
  const rows: Array<{ label: string; value: string }> = [
    { label: "Total Trees", value: info.totalTrees.toLocaleString() },
    { label: "Corridor Zones", value: info.corridorZones.toLocaleString() },
    {
      label: "Total Canopy Area",
      value: `${info.totalCanopyAreaM2.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} m²`,
    },
    { label: "Average Tree Height", value: `${info.avgHeightM.toFixed(2)} m` },
    { label: "Tallest Tree", value: `${info.tallestM.toFixed(2)} m` },
    { label: "Shortest Tree", value: `${info.shortestM.toFixed(2)} m` },
    {
      label: "Largest Canopy",
      value: `${info.largestCanopyM2.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} m²`,
    },
  ];

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-emerald-400/25 bg-emerald-500/5 p-2"
          : "rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-emerald-300">
        Within 50 m corridor
      </div>
      <div className="space-y-1 text-[10px]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2 text-slate-400">
            <span className="shrink-0">• {row.label}</span>
            <span className="text-right font-semibold tabular-nums text-slate-100">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StructuresPointsCard({
  info,
  compact = false,
}: {
  info: StructuresPointsInfo;
  compact?: boolean;
}) {
  const accent = "#f59e0b";

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-amber-400/25 bg-amber-500/5 p-2"
          : "rounded-xl border border-amber-400/35 bg-amber-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-amber-300">
        Underpasses, interchanges, culverts, elevated
      </div>
      <div className="space-y-1.5 text-[10px]">
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Total Structures</span>
          <span className="tabular-nums font-semibold text-slate-100">{info.total}</span>
        </div>
        <div className="border-t border-white/10 pt-1.5 space-y-1">
          {info.byType.map((row) => (
            <div key={row.type} className="flex items-center justify-between gap-2 text-slate-400">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="truncate">• {row.label}</span>
              </span>
              <span className="tabular-nums font-semibold text-slate-100">{row.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectAlignmentCard({
  info,
  compact = false,
}: {
  info: ProjectAlignmentInfo;
  compact?: boolean;
}) {
  const accent = "#c026d3";
  const rows: Array<{ label: string; value: string }> = [
    { label: "Total Length", value: `${info.totalLengthKm.toFixed(3)} km` },
    { label: "Existing Length", value: `${info.existingLengthKm.toFixed(3)} km` },
    { label: "Number of Lanes", value: String(info.numberOfLanes) },
    { label: "Alignment Type", value: info.alignmentType },
    { label: "Elevated Section", value: `${info.elevatedSectionKm.toFixed(3)} km` },
    { label: "At-grade Section", value: `${info.atGradeSectionKm.toFixed(3)} km` },
    { label: "Median Width", value: `${info.medianWidthM.toFixed(2)} m` },
    { label: "Shoulder Width", value: info.shoulderWidth },
    {
      label: "Design Speed",
      value: `${info.designSpeedKmh} km/h${info.designSpeedNote}`,
    },
    { label: "Service Roads", value: `${info.serviceRoadsKm.toFixed(3)} km` },
    { label: "Start Chainage", value: `CH ${formatChainage(info.startChainageKm)}` },
    { label: "End Chainage", value: `CH ${formatChainage(info.endChainageKm)}` },
    {
      label: "Square Meters (m²)",
      value: info.areaM2.toLocaleString(undefined, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
    },
    { label: "Square Kilometers (km²)", value: `${info.areaKm2.toFixed(4)} km²` },
    {
      label: "Acres",
      value: `${info.areaAcres.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} acres`,
    },
  ];

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-fuchsia-400/25 bg-fuchsia-500/5 p-2"
          : "rounded-xl border border-fuchsia-400/35 bg-fuchsia-500/10 p-2.5"
      }
    >
      <div
        className={
          compact
            ? "mb-2 h-1.5 w-full shrink-0 rounded-full"
            : "mb-2 h-3 w-full shrink-0 rounded-sm"
        }
        style={{ backgroundColor: accent }}
      />
      <div className="space-y-1 text-[10px]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2 text-slate-400">
            <span className="shrink-0">• {row.label}</span>
            <span className="text-right font-semibold tabular-nums text-slate-100">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <dl className="space-y-1">{children}</dl>
    </div>
  );
}

/** Format a chainage in km as engineering notation, e.g. 18.45 → "18+450". */
function formatChainage(km: number): string {
  const whole = Math.floor(km);
  const metres = Math.round((km - whole) * 1000);
  return `${whole}+${String(metres).padStart(3, "0")}`;
}

function AlignmentColorLegend({ items }: { items: Array<{ color: string; label: string }> }) {
  const shown = items.slice(0, 12);
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="mb-2 text-xs font-semibold text-white">Alignment colours (from KMZ)</div>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {shown.map(({ color, label }) => (
          <div key={color + label} className="flex items-center gap-2 text-xs text-slate-300">
            <span className="h-2.5 w-6 shrink-0 rounded" style={{ background: color }} />
            <span className="truncate">{label}</span>
          </div>
        ))}
        {items.length > shown.length && (
          <div className="text-[10px] text-slate-500">+{items.length - shown.length} more</div>
        )}
      </div>
    </div>
  );
}

function SlopeLegend() {
  const items = [
    ["#22c55e", "0–5% Easy"],
    ["#eab308", "5–10% Moderate"],
    ["#f97316", "10–20% Difficult"],
    ["#ef4444", ">20% Severe"],
  ];
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="mb-2 text-xs font-semibold text-white">Slope severity (simulated)</div>
      <div className="space-y-1">
        {items.map(([c, l]) => (
          <div key={l} className="flex items-center gap-2 text-xs text-slate-300">
            <span className="h-2.5 w-6 rounded" style={{ background: c }} /> {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoadCategoryLegend() {
  const items = ["2-LANE", "6-LANE", "2+2-LANE Both Side", "8-LANE"];
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="mb-2 text-xs font-semibold text-white">Road categories</div>
      <div className="space-y-1">
        {items.map((name) => {
          const style = roadCategoryStyle(name);
          return (
            <div key={name} className="flex items-center gap-2 text-xs text-slate-300">
              <span
                className="grid h-5 min-w-[2rem] place-items-center rounded-full px-1 text-[9px] font-bold text-slate-900"
                style={{ background: `linear-gradient(135deg, ${style.gradient[0]}, ${style.gradient[1]})` }}
              >
                {style.shortLabel}
              </span>
              {style.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FitBounds({ project }: { project: Project | null }) {
  const map = useMap();
  useEffect(() => {
    if (project) {
      const [minX, minY, maxX, maxY] = project.stats.bounds;
      map.fitBounds(
        [
          [minY, minX],
          [maxY, maxX],
        ],
        { padding: [40, 40] }
      );
    }
  }, [project, map]);
  return null;
}

function MapResizeOnPanel({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(timer);
  }, [active, map]);
  return null;
}

/**
 * Keeps Leaflet's cached size in sync with its container. Any layout change
 * (sidebar toggle, flood / elevation panel, window resize) triggers a debounced
 * invalidateSize so tiles fill the whole viewport instead of leaving blank areas.
 */
function MapAutoResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    });
    ro.observe(container);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

function useLayerBlinkPulse(active: boolean): boolean {
  const [bright, setBright] = useState(true);
  useEffect(() => {
    if (!active) {
      setBright(true);
      return;
    }
    const id = window.setInterval(() => setBright((v) => !v), 400);
    return () => window.clearInterval(id);
  }, [active]);
  return bright;
}

function SbLineLayer({
  features,
  color,
  weight,
  opacity,
  dash,
  unit,
  blink = false,
}: {
  features: SbLineFeature[];
  color: string;
  weight: number;
  opacity: number;
  dash?: string;
  unit: string;
  blink?: boolean;
}) {
  const svgRenderer = useMemo(() => L.svg({ padding: 0.5 }), []);
  return (
    <>
      {features.map((f, i) => (
        <Polyline
          key={`${unit}-${i}-${blink ? "blink" : "steady"}`}
          positions={f.positions}
          pathOptions={{
            color: f.color ?? color,
            weight: blink ? weight + 2 : weight,
            opacity,
            dashArray: dash,
            lineCap: "round",
            lineJoin: "round",
            className: blink ? "active-layer-blink" : undefined,
          }}
          {...(blink ? { renderer: svgRenderer } : {})}
        >
          <Tooltip direction="top" opacity={0.95} className="geovision-tooltip" sticky>
            <span className="font-semibold">{f.label}</span>
            <br />
            <span className="text-slate-400">
              {unit} · Ch {f.from}–{f.to} km
              {f.details.hydraulic_zone != null ? ` · ${String(f.details.hydraulic_zone)}` : ""}
            </span>
          </Tooltip>
          <Popup className="geovision-popup" minWidth={240} maxWidth={340}>
            <SbLinePopupContent title={f.label} unit={unit} details={f.details} />
          </Popup>
        </Polyline>
      ))}
    </>
  );
}

function SbLinePopupContent({
  title,
  unit,
  details,
}: {
  title: string;
  unit: string;
  details: Record<string, unknown>;
}) {
  const rows = Object.entries(details).filter(
    ([, v]) => v != null && v !== "" && String(v) !== "null"
  );
  return (
    <div className="geovision-popup__body">
      <div className="geovision-popup__title">{title}</div>
      <div className="geovision-popup__subtitle">{unit}</div>
      <dl className="geovision-popup__rows">
        {rows.slice(0, 10).map(([k, v]) => (
          <PopupRow key={k} label={k.replace(/_/g, " ")} value={String(v)} />
        ))}
      </dl>
    </div>
  );
}

function ElevationProfileMarkers({
  points,
  focus,
  onPointClick,
  interactive = true,
}: {
  points: Array<ElevationPoint & { latitude: number; longitude: number }>;
  focus: { lat: number; lon: number; chainage: number; elevation: number } | null;
  onPointClick: (point: ElevationPoint) => void;
  interactive?: boolean;
}) {
  const branchColor = (branch?: string) => {
    if (branch === "lhs") return "#3b82f6";
    if (branch === "rhs") return "#f59e0b";
    return "#12c9b0";
  };

  const byBranch = useMemo(() => {
    const map = new Map<string, Array<ElevationPoint & { latitude: number; longitude: number }>>();
    for (const p of points) {
      const key = p.branch ?? "centerline";
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [points]);

  const nearestAt = (
    branch: string,
    chainage: number,
  ): (ElevationPoint & { latitude: number; longitude: number }) | undefined => {
    const list = byBranch.get(branch);
    if (!list?.length) return undefined;
    let best = list[0];
    let bestD = Infinity;
    for (const p of list) {
      const d = Math.abs(p.chainage - chainage);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  };

  return (
    <>
      {points.map((p) => {
        const color = branchColor(p.branch);
        const isFocused =
          focus != null &&
          focus.chainage === p.chainage &&
          Math.abs(focus.lat - p.latitude) < 1e-5 &&
          Math.abs(focus.lon - p.longitude) < 1e-5;
        const lhs = nearestAt("lhs", p.chainage);
        const centre = nearestAt("centerline", p.chainage);
        const rhs = nearestAt("rhs", p.chainage);
        const ch = centre?.chainage ?? p.chainage;
        return (
          <CircleMarker
            key={`elev-${p.branch ?? "c"}-${p.chainage}-${p.latitude}-${p.longitude}`}
            center={[p.latitude, p.longitude]}
            radius={isFocused ? 7 : 3}
            pathOptions={{
              color: isFocused ? "#ffffff" : color,
              fillColor: isFocused ? color : color,
              fillOpacity: isFocused ? 1 : 0.9,
              weight: isFocused ? 2 : 1,
              interactive,
            }}
            eventHandlers={interactive ? { click: () => onPointClick(p) } : undefined}
          >
            {interactive && (
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
              <span>
                Ch {ch.toFixed(2)} km
                {lhs != null && (
                  <>
                    {" · "}
                    <span style={{ background: "#3b82f6", color: "#fff", padding: "0 3px", borderRadius: 2 }}>
                      LHS {lhs.elevation.toFixed(1)} m
                    </span>
                  </>
                )}
                {" · "}
                <span style={{ background: "#12c9b0", color: "#042f2e", padding: "0 3px", borderRadius: 2 }}>
                  Centre {(centre?.elevation ?? p.elevation).toFixed(1)} m
                </span>
                {rhs != null && (
                  <>
                    {" · "}
                    <span style={{ background: "#f59e0b", color: "#1c1917", padding: "0 3px", borderRadius: 2 }}>
                      RHS {rhs.elevation.toFixed(1)} m
                    </span>
                  </>
                )}
              </span>
            </Tooltip>
            )}
          </CircleMarker>
        );
      })}
    </>
  );
}

function FlyToElevationPoint({
  focus,
  crossSection,
  scrubbing = false,
}: {
  focus: { lat: number; lon: number; chainage: number; elevation: number } | null;
  crossSection?: Array<{
    lat: number;
    lon: number;
    elevation: number;
    branch: string;
    chainage: number;
  }> | null;
  scrubbing?: boolean;
}) {
  const map = useMap();
  const zoomedRef = useRef(false);

  useEffect(() => {
    if (!focus) {
      zoomedRef.current = false;
      return;
    }
    const zoom = Math.max(map.getZoom(), 15);
    // Instant pan while dragging — animated pan stacks and feels laggy
    map.setView([focus.lat, focus.lon], zoom, { animate: !scrubbing });
    if (!scrubbing) zoomedRef.current = true;
  }, [focus?.chainage, focus?.lat, focus?.lon, scrubbing, map]);

  if (!focus) return null;

  const branchColor = (branch: string) => {
    if (branch === "lhs") return "#3b82f6";
    if (branch === "rhs") return "#f59e0b";
    return "#12c9b0";
  };

  const section = crossSection ?? [];
  const linePositions = section.map((p) => [p.lat, p.lon] as [number, number]);
  const lhsEl = section.find((p) => p.branch === "lhs")?.elevation;
  const centreEl =
    section.find((p) => p.branch === "centerline")?.elevation ?? focus.elevation;
  const rhsEl = section.find((p) => p.branch === "rhs")?.elevation;

  return (
    <>
      {linePositions.length >= 2 && (
        <Polyline
          positions={linePositions}
          pathOptions={{ color: "#ffffff", weight: 3, opacity: 0.85, dashArray: "6 4" }}
        />
      )}
      <Circle
        center={[focus.lat, focus.lon]}
        radius={80}
        pathOptions={{ color: "#12c9b0", fillColor: "#12c9b0", fillOpacity: 0.12, weight: 2 }}
      />
      {section.map((p) => (
        <CircleMarker
          key={`xs-${p.branch}-${p.chainage}`}
          center={[p.lat, p.lon]}
          radius={p.branch === "centerline" ? 8 : 6}
          pathOptions={{
            color: "#ffffff",
            fillColor: branchColor(p.branch),
            fillOpacity: 1,
            weight: 2,
          }}
        />
      ))}
      <CircleMarker
        center={[focus.lat, focus.lon]}
        radius={section.some((p) => p.branch === "centerline") ? 0.01 : 8}
        pathOptions={{
          color: "#38e1c6",
          fillColor: "#38e1c6",
          fillOpacity: section.some((p) => p.branch === "centerline") ? 0 : 1,
          weight: section.some((p) => p.branch === "centerline") ? 0 : 2,
          opacity: section.some((p) => p.branch === "centerline") ? 0 : 1,
        }}
      >
        <Tooltip direction="top" offset={[0, -12]} opacity={0.95} permanent>
          <span>
            Ch {focus.chainage.toFixed(2)} km
            {lhsEl != null && (
              <>
                {" · "}
                <span style={{ background: "#3b82f6", color: "#fff", padding: "0 3px", borderRadius: 2 }}>
                  LHS {lhsEl.toFixed(1)} m
                </span>
              </>
            )}
            {" · "}
            <span style={{ background: "#12c9b0", color: "#042f2e", padding: "0 3px", borderRadius: 2 }}>
              Centre {centreEl.toFixed(1)} m
            </span>
            {rhsEl != null && (
              <>
                {" · "}
                <span style={{ background: "#f59e0b", color: "#1c1917", padding: "0 3px", borderRadius: 2 }}>
                  RHS {rhsEl.toFixed(1)} m
                </span>
              </>
            )}
          </span>
        </Tooltip>
      </CircleMarker>
    </>
  );
}

/** Highlights the road-formation scrubber position on the 2D map (LHS / CL / RHS). */
function RoadFormationScrubMarkers({
  sample,
  visibility = DEFAULT_ROAD_FORMATION_VISIBILITY,
}: {
  sample: RoadFormationScrubSample | null;
  visibility?: RoadFormationSeriesVisibility;
}) {
  const map = useMap();

  const visiblePoints =
    sample?.points.filter(
      (p) => visibility[p.id as keyof RoadFormationSeriesVisibility] !== false,
    ) ?? [];

  const center =
    visiblePoints.find((p) => p.id === "centerline") ??
    visiblePoints.find((p) => p.id === "rhs") ??
    visiblePoints.find((p) => p.id === "lhs") ??
    visiblePoints[0];

  useEffect(() => {
    if (!center) return;
    const zoom = Math.max(map.getZoom(), 15);
    // Instant pan while dragging — animated pans stack and feel laggy
    map.setView([center.lat, center.lon], zoom, { animate: false });
  }, [center?.lat, center?.lon, map]);

  if (!sample || !center) return null;

  const linePositions = visiblePoints.map((p) => [p.lat, p.lon] as [number, number]);

  return (
    <>
      {linePositions.length >= 2 && (
        <Polyline
          positions={linePositions}
          pathOptions={{ color: "#ffffff", weight: 3, opacity: 0.85, dashArray: "6 4" }}
        />
      )}
      <Circle
        center={[center.lat, center.lon]}
        radius={80}
        pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.12, weight: 2 }}
      />
      {visiblePoints.map((p) => (
        <CircleMarker
          key={`rf-scrub-${p.id}`}
          center={[p.lat, p.lon]}
          radius={p.id === "centerline" ? 8 : 6}
          pathOptions={{
            color: "#ffffff",
            fillColor: ROAD_FORMATION_BRANCH_COLORS[p.id] ?? "#f59e0b",
            fillOpacity: 1,
            weight: 2,
          }}
        />
      ))}
      <CircleMarker
        center={[center.lat, center.lon]}
        radius={0.01}
        pathOptions={{ opacity: 0, fillOpacity: 0 }}
      >
        <Tooltip direction="top" offset={[0, -12]} opacity={0.95} permanent>
          <span>
            Ch {sample.chainage.toFixed(3)} km
            {visiblePoints.map((p) => (
              <span key={p.id}>
                {" · "}
                <span
                  style={{
                    background: ROAD_FORMATION_BRANCH_COLORS[p.id] ?? "#f59e0b",
                    color: "#0b0e14",
                    padding: "0 3px",
                    borderRadius: 2,
                  }}
                >
                  {p.name}{" "}
                  {p.formationLevelM != null ? `${p.formationLevelM.toFixed(2)} m` : "—"}
                </span>
              </span>
            ))}
          </span>
        </Tooltip>
      </CircleMarker>
    </>
  );
}

function CursorTracker({ onMove }: { onMove: (c: [number, number]) => void }) {
  useMapEvents({
    mousemove: (e) => onMove([e.latlng.lat, e.latlng.lng]),
  });
  return null;
}

/**
 * Map-level click proximity handler for borehole markers.
 * preferCanvas makes CircleMarker click events unreliable, so resolve the nearest point ourselves.
 */
function BoreholeClickBridge({
  boreholes,
  enabled,
  onSelect,
}: {
  boreholes: Borehole[];
  enabled: boolean;
  onSelect: (bh: Borehole) => void;
}) {
  const map = useMap();
  const boreholesRef = useRef(boreholes);
  boreholesRef.current = boreholes;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useMapEvents({
    click(e) {
      if (!enabledRef.current) return;
      const mouse = map.mouseEventToContainerPoint(e.originalEvent);
      const thresholdPx = 14;
      let best: Borehole | null = null;
      let bestDist = thresholdPx;
      for (const bh of boreholesRef.current) {
        if (bh.lat == null || bh.lon == null || !bh.layers.length) continue;
        const pt = map.latLngToContainerPoint(L.latLng(bh.lat, bh.lon));
        const d = Math.hypot(pt.x - mouse.x, pt.y - mouse.y);
        if (d < bestDist) {
          bestDist = d;
          best = bh;
        }
      }
      if (best) onSelectRef.current(best);
    },
  });

  return null;
}

/**
 * Map-container mousemove proximity hover.
 * preferCanvas puts a full-size canvas over SVG paths, so CircleMarker mouseover never fires.
 */
function GroundScourHoverBridge({
  points,
  enabled,
  onHover,
}: {
  points: GroundScourPoint[];
  enabled: boolean;
  onHover: (
    point: GroundScourPoint | null,
    cursor: { x: number; y: number } | null,
  ) => void;
}) {
  const map = useMap();
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const lastIdRef = useRef<string | null>(null);

  useMapEvents({
    mousemove(e) {
      if (!enabledRef.current) {
        if (lastIdRef.current != null) {
          lastIdRef.current = null;
          onHoverRef.current(null, null);
        }
        return;
      }
      const pts = pointsRef.current;
      if (!pts.length) return;

      const mouse = map.mouseEventToContainerPoint(e.originalEvent);
      const thresholdPx = 18;
      let best: GroundScourPoint | null = null;
      let bestDist = thresholdPx;

      for (const p of pts) {
        if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) continue;
        const pt = map.latLngToContainerPoint(L.latLng(p.latitude, p.longitude));
        const dx = pt.x - mouse.x;
        const dy = pt.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }

      const oe = e.originalEvent;
      if (best) {
        lastIdRef.current = best.id;
        onHoverRef.current(best, { x: oe.clientX, y: oe.clientY });
      } else if (lastIdRef.current != null) {
        lastIdRef.current = null;
        onHoverRef.current(null, null);
      }
    },
    mouseout() {
      if (lastIdRef.current == null) return;
      lastIdRef.current = null;
      onHoverRef.current(null, null);
    },
  });

  useEffect(() => {
    if (!enabled && lastIdRef.current != null) {
      lastIdRef.current = null;
      onHoverRef.current(null, null);
    }
  }, [enabled]);

  return null;
}

function ZoomTracker({ onScaleLabel }: { onScaleLabel: (label: string) => void }) {
  const map = useMap();
  useEffect(() => {
    const update = () => {
      const zoom = map.getZoom();
      const lat = map.getCenter().lat;
      onScaleLabel(formatMapScaleMeters(lat, zoom));
    };
    update();
    map.on("zoom zoomend move moveend", update);
    return () => {
      map.off("zoom zoomend move moveend", update);
    };
  }, [map, onScaleLabel]);
  return null;
}

/** Ground scale at current zoom (Web Mercator), rounded to a readable meter/km value. */
function formatMapScaleMeters(lat: number, zoom: number, targetPx = 80): string {
  const metersPerPx =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const raw = metersPerPx * targetPx;
  const steps = [
    1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000,
  ];
  let best = steps[0];
  for (const s of steps) {
    if (s <= raw) best = s;
    else break;
  }
  if (best >= 1000) {
    const km = best / 1000;
    return km % 1 === 0 ? `${km} km` : `${km.toFixed(1)} km`;
  }
  return `${best} m`;
}

function MapInstanceCapture({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function MeasureModeEffects({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    if (active) {
      el.classList.add("measure-mode");
      // Leaflet throws if nothing is open — ignore.
      try {
        map.closePopup();
      } catch {
        /* empty */
      }
      try {
        map.closeTooltip();
      } catch {
        /* empty */
      }
      el.style.cursor = "crosshair";
    } else {
      el.classList.remove("measure-mode");
      el.style.cursor = "";
    }
    return () => {
      el.classList.remove("measure-mode");
      el.style.cursor = "";
    };
  }, [map, active]);
  return null;
}

function MeasureHandler({
  maxPts,
  commitPts,
}: {
  maxPts: number | null;
  commitPts: (next: LatLon[] | ((prev: LatLon[]) => LatLon[])) => void;
}) {
  useMapEvents({
    click: (e) => {
      L.DomEvent.stopPropagation(e);
      const next: LatLon = [e.latlng.lat, e.latlng.lng];
      commitPts((prev) => {
        if (maxPts != null && prev.length >= maxPts) return [next];
        return [...prev, next];
      });
    },
  });
  return null;
}

function slopeColor(i: number): string {
  const palette = ["#22c55e", "#22c55e", "#eab308", "#f97316", "#ef4444"];
  const h = (Math.sin(i * 12.9898) * 43758.5453) % 1;
  const idx = Math.floor(Math.abs(h) * palette.length) % palette.length;
  return palette[idx];
}

/**
 * Offset a [lat,lon] path sideways by a small amount (degrees) so parallel
 * Schedule-B features (service road, drain, RE wall) don't overlap the alignment.
 * Uses the local perpendicular of each segment; latitude offset is scaled by
 * cos(lat) so the visual offset is roughly uniform.
 */
function offsetPath(path: [number, number][], offset: number): [number, number][] {
  if (offset === 0 || path.length < 2) return path;
  const out: [number, number][] = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(path.length - 1, i + 1)];
    const dLat = next[0] - prev[0];
    const dLon = next[1] - prev[1];
    const len = Math.hypot(dLat, dLon) || 1;
    // perpendicular unit vector
    const nx = -dLat / len;
    const ny = dLon / len;
    out.push([path[i][0] + ny * offset, path[i][1] + nx * offset]);
  }
  return out;
}

// Ensure default marker assets resolve (in case markers are added later).
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});
