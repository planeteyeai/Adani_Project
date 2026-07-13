import L from "leaflet";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Circle,
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  ChevronDown,
  CloudRain,
  Crosshair,
  Layers as LayersIcon,
  Box,
  Maximize2,
  MapPin,
  Mountain,
  Route,
  Ruler,
  X,
} from "lucide-react";
import ElevationGraphModal, { type ElevationPoint, type ElevationScrubSample } from "../components/ElevationGraphModal";
import BoreholeCard from "../components/BoreholeCard";
import WeatherForecastModal from "../components/WeatherForecastModal";
import WeatherHud from "../components/WeatherHud";
import BaseMapSwitcher from "../components/BaseMapSwitcher";
import StreetViewModal from "../components/StreetViewModal";
import StreetViewPegman from "../components/StreetViewPegman";
import Map3DView from "../components/Map3DView";
import { STREET_VIEW_COVERAGE } from "../lib/streetView";
import { ANALYSIS_OVERLAYS, ANALYSIS_OVERLAY_GROUPS, BASEMAPS, type AnalysisOverlay } from "../lib/basemaps";
import { fetchProject } from "../lib/api";
import { createChainageResolver, sampleChainageRange } from "../lib/chainage";
import { elevationMapSample, fetchElevationProfile } from "../lib/elevation";
import { fetchAffectedHouses, type AffectedHousesData } from "../lib/affectedHouses";
import { fetchWaterBodies, type WaterBodiesData } from "../lib/waterBodies";
import { fetchLulc, type LulcData } from "../lib/lulc";
import { fetchContours05m, fetchContours1m, type ContoursData } from "../lib/contours";
import { fetchRoadNetwork, highwayStyle, type RoadNetworkData } from "../lib/roadNetwork";
import {
  fetchRailwayLines,
  fetchRailwayPlatforms,
  fetchRailwayStations,
  RAILWAY_LINE_STYLE,
  RAILWAY_PLATFORM_STYLE,
  type RailwayLinesData,
  type RailwayPlatformsData,
  type RailwayStationsData,
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
import { fetchTrees, type TreesData } from "../lib/trees";
import { fetchFloodTimeseries, type FloodData } from "../lib/flood";
import TreesLayer from "../components/TreesLayer";
import ContoursLayer from "../components/ContoursLayer";
import FloodLayer from "../components/FloodLayer";
import FloodTimeSeriesPanel from "../components/FloodTimeSeriesPanel";
import { boreholeSummary, fetchGeotech, type Borehole, type GeotechData } from "../lib/geotech";
import {
  createRoadCategoryIcon,
  createStructureIcon,
  createTollPlazaIcon,
  isRoadCategoryName,
  roadCategoryStyle,
  structureIconFile,
  structureIconUrl,
} from "../lib/mapIcons";
import {
  scheduleBFromStats,
  structureColor,
  structureTypeLabel,
  type ScheduleBStructure,
} from "../lib/scheduleB";
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
};

type AlignmentDetails = {
  /** summary = layer toggled on; point = clicked a segment on the map */
  mode: "summary" | "point";
  name: string;
  folder?: string;
  lengthKm: number;
  stroke: string;
  isCentreline: boolean;
  segmentCount: number;
  totalLengthKm: number;
  lat?: number;
  lon?: number;
  chainageKm: number | null;
  elevation: number | null;
  tcs: { fromKm: number; toKm: number; tcs: string | null; description: string | null } | null;
  nearestStructure: { label: string; type: string; chainageKm: number } | null;
};

const DEFAULT_OVERLAYS: Record<string, boolean> = {
  alignment: true,
  markers: false,
  structures: true,
  toll_plazas: false,
  road_categories: false,
  road_network: false,
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
  trees: false,
  contours_1m: false,
  contours_0_5m: false,
  affected_houses: false,
  flood: false,
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

export default function MapExplorer() {
  const [project, setProject] = useState<Project | null>(null);
  const [baseId, setBaseId] = useState("google-satellite");
  const [opacity, setOpacity] = useState(0.7);
  const [showElevation, setShowElevation] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [elevationPoints, setElevationPoints] = useState<ElevationPoint[]>([]);
  const [geotech, setGeotech] = useState<GeotechData | null>(null);
  const [affectedHouses, setAffectedHouses] = useState<AffectedHousesData | null>(null);
  const [waterBodies, setWaterBodies] = useState<WaterBodiesData | null>(null);
  const [lulcData, setLulcData] = useState<LulcData | null>(null);
  const [contours1m, setContours1m] = useState<ContoursData | null>(null);
  const [contours05m, setContours05m] = useState<ContoursData | null>(null);
  const [roadNetwork, setRoadNetwork] = useState<RoadNetworkData | null>(null);
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [baseMapOpen, setBaseMapOpen] = useState(false);
  const [alignmentDetails, setAlignmentDetails] = useState<AlignmentDetails | null>(null);
  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d");
  const overlaysBefore3dRef = useRef<{
    overlays: Record<string, boolean>;
    showElevation: boolean;
  } | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [mapScaleLabel, setMapScaleLabel] = useState("—");
  const [measure, setMeasure] = useState(false);
  const [measurePts, setMeasurePts] = useState<[number, number][]>([]);
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
    fetchProject("demo").then(setProject);
    fetchElevationProfile().then(setElevationPoints);
    fetchGeotech().then(setGeotech);
    fetchAffectedHouses().then(setAffectedHouses);
    fetchWaterBodies().then(setWaterBodies);
    fetchLulc().then(setLulcData);
    fetchContours1m().then(setContours1m);
    fetchContours05m().then(setContours05m);
    fetchRoadNetwork().then(setRoadNetwork);
    fetchRailwayLines().then(setRailwayLines);
    fetchRailwayStations().then(setRailwayStations);
    fetchRailwayPlatforms().then(setRailwayPlatforms);
    fetchTransmissionLines().then(setTransmissionLines);
    fetchSubstations().then(setSubstations);
    fetchTransmissionTowers().then(setTransmissionTowers);
    fetchTrees().then(setTreesData);
    fetchFloodTimeseries().then((data) => {
      setFloodData(data);
      if (data?.dates?.length) setFloodDate(data.dates[0]);
    });
  }, []);

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

  const { lineFeatures, points } = useMemo(() => {
    const lineFeatures: Array<{
      coords: number[][];
      stroke: string;
      weight: number;
      lengthKm: number;
      name?: string;
      folder?: string;
    }> = [];
    const points: MapPoint[] = [];
    if (project?.geojson) {
      for (const f of project.geojson.features) {
        if (f.geometry.type === "LineString") {
          const props = f.properties ?? {};
          lineFeatures.push({
            coords: f.geometry.coordinates as number[][],
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
    return { lineFeatures, points };
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

  const tollPlazaPoints = useMemo(
    () => points.filter((p) => /toll\s*plaza/i.test(p.name)),
    [points]
  );

  const roadCategoryPoints = useMemo(
    () => points.filter((p) => isRoadCategoryName(p.name)),
    [points]
  );

  const tollPlazaIcon = useMemo(() => createTollPlazaIcon(), []);

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
      elevated: build(scheduleB?.elevated, {
        offset: 0,
        label: (r) => `Elevated ${r.from_km}–${r.to_km} km`,
      }),
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
      ramps: build(scheduleB?.interchange_ramps, {
        offset: 0,
        label: (r) => String(r.description ?? r.interchange ?? "Ramp"),
      }),
      paved_shoulders: build(scheduleB?.paved_shoulders, {
        offset: -0.00024,
        label: (r) => `Paved Shoulder ${r.from_km}–${r.to_km} km`,
      }),
    };
  }, [scheduleB, resolveChainage]);

  const center: [number, number] = project
    ? [project.stats.center[1], project.stats.center[0]]
    : [25.61, 84.95];

  const weatherHudCoords = useMemo(
    () => ({ lat: center[0], lon: center[1] }),
    [center],
  );

  const weatherModalCoords = useMemo(() => {
    if (cursor) return { lat: cursor[0], lon: cursor[1] };
    return { lat: center[0], lon: center[1] };
  }, [cursor, center]);

  const measureLength = useMemo(() => haversinePath(measurePts), [measurePts]);

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

  /** Fast lookup: branch + chainage → map point */
  const elevationPointIndex = useMemo(() => {
    const map = new Map<string, ElevationPoint & { latitude: number; longitude: number }>();
    for (const p of elevationMapPoints) {
      map.set(`${p.branch ?? "centerline"}:${p.chainage}`, p);
    }
    return map;
  }, [elevationMapPoints]);

  const [elevationScrubbing, setElevationScrubbing] = useState(false);

  const handleStreetViewDrop = useCallback((lat: number, lon: number) => {
    setMeasure(false);
    setMeasurePts([]);
    setStreetViewPoint({ lat, lon });
  }, []);

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

      const lhs = resolve(sample.lhs);
      const center = resolve(sample.centerline);
      const rhs = resolve(sample.rhs);
      const section = [lhs, center, rhs].filter(
        (x): x is NonNullable<typeof x> => x != null,
      );
      setElevationCrossSection(section.length ? section : null);

      if (center) {
        setElevationFocus({
          lat: center.lat,
          lon: center.lon,
          chainage: center.chainage,
          elevation: center.elevation,
        });
      }
    },
    [elevationPointIndex],
  );

  const openAlignmentSummary = useCallback(() => {
    const totalLengthKm = lineFeatures.reduce((sum, l) => sum + (l.lengthKm || 0), 0);
    const primary =
      lineFeatures.find((l) => l.folder && l.folder === primaryAlignmentFolder) ??
      lineFeatures[0];
    setAlignmentDetails({
      mode: "summary",
      name: primary
        ? primary.folder?.split(" / ").pop() ?? primary.name ?? "Project Alignment"
        : "Project Alignment",
      folder: primary?.folder,
      lengthKm: primary?.lengthKm ?? 0,
      stroke: primary?.stroke ?? "#c026d3",
      isCentreline: true,
      segmentCount: lineFeatures.length,
      totalLengthKm,
      chainageKm: null,
      elevation: null,
      tcs: null,
      nearestStructure: null,
    });
  }, [lineFeatures, primaryAlignmentFolder]);

  const handleAlignmentClick = useCallback(
    (
      line: { name?: string; folder?: string; lengthKm: number; stroke: string },
      lat: number,
      lon: number,
    ) => {
      // Nearest centreline elevation point → chainage (km) + ground elevation.
      let nearest: (ElevationPoint & { latitude: number; longitude: number }) | null = null;
      let bestD = Infinity;
      for (const p of elevationMapPoints) {
        if ((p.branch ?? "centerline") !== "centerline") continue;
        const d = (p.latitude - lat) ** 2 + (p.longitude - lon) ** 2;
        if (d < bestD) {
          bestD = d;
          nearest = p;
        }
      }
      const chainageKm = nearest ? Number(nearest.chainage) : null;
      const elevation = nearest ? Number(nearest.elevation) : null;

      let tcs: AlignmentDetails["tcs"] = null;
      let nearestStructure: AlignmentDetails["nearestStructure"] = null;
      if (chainageKm != null) {
        const stretch = scheduleB?.tcs_stretches?.find(
          (s) => chainageKm >= s.from_km && chainageKm <= s.to_km,
        );
        if (stretch) {
          tcs = {
            fromKm: stretch.from_km,
            toKm: stretch.to_km,
            tcs: stretch.tcs,
            description: stretch.description,
          };
        }
        let sBest = Infinity;
        for (const s of structureMarkers) {
          const d = Math.abs(s.chainage_km - chainageKm);
          if (d < sBest) {
            sBest = d;
            nearestStructure = {
              label: s.label,
              type: s.type,
              chainageKm: s.chainage_km,
            };
          }
        }
      }

      const totalLengthKm = lineFeatures.reduce((sum, l) => sum + (l.lengthKm || 0), 0);
      setAlignmentDetails({
        mode: "point",
        name: line.folder?.split(" / ").pop() ?? line.name ?? "Alignment",
        folder: line.folder,
        lengthKm: line.lengthKm,
        stroke: line.stroke,
        isCentreline: !!line.folder && line.folder === primaryAlignmentFolder,
        segmentCount: lineFeatures.length,
        totalLengthKm,
        lat,
        lon,
        chainageKm,
        elevation,
        tcs,
        nearestStructure,
      });
    },
    [elevationMapPoints, scheduleB, structureMarkers, primaryAlignmentFolder, lineFeatures],
  );

  return (
    <div className="relative flex h-screen w-full flex-col pt-16">
      <div className="relative flex min-h-0 flex-1 flex-col w-full">
        <div className="relative min-h-0 flex-1">
        {mapMode === "3d" ? (
          <Map3DView
            project={project}
            overlays={overlays}
            showElevation={showElevation}
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
          />
        ) : (
        <MapContainer
          center={center}
          zoom={12}
          className="h-full w-full"
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
          <MapResizeOnPanel active={showElevation && elevationPoints.length > 0} />
          {showElevation && elevationMapPoints.length > 0 && (
            <ElevationProfileMarkers
              points={elevationMapPoints}
              focus={elevationFocus}
              onPointClick={handleElevationPointClick}
            />
          )}
          <FlyToElevationPoint
            focus={elevationFocus}
            crossSection={elevationCrossSection}
            scrubbing={elevationScrubbing}
          />
          <CursorTracker onMove={setCursor} />
          <ZoomTracker onScaleLabel={setMapScaleLabel} />
          <MapInstanceCapture onReady={setMapInstance} />
          {measure && <MeasureHandler pts={measurePts} setPts={setMeasurePts} />}

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

          {/* Alignment — wide invisible hit line under a visible stroke for easy clicks */}
          {overlays.alignment &&
            lineFeatures.map((line, i) => {
              const positions = line.coords.map((c) => [c[1], c[0]]) as [number, number][];
              const color = overlays.slope ? slopeColor(i) : line.stroke;
              const weight = overlays.slope ? 3 : Math.min(6, Math.max(2, line.weight));
              const onClick = (e: L.LeafletMouseEvent) => {
                L.DomEvent.stopPropagation(e);
                handleAlignmentClick(line, e.latlng.lat, e.latlng.lng);
              };
              return (
                <Fragment key={"al" + i}>
                  <Polyline
                    positions={positions}
                    pathOptions={{
                      color: "#000",
                      weight: 18,
                      opacity: 0,
                      interactive: true,
                    }}
                    eventHandlers={{ click: onClick }}
                  />
                  <Polyline
                    positions={positions}
                    pathOptions={{
                      color,
                      weight,
                      opacity: 0.95,
                      interactive: true,
                      className: "cursor-pointer",
                    }}
                    eventHandlers={{ click: onClick }}
                  >
                    {(line.folder || line.name) && (
                      <Tooltip sticky opacity={0.9} className="geovision-tooltip">
                        <span className="font-semibold">
                          {line.folder?.split(" / ").pop() ?? line.name}
                        </span>
                      </Tooltip>
                    )}
                  </Polyline>
                </Fragment>
              );
            })}

          {/* Schedule-B linear corridor features */}
          {overlays.sb_elevated && (
            <SbLineLayer features={sbLines.elevated} color="#12c9b0" weight={7} opacity={0.55} unit="Elevated viaduct" />
          )}
          {overlays.sb_ramps && (
            <SbLineLayer features={sbLines.ramps} color="#eab308" weight={4} opacity={0.85} unit="Interchange ramp" />
          )}
          {overlays.sb_service_roads && (
            <SbLineLayer features={sbLines.service_roads} color="#3b82f6" weight={3} opacity={0.85} dash="6 5" unit="Service road" />
          )}
          {overlays.sb_re_walls && (
            <SbLineLayer features={sbLines.re_walls} color="#f97316" weight={4} opacity={0.9} unit="RE wall" />
          )}
          {overlays.sb_drains && (
            <SbLineLayer features={sbLines.drains} color="#06b6d4" weight={2.5} opacity={0.85} dash="2 5" unit="Drain" />
          )}
          {overlays.sb_paved_shoulders && (
            <SbLineLayer features={sbLines.paved_shoulders} color="#94a3b8" weight={3} opacity={0.7} dash="4 4" unit="Paved shoulder" />
          )}

          {/* Markers — click for full detail popup */}
          {overlays.markers &&
            chainagePoints.map((p, i) => (
              <Circle
                key={"pt" + i}
                center={p.coord}
                radius={18}
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#6aa8ff",
                  fillOpacity: 0.7,
                  weight: 1,
                  className: "geovision-marker",
                }}
                eventHandlers={{
                  mouseover: (e) => {
                    e.target.setStyle({ fillOpacity: 0.95, weight: 2 });
                    e.target.getElement()?.classList.add("geovision-marker--hover");
                  },
                  mouseout: (e) => {
                    e.target.setStyle({ fillOpacity: 0.7, weight: 1 });
                    e.target.getElement()?.classList.remove("geovision-marker--hover");
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.95} className="geovision-tooltip">
                  <span className="font-semibold">{p.name}</span>
                  <span className="ml-1.5 text-slate-400">· click for details</span>
                </Tooltip>
                <Popup className="geovision-popup" minWidth={260} maxWidth={340}>
                  <PointPopupContent point={p} project={project} index={i} />
                </Popup>
              </Circle>
            ))}

          {/* Toll plaza locations from KMZ */}
          {overlays.toll_plazas &&
            tollPlazaPoints.map((p, i) => (
              <Marker key={"toll" + i} position={p.coord} icon={tollPlazaIcon}>
                <Tooltip direction="top" offset={[0, -16]} opacity={0.95} className="geovision-tooltip">
                  <span className="font-semibold">Toll Plaza</span>
                  <br />
                  <span className="text-slate-400">
                    {p.lat.toFixed(6)}, {p.lon.toFixed(6)}
                  </span>
                </Tooltip>
                <Popup className="geovision-popup" minWidth={260} maxWidth={340}>
                  <TollPlazaPopupContent point={p} project={project} index={i} />
                </Popup>
              </Marker>
            ))}

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

          {/* OSM road network within 1 km buffer */}
          {overlays.road_network && roadNetwork && (
            <GeoJSON
              key="road-network"
              data={roadNetwork}
              style={(feature) => {
                const hw =
                  (feature?.properties as { highway?: string } | undefined)?.highway ?? "unknown";
                const s = highwayStyle(hw);
                return {
                  color: s.color,
                  weight: s.weight,
                  opacity: 0.9,
                };
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
              key="railway-lines"
              data={railwayLines}
              style={() => ({ ...RAILWAY_LINE_STYLE })}
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
              key="railway-platforms"
              data={railwayPlatforms}
              style={() => ({ ...RAILWAY_PLATFORM_STYLE })}
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
              key="transmission-lines"
              data={transmissionLines}
              style={() => ({ ...TRANSMISSION_LINE_STYLE })}
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
              key="substations"
              data={substations}
              style={() => ({ ...SUBSTATION_STYLE })}
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
                  <Marker key={"sb" + i} position={s.coord} icon={icon}>
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
                  }}
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

          {/* Water bodies */}
          {overlays.water_bodies && waterBodies && (
            <GeoJSON
              key="water-bodies"
              data={waterBodies}
              style={() => ({
                color: "#0284c7",
                weight: 1.5,
                fillColor: "#0ea5e9",
                fillOpacity: 0.45,
              })}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  name?: string;
                  index?: number;
                };
                const label = props.name ?? `Water body ${props.index ?? ""}`;
                layer.bindTooltip(
                  `<span class="font-semibold">${label}</span><br/><span class="text-slate-400">${props.id ?? ""}</span>`,
                  { direction: "top", opacity: 0.95, className: "geovision-tooltip" },
                );
              }}
            />
          )}

          {/* LULC (land use / land cover) */}
          {overlays.lulc && lulcData && (
            <GeoJSON
              key="lulc"
              data={lulcData}
              style={(feature) => {
                const color =
                  (feature?.properties as { color?: string } | undefined)?.color ?? "#94a3b8";
                return {
                  color,
                  weight: 1,
                  fillColor: color,
                  fillOpacity: 0.4,
                };
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

          {/* Trees (emoji markers) */}
          {overlays.trees && treesData && treesData.trees.length > 0 && (
            <TreesLayer trees={treesData.trees} />
          )}

          {/* Ground contours */}
          {overlays.contours_1m && contours1m && <ContoursLayer data={contours1m} weight={1.4} />}
          {overlays.contours_0_5m && contours05m && (
            <ContoursLayer data={contours05m} weight={1.1} opacity={0.75} />
          )}

          {/* Flood water / inundation points for selected date */}
          {overlays.flood && floodScene && <FloodLayer scene={floodScene} />}

          {/* Affected houses (within planned road corridor) */}
          {overlays.affected_houses && affectedHouses && (
            <GeoJSON
              key="affected-houses"
              data={affectedHouses}
              style={() => ({
                color: "#ef4444",
                weight: 1,
                fillColor: "#ef4444",
                fillOpacity: 0.35,
              })}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as {
                  id?: string;
                  name?: string;
                  index?: number;
                };
                const label = props.name ?? `House ${props.index ?? ""}`;
                layer.bindTooltip(
                  `<span class="font-semibold">${label}</span><br/><span class="text-slate-400">${props.id ?? ""}</span>`,
                  { direction: "top", opacity: 0.95, className: "geovision-tooltip" },
                );
              }}
            />
          )}

          {/* Geotechnical boreholes */}
          {overlays.boreholes &&
            boreholes.map((bh, i) => {
              const s = boreholeSummary(bh);
              return (
                <CircleMarker
                  key={"bh" + i}
                  center={[bh.lat as number, bh.lon as number]}
                  radius={7}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: s.hasData ? "#a855f7" : "#7c6f9c",
                    fillOpacity: 0.9,
                    weight: 2,
                    className: s.hasData ? "geovision-marker" : undefined,
                  }}
                  eventHandlers={s.hasData ? { click: () => setSelectedBorehole(bh) } : undefined}
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

          {/* Measurement */}
          {measurePts.length > 0 && (
            <Polyline
              positions={measurePts}
              pathOptions={{ color: "#f43f5e", weight: 2, dashArray: "6 6" }}
            />
          )}
          {measurePts.map((p, i) => (
            <Circle key={"m" + i} center={p} radius={6} pathOptions={{ color: "#f43f5e", fillOpacity: 1 }} />
          ))}
        </MapContainer>
        )}

        {/* top-left controls (layers / elevation) — above Map & Layers panel */}
        <div className="pointer-events-none absolute inset-0 z-[500]">
          <div className="pointer-events-auto fixed right-4 top-20 z-[600] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
            {mapMode === "2d" && (
              <>
            <WeatherHud
              latitude={weatherHudCoords.lat}
              longitude={weatherHudCoords.lon}
              onOpenDetails={() => setShowWeather(true)}
            />
            <BaseMapSwitcher
              baseId={baseId}
              opacity={opacity}
              open={baseMapOpen}
              onToggle={() => setBaseMapOpen((v) => !v)}
              onBaseChange={setBaseId}
              onOpacityChange={setOpacity}
            />
              </>
            )}
          </div>

          <div className="pointer-events-auto fixed left-4 top-20 z-[700] flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (mapMode === "2d") {
                    overlaysBefore3dRef.current = {
                      overlays: { ...overlays },
                      showElevation,
                    };
                    setOverlays(overlaysFor3d(overlays));
                    setShowElevation(true);
                    setShowFloodPanel(false);
                    setAlignmentDetails(null);
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
                className={`glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                  mapMode === "3d" ? "ring-1 ring-brand-400/50" : ""
                }`}
                title={
                  mapMode === "2d"
                    ? "Switch to 3D (alignment + elevation only)"
                    : "Switch to 2D map"
                }
              >
                <Box className="h-4 w-4 text-brand-400" />
                {mapMode === "2d" ? "3D Map" : "2D Map"}
              </button>
              <button
                onClick={() => setPanelOpen((v) => !v)}
                className={`glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                  panelOpen ? "ring-1 ring-brand-400/50" : ""
                }`}
              >
                <LayersIcon className="h-4 w-4 text-brand-400" /> Layers
              </button>
              <button
                onClick={() => {
                  setShowElevation((v) => {
                    if (v) {
                    setElevationFocus(null);
                    setElevationCrossSection(null);
                  }
                    return !v;
                  });
                }}
                disabled={!elevationPoints.length}
                className={`glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-40 ${
                  showElevation ? "ring-1 ring-brand-400/50" : ""
                }`}
              >
                <Mountain className="h-4 w-4 text-brand-400" /> Elevation Profile
              </button>
              <button
                onClick={() => setShowWeather(true)}
                className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
              >
                <CloudRain className="h-4 w-4 text-brand-400" /> Weather
              </button>
            </div>

          {/* tools + readouts bottom-right */}
          <div className="pointer-events-auto absolute bottom-6 right-4 flex flex-col items-end gap-2">
            {mapMode === "2d" && (
            <div className="pointer-events-none flex flex-col items-end gap-2">
              <div className="glass rounded-lg px-3 py-1.5 text-xs text-slate-200">
                {mapScaleLabel}
              </div>
              {cursor && (
                <div className="glass flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-200">
                  <Crosshair className="h-3.5 w-3.5 text-brand-400" />
                  {cursor[0].toFixed(5)}, {cursor[1].toFixed(5)}
                </div>
              )}
              {measure && (
                <div className="glass rounded-lg px-3 py-1.5 text-xs text-rose-300">
                  {measurePts.length < 2 ? "Click to add points" : `Distance: ${measureLength.toFixed(2)} km`}
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
            <div className="flex flex-col gap-2">
              {mapMode === "2d" && (
                <>
              <StreetViewPegman
                map={mapInstance}
                onDrop={handleStreetViewDrop}
                onDraggingChange={setStreetViewDragging}
              />
              <ToolBtn
                active={measure}
                onClick={() => {
                  setMeasure((v) => !v);
                  setMeasurePts([]);
                }}
                title="Measure distance"
              >
                <Ruler className="h-4 w-4" />
              </ToolBtn>
                </>
              )}
              <ToolBtn onClick={() => document.documentElement.requestFullscreen?.()} title="Fullscreen">
                <Maximize2 className="h-4 w-4" />
              </ToolBtn>
            </div>
          </div>
        </div>

        {/* Alignment details — side shutter, slides in from the right */}
        <div
          className={`fixed right-0 top-44 z-[800] flex max-h-[calc(100vh-12rem)] w-56 flex-col overflow-hidden rounded-l-2xl border border-white/15 border-r-0 bg-ink-950/95 p-3 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-in-out ${
            alignmentDetails ? "-translate-x-4 pointer-events-auto" : "translate-x-full pointer-events-none"
          }`}
          aria-hidden={!alignmentDetails}
        >
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Route className="h-4 w-4 text-brand-400" /> Alignment details
            </h3>
            <button
              type="button"
              onClick={() => setAlignmentDetails(null)}
              className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {alignmentDetails && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
              <div className="grid grid-cols-2 gap-2">
                {alignmentLegend.map((item) => {
                  const selected =
                    alignmentDetails.mode === "point" &&
                    item.color.toLowerCase() === alignmentDetails.stroke.toLowerCase();
                  const isCentreline =
                    !!item.folder && item.folder === primaryAlignmentFolder;
                  return (
                    <div
                      key={item.color}
                      className={`aspect-square rounded-xl border p-2.5 flex flex-col ${
                        selected
                          ? "border-brand-400/60 bg-brand-500/15 ring-1 ring-brand-400/40"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div
                        className="mb-2 h-3 w-full shrink-0 rounded-sm"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="min-h-0 flex-1 overflow-hidden">
                        <div className="line-clamp-2 text-[11px] font-semibold leading-snug text-white">
                          {item.label}
                        </div>
                        {isCentreline && (
                          <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-brand-300">
                            Design centreline
                          </div>
                        )}
                      </div>
                      <div className="mt-auto space-y-0.5 pt-1 text-[10px] text-slate-400">
                        <div className="flex justify-between gap-1">
                          <span>Length</span>
                          <span className="tabular-nums text-slate-200">
                            {item.lengthKm > 0 ? `${item.lengthKm.toFixed(1)} km` : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-1">
                          <span>Segments</span>
                          <span className="tabular-nums text-slate-200">{item.segmentCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {alignmentDetails.mode === "point" && (
                <DetailCard title="At clicked point">
                  <PopupRow
                    label="Chainage"
                    value={
                      alignmentDetails.chainageKm != null
                        ? formatChainage(alignmentDetails.chainageKm)
                        : "—"
                    }
                  />
                  <PopupRow
                    label="Ground elevation"
                    value={
                      alignmentDetails.elevation != null
                        ? `${alignmentDetails.elevation.toFixed(1)} m`
                        : "—"
                    }
                  />
                  {alignmentDetails.lat != null && alignmentDetails.lon != null && (
                    <PopupRow
                      label="Coordinates"
                      value={`${alignmentDetails.lat.toFixed(5)}, ${alignmentDetails.lon.toFixed(5)}`}
                    />
                  )}
                </DetailCard>
              )}

              {alignmentDetails.mode === "summary" && (
                <p className="text-[11px] leading-snug text-slate-500">
                  Click any alignment line on the map for chainage, elevation, and Schedule-B context.
                </p>
              )}

              {(alignmentDetails.tcs || alignmentDetails.nearestStructure) && (
                <DetailCard title="Schedule-B context">
                  {alignmentDetails.tcs && (
                    <>
                      <PopupRow
                        label="Cross section"
                        value={alignmentDetails.tcs.tcs ?? alignmentDetails.tcs.description ?? "—"}
                      />
                      <PopupRow
                        label="Stretch"
                        value={`${formatChainage(alignmentDetails.tcs.fromKm)} – ${formatChainage(
                          alignmentDetails.tcs.toKm,
                        )}`}
                      />
                    </>
                  )}
                  {alignmentDetails.nearestStructure && (
                    <PopupRow
                      label="Nearest structure"
                      value={`${structureTypeLabel(alignmentDetails.nearestStructure.type)} @ ${formatChainage(
                        alignmentDetails.nearestStructure.chainageKm,
                      )}`}
                    />
                  )}
                </DetailCard>
              )}
            </div>
          )}
        </div>

        {/* Layer panel — slides in from the left */}
        <div
          className={`fixed left-0 top-44 z-[600] max-h-[calc(100vh-11rem)] w-80 overflow-y-auto rounded-r-2xl border border-white/10 border-l-0 bg-ink-900/90 p-4 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-in-out ${
            panelOpen ? "translate-x-4 pointer-events-auto" : "-translate-x-full pointer-events-none"
          }`}
          aria-hidden={!panelOpen}
        >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Map & Layers</h3>
              <button onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {project && (
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Route className="h-4 w-4 text-brand-400" /> {project.name}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin className="h-3 w-3" /> {project.location}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Lines" value={project.stats.line_count.toLocaleString()} />
                  <MiniStat label="Points" value={project.stats.point_count.toLocaleString()} />
                  <MiniStat label="Km drawn" value={Math.round(project.stats.total_length_km).toLocaleString()} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              {mapMode === "3d" && (
                <p className="rounded-lg border border-brand-500/20 bg-brand-500/10 px-2.5 py-2 text-[10px] leading-snug text-brand-200">
                  3D view: Project Alignment and Elevation only. Other layers stay off until you return to 2D.
                </p>
              )}
              {ANALYSIS_OVERLAY_GROUPS.map((group) => {
                const items = ANALYSIS_OVERLAYS.filter((o) => o.group === group);
                if (!items.length) return null;
                const activeCount = items.filter((o) => overlays[o.id]).length;
                return (
                  <LayerDropdown
                    key={group}
                    title={group}
                    open={!!expandedSections[group]}
                    onToggle={() =>
                      setExpandedSections((s) => ({ ...s, [group]: !s[group] }))
                    }
                    badge={activeCount > 0 ? `${activeCount}/${items.length} on` : undefined}
                  >
                    <OverlayCheckboxList
                      items={items}
                      overlays={overlays}
                      lockedIds={mapMode === "3d" ? MAP_3D_OVERLAY_IDS : null}
                      onChange={(id, checked) => {
                        if (mapMode === "3d" && !MAP_3D_OVERLAY_IDS.has(id)) return;
                        if (mapMode === "3d" && id === "alignment" && !checked) return;
                        setOverlays((s) => ({ ...s, [id]: checked }));
                        if (id === "alignment") {
                          if (checked) openAlignmentSummary();
                          else setAlignmentDetails(null);
                        }
                      }}
                    />
                    {group === "Alignment & Markers" && overlays.alignment && (
                      <button
                        type="button"
                        onClick={openAlignmentSummary}
                        className="mt-2 w-full rounded-lg border border-brand-500/30 bg-brand-500/10 px-2.5 py-1.5 text-left text-[11px] font-medium text-brand-200 hover:bg-brand-500/20"
                      >
                        Open alignment details panel →
                      </button>
                    )}
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
                    {group === "Environment" && overlays.lulc && lulcData && lulcData.classes?.length > 0 && (
                      <div className="mt-3 space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-slate-400">
                        <div className="font-semibold text-white">LULC classes</div>
                        {lulcData.classes.map((c) => (
                          <div key={c.name} className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: c.color }}
                            />
                            <span className="flex-1 text-slate-300">{c.name}</span>
                            <span className="tabular-nums text-slate-500">{c.count}</span>
                          </div>
                        ))}
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
                              background:
                                "linear-gradient(90deg,#0ea5e9,#14b8a6,#f59e0b)",
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
                            <div>
                              1 m · {contours1m.count.toLocaleString()} lines
                            </div>
                          )}
                          {overlays.contours_0_5m && contours05m && (
                            <div>
                              0.5 m · {contours05m.count.toLocaleString()} lines
                            </div>
                          )}
                        </div>
                      )}
                    {group === "Social Impact" && affectedHouses && affectedHouses.count > 0 && (
                      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-slate-400">
                        <div className="font-semibold text-white">Structures within Acquisition Boundary</div>
                        <div className="mt-1">
                          {affectedHouses.count.toLocaleString()} structures inside the acquisition boundary
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
              <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
                <div className="font-semibold text-white">Terrain data</div>
                <div className="mt-1">
                  Ground elevation · {elevationGraphPoints.length.toLocaleString()} pts (centre + LHS/RHS @ 50 m) ·{" "}
                  {Math.min(...elevationGraphPoints.map((p) => p.elevation)).toFixed(0)}–
                  {Math.max(...elevationGraphPoints.map((p) => p.elevation)).toFixed(0)} m
                </div>
              </div>
            )}
          </div>

        </div>

        {showElevation && elevationGraphPoints.length > 0 && (
          <ElevationGraphModal
            points={elevationGraphPoints}
            exportPoints={elevationPoints}
            projectName={project?.name}
            onClose={() => {
              setShowElevation(false);
              setElevationFocus(null);
              setElevationCrossSection(null);
            }}
            onPointClick={handleElevationPointClick}
            onScrub={handleElevationScrub}
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
      </div>
    </div>
  );
}

function LayerDropdown({
  title,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-white/5"
      >
        <span className="text-xs font-semibold text-white">{title}</span>
        <span className="flex items-center gap-2">
          {badge && (
            <span className="max-w-[8rem] truncate rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-medium text-brand-300">
              {badge}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && <div className="border-t border-white/10 px-3 py-3">{children}</div>}
    </div>
  );
}

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
                {item.color && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: item.color }}
                  />
                )}
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`grid h-10 w-10 place-items-center rounded-xl border backdrop-blur-xl transition ${
        active ? "border-rose-400 bg-rose-500/20 text-rose-300" : "border-white/10 bg-ink-900/80 text-white hover:bg-white/10"
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
}: {
  point: MapPoint;
  project: Project | null;
  index: number;
}) {
  return (
    <div className="geovision-popup__body">
      <div className="geovision-popup__title">Toll Plaza</div>
      <div className="geovision-popup__subtitle">Location #{index + 1}</div>
      <div className="geovision-popup__badge" style={{ borderColor: "#f59e0b", color: "#f59e0b" }}>
        Toll Plaza
      </div>

      <dl className="geovision-popup__rows">
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

function PopupRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-xs">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="m-0 text-right font-medium text-slate-200 break-words">{value}</dd>
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

function SbLineLayer({
  features,
  color,
  weight,
  opacity,
  dash,
  unit,
}: {
  features: SbLineFeature[];
  color: string;
  weight: number;
  opacity: number;
  dash?: string;
  unit: string;
}) {
  return (
    <>
      {features.map((f, i) => (
        <Polyline
          key={`${unit}-${i}`}
          positions={f.positions}
          pathOptions={{ color, weight, opacity, dashArray: dash, lineCap: "round", lineJoin: "round" }}
        >
          <Tooltip direction="top" opacity={0.95} className="geovision-tooltip" sticky>
            <span className="font-semibold">{f.label}</span>
            <br />
            <span className="text-slate-400">
              {unit} · Ch {f.from}–{f.to} km
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
}: {
  points: Array<ElevationPoint & { latitude: number; longitude: number }>;
  focus: { lat: number; lon: number; chainage: number; elevation: number } | null;
  onPointClick: (point: ElevationPoint) => void;
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
            }}
            eventHandlers={{ click: () => onPointClick(p) }}
          >
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

function CursorTracker({ onMove }: { onMove: (c: [number, number]) => void }) {
  useMapEvents({
    mousemove: (e) => onMove([e.latlng.lat, e.latlng.lng]),
  });
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

function MeasureHandler({
  pts,
  setPts,
}: {
  pts: [number, number][];
  setPts: (p: [number, number][]) => void;
}) {
  useMapEvents({
    click: (e) => setPts([...pts, [e.latlng.lat, e.latlng.lng]]),
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

function haversinePath(pts: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const [lat1, lon1] = pts[i - 1];
    const [lat2, lon2] = pts[i];
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(a));
  }
  return total;
}

// Ensure default marker assets resolve (in case markers are added later).
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});
