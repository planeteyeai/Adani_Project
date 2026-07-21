import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Droplets,
  Layers,
  Mountain,
  Route,
  Ruler,
  Sprout,
  Trees as TreesIcon,
  TriangleRight,
  Waves,
} from "lucide-react";
import { Link } from "react-router-dom";
import { fetchMetrics, fetchProject } from "../lib/api";
import { elevationToMetricsProfile, fetchElevationProfile } from "../lib/elevation";
import { fetchGeotech, type GeotechData } from "../lib/geotech";
import { fetchLulc, type LulcData } from "../lib/lulc";
import {
  fetchGroundScour,
  groundScourZoneColor,
  summarizeGroundScour,
  type GroundScourData,
} from "../lib/groundScour";
import {
  fetchRoadFormation,
  summarizeRoadFormation,
  ROAD_FORMATION_BRANCH_COLORS,
  type RoadFormationData,
} from "../lib/roadFormation";
import { fetchBarrenLand, type BarrenLandData } from "../lib/barrenLand";
import { fetchTrees, treesSummaryInfo, type TreesData } from "../lib/trees";
import { fetchWaterBodies, fetchWaterways, type WaterBodiesData } from "../lib/waterBodies";
import { fetchVillages, type VillagesData } from "../lib/villages";
import { fetchFloodTimeseries, formatFloodDate, floodGaugeReference, floodRecordMaxWaterLevel, type FloodData, type FloodMaxWaterLevel } from "../lib/flood";
import {
  fetchCutFill,
  summarizeCutFill,
  type CutFillData,
  type CutFillSummary,
} from "../lib/cutFill";
import type { ScheduleB } from "../lib/scheduleB";
import {
  chainageInWindow,
  getSectionById,
  sectionChainageWindow,
  type CorridorSection,
} from "../lib/sections";
import type { Metrics, Project } from "../lib/types";

const COLORS = ["#12c9b0", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

type DataView =
  | "overview"
  | "elevation"
  | "earthwork"
  | "environment"
  | "flood"
  | "scour"
  | "road_formation"
  | "slope_risk"
  | "structures"
  | "geotech";

const DATA_VIEWS: { id: DataView; label: string; hint: string }[] = [
  { id: "overview", label: "Overview", hint: "Key KPIs for the selected scope" },
  { id: "elevation", label: "Elevation Profile", hint: "Ground elevation along chainage" },
  { id: "earthwork", label: "Earth Balance", hint: "Corridor fill volumes (LHS / RHS)" },
  { id: "environment", label: "Environment", hint: "LULC, barren land, trees, water & villages" },
  { id: "flood", label: "Flood Risk", hint: "Satellite water & gauge levels at Digha Ghat" },
  { id: "scour", label: "Scour & HFL", hint: "Predictive bridge scour & design HFL" },
  { id: "road_formation", label: "Road Formation", hint: "Formation level vs ground elevation" },
  { id: "slope_risk", label: "Slope", hint: "Slope band distribution" },
  { id: "structures", label: "Structures & Schedule-B", hint: "Inventory and engineering register" },
  { id: "geotech", label: "Geotechnical", hint: "36 borehole soil-test logs" },
];

export default function Dashboard() {
  const [project, setProject] = useState<Project | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [geotech, setGeotech] = useState<GeotechData | null>(null);
  const [lulc, setLulc] = useState<LulcData | null>(null);
  const [groundScour, setGroundScour] = useState<GroundScourData | null>(null);
  const [roadFormation, setRoadFormation] = useState<RoadFormationData | null>(null);
  const [barrenLand, setBarrenLand] = useState<BarrenLandData | null>(null);
  const [trees, setTrees] = useState<TreesData | null>(null);
  const [waterBodies, setWaterBodies] = useState<WaterBodiesData | null>(null);
  const [waterways, setWaterways] = useState<WaterBodiesData | null>(null);
  const [villages, setVillages] = useState<VillagesData | null>(null);
  const [flood, setFlood] = useState<FloodData | null>(null);
  const [cutFill, setCutFill] = useState<CutFillData | null>(null);
  const [sectionId] = useState<number | null>(null);
  const [view, setView] = useState<DataView>("overview");

  useEffect(() => {
    fetchGeotech().then(setGeotech);
    fetchLulc().then(setLulc);
    fetchGroundScour().then(setGroundScour);
    fetchRoadFormation().then(setRoadFormation);
    fetchBarrenLand().then(setBarrenLand);
    fetchTrees().then(setTrees);
    fetchWaterBodies().then(setWaterBodies);
    fetchWaterways().then(setWaterways);
    fetchVillages().then(setVillages);
    fetchFloodTimeseries().then(setFlood);
    fetchCutFill().then(setCutFill);
    fetchProject("demo").then((p) => {
      setProject(p);
      Promise.all([fetchMetrics(p), fetchElevationProfile()]).then(([m, elev]) => {
        if (elev.length) {
          const profile = elevationToMetricsProfile(elev);
          const elevs = profile.map((x) => x.ground_level_m);
          setMetrics({
            ...m,
            elevation_profile: profile,
            min_elevation_m: Math.min(...elevs),
            max_elevation_m: Math.max(...elevs),
            avg_slope_pct: m.avg_slope_pct,
          });
        } else {
          setMetrics(m);
        }
      });
    });
  }, []);

  const section = useMemo(() => getSectionById(sectionId), [sectionId]);

  const scoped = useMemo(() => {
    if (!metrics) return null;
    return scopeMetrics(metrics, section, geotech, lulc);
  }, [metrics, section, geotech, lulc]);

  const cutFillInfo = useMemo(() => summarizeCutFill(cutFill), [cutFill]);
  const earthwork = useMemo(
    () => scopeCutFill(cutFillInfo, section, metrics?.length_km ?? null),
    [cutFillInfo, section, metrics?.length_km],
  );

  if (!project || !metrics || !scoped) {
    return (
      <div className="grid min-h-screen place-items-center pt-16 text-slate-400">
        <div className="animate-pulse">Loading engineering intelligence…</div>
      </div>
    );
  }

  const { viewMetrics: m, scopeLabel, geotechScoped, lulcClasses, scheduleB } = scoped;
  const earthworkData = [
    { name: "LHS Fill", value: earthwork.lhsFillM3 },
    { name: "RHS Fill", value: earthwork.rhsFillM3 },
    { name: "Total Fill", value: earthwork.fillM3 },
    { name: "Cut", value: earthwork.cutM3 },
  ];
  const fillClassData =
    cutFillInfo?.classCounts.map((c) => ({
      name: c.label,
      value: c.count,
      color: c.color,
    })) ?? [];
  const landUseData =
    lulcClasses.length > 0
      ? lulcClasses.map((c) => ({ name: c.name, value: c.count, color: c.color }))
      : Object.entries(m.land_use).map(([name, value]) => ({ name, value }));
  const slopeData = Object.entries(m.slope_bands).map(([name, value]) => ({ name, value }));

  // Corridor-wide summaries for the newer datasets (not section-scoped).
  const scour = summarizeGroundScour(groundScour);
  const roadForm = summarizeRoadFormation(roadFormation);
  const treesInfo = treesSummaryInfo(trees);
  const floodPeaks = floodYearlyPeaks(flood);
  const floodOverall = floodOverallPeaks(flood);
  const floodStageRecord = floodRecordMaxWaterLevel(flood);
  const floodGauge = floodGaugeReference(flood);

  return (
    <div className="min-h-screen bg-ink-950 pt-16">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="chip mb-2">GIS Dashboard</div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">{project.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {project.location} · {project.industry}
            </p>
          </div>
          <Link to="/explorer" className="btn-primary">
            Open Map Explorer <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Scope controls */}
        <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Data to view
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DATA_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  title={v.hint}
                  onClick={() => setView(v.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    view === v.id
                      ? "bg-brand-500/20 text-brand-200 ring-1 ring-brand-400/40"
                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Overview KPIs — always visible on overview; compact strip otherwise */}
        {(view === "overview" || view === "earthwork" || view === "elevation") && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Kpi
              icon={<Route className="h-5 w-5" />}
              label={section ? "Section length" : "Centreline"}
              value={
                section
                  ? `${section.ramp_length_km.toFixed(2)} km`
                  : `${m.length_km} km`
              }
              tint="text-brand-400"
            />
            <Kpi
              icon={<TriangleRight className="h-5 w-5" />}
              label="Avg Slope"
              value={`${m.avg_slope_pct}%`}
              tint="text-amber-400"
            />
            <Kpi
              icon={<Layers className="h-5 w-5" />}
              label="Total Fill"
              value={
                earthwork.fillM3 > 0
                  ? `${(earthwork.fillM3 / 1e6).toFixed(2)} Mm³`
                  : "—"
              }
              tint="text-accent-400"
            />
            <Kpi
              icon={<Mountain className="h-5 w-5" />}
              label="Structures"
              value={String(m.total_structures)}
              tint="text-violet-400"
            />
            <Kpi
              icon={<Ruler className="h-5 w-5" />}
              label="Soil boreholes"
              value={geotech ? String(geotech.count) : "—"}
              tint="text-fuchsia-400"
            />
          </div>
        )}

        {view === "overview" && (
          <>
            {/* Second KPI row — highlights from the environmental & hydraulic datasets */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Kpi
                icon={<Waves className="h-5 w-5" />}
                label="Peak flood extent"
                value={floodOverall ? `${fmt(floodOverall.peakFlood)} ha` : "—"}
                tint="text-sky-400"
              />
              <Kpi
                icon={<Droplets className="h-5 w-5" />}
                label={`${floodGauge.name} danger`}
                value={
                  floodGauge.danger_level_m != null
                    ? `${floodGauge.danger_level_m.toFixed(2)} m`
                    : "—"
                }
                tint="text-amber-300"
              />
              <Kpi
                icon={<AlertTriangle className="h-5 w-5" />}
                label="Max bridge scour"
                value={scour?.scourMaxM != null ? `${scour.scourMaxM.toFixed(2)} m` : "—"}
                tint="text-rose-400"
              />
              <Kpi
                icon={<Droplets className="h-5 w-5" />}
                label="Design HFL (max)"
                value={scour?.designHflMaxM != null ? `${scour.designHflMaxM.toFixed(2)} m` : "—"}
                tint="text-cyan-400"
              />
              <Kpi
                icon={<TreesIcon className="h-5 w-5" />}
                label="Trees inventoried"
                value={treesInfo ? treesInfo.totalTrees.toLocaleString() : "—"}
                tint="text-emerald-400"
              />
              <Kpi
                icon={<Building2 className="h-5 w-5" />}
                label="Villages"
                value={villages ? String(villages.count) : "—"}
                tint="text-violet-400"
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <Panel title="Elevation Profile" className="lg:col-span-2">
                <ElevationChart data={m.elevation_profile} />
              </Panel>
              <Panel title="Cut & Fill Balance">
                <EarthworkChart data={earthworkData} />
              </Panel>
              <Panel title="Land Use / LULC">
                <LandUseChart data={landUseData} />
              </Panel>
              <Panel title="Slope Distribution">
                <SlopeChart data={slopeData} />
              </Panel>
            </div>
          </>
        )}

        {view === "elevation" && (
          <div className="mt-6 space-y-4">
            <Panel
              title={`Ground Elevation Profile${section ? ` · ${section.name}` : " · Full corridor"}`}
            >
              <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-400">
                <span>
                  Points: <span className="text-white">{m.elevation_profile.length.toLocaleString()}</span>
                </span>
                <span>
                  Range:{" "}
                  <span className="text-white">
                    {m.min_elevation_m.toFixed(0)}–{m.max_elevation_m.toFixed(0)} m
                  </span>
                </span>
                {section && (
                  <span>
                    Chainage window:{" "}
                    <span className="text-white">
                      {sectionChainageWindow(section).fromKm.toFixed(2)}–
                      {sectionChainageWindow(section).toKm.toFixed(2)} km
                    </span>
                  </span>
                )}
              </div>
              <ElevationChart data={m.elevation_profile} height={340} />
            </Panel>
          </div>
        )}

        {view === "earthwork" && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Kpi
                icon={<Layers className="h-5 w-5" />}
                label="Total fill"
                value={
                  earthwork.fillM3 > 0
                    ? `${(earthwork.fillM3 / 1e6).toFixed(2)} Mm³`
                    : "—"
                }
                tint="text-orange-400"
              />
              <Kpi
                icon={<Route className="h-5 w-5" />}
                label="LHS fill"
                value={
                  earthwork.lhsFillM3 > 0
                    ? `${(earthwork.lhsFillM3 / 1e6).toFixed(2)} Mm³`
                    : "—"
                }
                tint="text-sky-400"
              />
              <Kpi
                icon={<Route className="h-5 w-5" />}
                label="RHS fill"
                value={
                  earthwork.rhsFillM3 > 0
                    ? `${(earthwork.rhsFillM3 / 1e6).toFixed(2)} Mm³`
                    : "—"
                }
                tint="text-amber-400"
              />
              <Kpi
                icon={<Mountain className="h-5 w-5" />}
                label="Cut volume"
                value={`${fmt(earthwork.cutM3)} m³`}
                tint="text-brand-400"
              />
              <Kpi
                icon={<Ruler className="h-5 w-5" />}
                label="Chainage"
                value={
                  cutFillInfo?.fromKm != null && cutFillInfo?.toKm != null
                    ? `${cutFillInfo.fromKm.toFixed(1)}–${cutFillInfo.toKm.toFixed(1)} km`
                    : "—"
                }
                tint="text-slate-300"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Cut & Fill volumes">
                <EarthworkChart data={earthworkData} height={300} />
              </Panel>
              <Panel title="Earthwork quantities">
                <div className="space-y-3">
                  {[
                    ["LHS fill", earthwork.lhsFillM3, "#38bdf8"],
                    ["RHS fill", earthwork.rhsFillM3, "#f97316"],
                    ["Total fill", earthwork.fillM3, "#ea580c"],
                    ["Cut", earthwork.cutM3, "#12c9b0"],
                    ["Net (fill − cut)", earthwork.netM3, "#ef4444"],
                  ].map(([label, value, color]) => (
                    <div
                      key={String(label)}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ background: String(color) }}
                        />
                        <span className="text-sm text-slate-300">{label}</span>
                      </div>
                      <span className="font-semibold tabular-nums text-white">
                        {Number(value) >= 1e6
                          ? `${(Number(value) / 1e6).toFixed(2)} Mm³`
                          : `${fmt(Number(value))} m³`}
                      </span>
                    </div>
                  ))}
                  {section && (
                    <p className="pt-1 text-[11px] text-slate-500">
                      Quantities scaled to section length ({section.ramp_length_km.toFixed(2)} km)
                      from corridor cut &amp; fill survey.
                    </p>
                  )}
                  {!section && cutFillInfo && (
                    <p className="pt-1 text-[11px] text-slate-500">
                      Source: excavation datasheet · {cutFillInfo.segmentCount} × 100 m segments ·
                      60 m RoW (LHS + RHS).
                    </p>
                  )}
                </div>
              </Panel>
            </div>

            {fillClassData.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Fill height class distribution">
                  <LandUseChart data={fillClassData} height={280} />
                </Panel>
                <Panel title="Class breakdown (100 m segments)">
                  <div className="space-y-2">
                    {fillClassData.map((row) => (
                      <div
                        key={row.name}
                        className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: row.color }}
                          />
                          <span className="text-slate-300">{row.name}</span>
                        </div>
                        <span className="tabular-nums text-white">
                          {row.value} segments
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}
          </div>
        )}

        {view === "environment" && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Kpi
                icon={<Layers className="h-5 w-5" />}
                label="LULC polygons"
                value={lulc ? lulc.count.toLocaleString() : "—"}
                tint="text-brand-400"
              />
              <Kpi
                icon={<Ruler className="h-5 w-5" />}
                label="LULC area"
                value={
                  lulc?.total_area_ha != null ? `${fmt(lulc.total_area_ha)} ha` : "—"
                }
                tint="text-teal-400"
              />
              <Kpi
                icon={<Sprout className="h-5 w-5" />}
                label="Barren land"
                value={
                  barrenLand
                    ? `${barrenLand.count} · ${fmt(barrenLand.total_area_ha ?? 0)} ha`
                    : "—"
                }
                tint="text-amber-400"
              />
              <Kpi
                icon={<TreesIcon className="h-5 w-5" />}
                label="Trees"
                value={trees ? trees.count.toLocaleString() : "—"}
                tint="text-emerald-400"
              />
              <Kpi
                icon={<Droplets className="h-5 w-5" />}
                label="Water / waterways"
                value={`${waterBodies?.count ?? 0} / ${waterways?.count ?? 0}`}
                tint="text-sky-400"
              />
              <Kpi
                icon={<Building2 className="h-5 w-5" />}
                label="Villages"
                value={villages ? String(villages.count) : "—"}
                tint="text-violet-400"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Land Use Classification (LULC)">
                <LandUseChart data={landUseData} height={300} />
              </Panel>
              <Panel title="Class breakdown">
                <div className="space-y-2">
                  {(() => {
                    const total = landUseData.reduce(
                      (sum, row) => sum + (Number(row.value) || 0),
                      0,
                    );
                    return landUseData.map((row, i) => {
                      const pct =
                        total > 0 ? ((Number(row.value) || 0) / total) * 100 : Number(row.value) || 0;
                      return (
                        <div
                          key={row.name}
                          className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-sm"
                              style={{
                                background:
                                  "color" in row && row.color
                                    ? String(row.color)
                                    : COLORS[i % COLORS.length],
                              }}
                            />
                            <span className="text-slate-300">{row.name}</span>
                          </div>
                          <span className="tabular-nums text-white">{pct.toFixed(1)}%</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </Panel>
            </div>

            {treesInfo && (
              <Panel title="Tree Inventory (within 50 m of corridor)">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <StatBox label="Total trees" value={treesInfo.totalTrees.toLocaleString()} />
                  <StatBox label="Corridor zones" value={String(treesInfo.corridorZones)} />
                  <StatBox
                    label="Canopy area"
                    value={`${fmt(treesInfo.totalCanopyAreaM2)} m²`}
                  />
                  <StatBox label="Avg height" value={`${treesInfo.avgHeightM} m`} />
                  <StatBox label="Tallest" value={`${treesInfo.tallestM} m`} />
                  <StatBox
                    label="Largest canopy"
                    value={`${fmt(treesInfo.largestCanopyM2)} m²`}
                  />
                </div>
              </Panel>
            )}
          </div>
        )}

        {view === "flood" && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Kpi
                icon={<Waves className="h-5 w-5" />}
                label="Observation dates"
                value={flood ? flood.dates.length.toLocaleString() : "—"}
                tint="text-sky-400"
              />
              <Kpi
                icon={<Layers className="h-5 w-5" />}
                label="Years covered"
                value={floodOverall ? floodOverall.yearsLabel : "—"}
                tint="text-brand-400"
              />
              <Kpi
                icon={<AlertTriangle className="h-5 w-5" />}
                label="Peak inundation"
                value={floodOverall ? `${fmt(floodOverall.peakFlood)} ha` : "—"}
                tint="text-orange-400"
              />
              <Kpi
                icon={<Droplets className="h-5 w-5" />}
                label="Peak water extent"
                value={floodOverall ? `${fmt(floodOverall.peakWater)} ha` : "—"}
                tint="text-cyan-400"
              />
              <Kpi
                icon={<Waves className="h-5 w-5" />}
                label="Record max water level"
                value={
                  floodStageRecord
                    ? `${floodStageRecord.max_water_level_m.toFixed(2)} m`
                    : "—"
                }
                tint="text-rose-400"
              />
              <Kpi
                icon={<AlertTriangle className="h-5 w-5" />}
                label={`${floodGauge.name} danger`}
                value={
                  floodGauge.danger_level_m != null
                    ? `${floodGauge.danger_level_m.toFixed(2)} m`
                    : "—"
                }
                tint="text-amber-300"
              />
            </div>

            {flood ? (
              <>
                {flood.max_water_levels && flood.max_water_levels.length > 0 && (
                  <Panel title="Yearly Maximum Water Level (m)">
                    <div className="mb-3 text-xs text-slate-400">
                      Measured at{" "}
                      <span className="font-semibold text-sky-300">
                        {floodGaugeReference(flood).name}
                      </span>
                      {floodGaugeReference(flood).agency ? (
                        <span> · {floodGaugeReference(flood).agency}</span>
                      ) : null}
                      . Record:{" "}
                      <span className="font-semibold text-rose-300">
                        {floodStageRecord?.max_water_level_m.toFixed(2)} m
                      </span>
                      {floodStageRecord?.note
                        ? ` · ${floodStageRecord.peak_label} (${floodStageRecord.note})`
                        : floodStageRecord
                          ? ` · ${floodStageRecord.peak_label}`
                          : ""}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Year</th>
                            <th className="px-3 py-2 font-semibold">Max water level (m)</th>
                            <th className="px-3 py-2 font-semibold">Peak date</th>
                            <th className="px-3 py-2 font-semibold">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {flood.max_water_levels.map((row) => {
                            const isRecord =
                              floodStageRecord != null &&
                              row.year === floodStageRecord.year;
                            return (
                              <tr
                                key={row.year}
                                className="border-t border-white/5 text-slate-300"
                              >
                                <td
                                  className={`px-3 py-2 font-semibold tabular-nums ${
                                    isRecord ? "text-rose-300" : "text-white"
                                  }`}
                                >
                                  {row.year}
                                </td>
                                <td
                                  className={`px-3 py-2 tabular-nums font-semibold ${
                                    isRecord ? "text-rose-300" : "text-sky-300"
                                  }`}
                                >
                                  {row.max_water_level_m.toFixed(2)} m
                                </td>
                                <td className="px-3 py-2 text-slate-400">
                                  {row.peak_label}
                                </td>
                                <td className="px-3 py-2 text-rose-300/90">
                                  {row.note ?? "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 h-[220px]">
                      <MaxWaterLevelChart
                        data={flood.max_water_levels}
                        gauge={floodGaugeReference(flood)}
                        record={floodStageRecord}
                      />
                    </div>
                  </Panel>
                )}
                <Panel title="Water & Inundation Extent Over Time (ha)">
                  <FloodTrendChart
                    data={flood.timeseries.map((t) => ({
                      date: t.date,
                      water: t.water_area_ha ?? 0,
                      flood: t.flood_area_ha ?? 0,
                    }))}
                  />
                </Panel>
                <Panel title="Yearly Peak Inundation vs Water Area (ha)">
                  <YearlyFloodChart data={floodPeaks} />
                </Panel>
              </>
            ) : (
              <Panel title="Flood Risk">
                <p className="text-sm text-slate-400">Flood time-series data unavailable.</p>
              </Panel>
            )}
          </div>
        )}

        {view === "scour" && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Kpi
                icon={<AlertTriangle className="h-5 w-5" />}
                label="Assessed points"
                value={scour ? scour.pointCount.toLocaleString() : "—"}
                tint="text-rose-400"
              />
              <Kpi
                icon={<Route className="h-5 w-5" />}
                label="Stretches"
                value={scour ? String(scour.stretchCount) : "—"}
                tint="text-brand-400"
              />
              <Kpi
                icon={<Mountain className="h-5 w-5" />}
                label="Scour max"
                value={scour?.scourMaxM != null ? `${scour.scourMaxM.toFixed(2)} m` : "—"}
                tint="text-orange-400"
              />
              <Kpi
                icon={<Mountain className="h-5 w-5" />}
                label="Scour min"
                value={scour?.scourMinM != null ? `${scour.scourMinM.toFixed(2)} m` : "—"}
                tint="text-amber-400"
              />
              <Kpi
                icon={<Droplets className="h-5 w-5" />}
                label="Design HFL range"
                value={
                  scour?.designHflMinM != null && scour?.designHflMaxM != null
                    ? `${scour.designHflMinM.toFixed(1)}–${scour.designHflMaxM.toFixed(1)} m`
                    : "—"
                }
                tint="text-cyan-400"
              />
              <Kpi
                icon={<Ruler className="h-5 w-5" />}
                label="Chainage"
                value={
                  scour?.fromKm != null && scour?.toKm != null
                    ? `${scour.fromKm.toFixed(1)}–${scour.toKm.toFixed(1)} km`
                    : "—"
                }
                tint="text-teal-400"
              />
            </div>

            {groundScour && scour ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Max Scour Depth Along Chainage" className="lg:col-span-2">
                  <ScourChainageChart
                    data={[...groundScour.points]
                      .filter((p) => p.scour_max_m != null)
                      .sort((a, b) => a.chainage_km - b.chainage_km)
                      .map((p) => ({
                        chainage_km: p.chainage_km,
                        scour: p.scour_max_m ?? 0,
                        hfl: p.design_hfl_continuous_m ?? 0,
                      }))}
                  />
                </Panel>
                <Panel title="Hydraulic Zone Distribution">
                  <LandUseChart
                    data={scour.zoneCounts.map((z) => ({
                      name: z.zone,
                      value: z.count,
                      color: groundScourZoneColor(z.zone),
                    }))}
                    height={300}
                  />
                </Panel>
              </div>
            ) : (
              <Panel title="Scour & HFL">
                <p className="text-sm text-slate-400">Bridge scour analysis data unavailable.</p>
              </Panel>
            )}
          </div>
        )}

        {view === "road_formation" && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Kpi
                icon={<Route className="h-5 w-5" />}
                label="Survey points"
                value={roadForm ? roadForm.pointCount.toLocaleString() : "—"}
                tint="text-brand-400"
              />
              <Kpi
                icon={<Layers className="h-5 w-5" />}
                label="Branches"
                value={roadForm ? String(roadForm.branchCount) : "—"}
                tint="text-violet-400"
              />
              <Kpi
                icon={<Mountain className="h-5 w-5" />}
                label="Formation level"
                value={
                  roadForm?.formationMinM != null && roadForm?.formationMaxM != null
                    ? `${roadForm.formationMinM.toFixed(1)}–${roadForm.formationMaxM.toFixed(1)} m`
                    : "—"
                }
                tint="text-orange-400"
              />
              <Kpi
                icon={<TriangleRight className="h-5 w-5" />}
                label="Ground level"
                value={
                  roadForm?.groundMinM != null && roadForm?.groundMaxM != null
                    ? `${roadForm.groundMinM.toFixed(1)}–${roadForm.groundMaxM.toFixed(1)} m`
                    : "—"
                }
                tint="text-teal-400"
              />
              <Kpi
                icon={<Ruler className="h-5 w-5" />}
                label="Chainage"
                value={
                  roadForm?.fromKm != null && roadForm?.toKm != null
                    ? `${roadForm.fromKm.toFixed(1)}–${roadForm.toKm.toFixed(1)} km`
                    : "—"
                }
                tint="text-cyan-400"
              />
              <Kpi
                icon={<Mountain className="h-5 w-5" />}
                label="Max embankment"
                value={
                  roadForm?.formationMaxM != null && roadForm?.groundMinM != null
                    ? `${(roadForm.formationMaxM - roadForm.groundMinM).toFixed(1)} m`
                    : "—"
                }
                tint="text-rose-400"
              />
            </div>

            {roadFormation && roadFormation.branches.length > 0 ? (
              <Panel title="Road Formation Level vs Ground Elevation">
                <RoadFormationChart data={roadFormation} />
              </Panel>
            ) : (
              <Panel title="Road Formation">
                <p className="text-sm text-slate-400">Road formation data unavailable.</p>
              </Panel>
            )}
          </div>
        )}

        {view === "slope_risk" && (
          <div className="mt-6">
            <Panel title="Slope Distribution">
              <SlopeChart data={slopeData} height={300} />
            </Panel>
          </div>
        )}

        {view === "structures" && (
          <div className="mt-6 space-y-4">
            <Panel title="Structures Inventory">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {Object.entries(m.structures).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                    <div className="text-3xl font-extrabold gradient-text">{v}</div>
                    <div className="mt-1 text-xs capitalize text-slate-400">{k.replace(/_/g, " ")}</div>
                  </div>
                ))}
              </div>
            </Panel>

            {scheduleB && (
              <>
                <ScheduleBCountStrip sb={scheduleB} />
                <div className="grid gap-4 lg:grid-cols-3">
                  <Panel title="Schedule-B · Pavement Crust (IRC:37-2018)">
                    <div className="space-y-3">
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Main carriageway
                        </div>
                        {scheduleB.crust_layers.main_carriageway.map((row, i) => (
                          <div
                            key={i}
                            className="flex justify-between border-b border-white/5 py-1.5 text-sm"
                          >
                            <span className="text-slate-300">{row.layer}</span>
                            <span className="font-medium text-white">{row.thickness}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Service roads / crossroads
                        </div>
                        {scheduleB.crust_layers.service_roads.map((row, i) => (
                          <div
                            key={i}
                            className="flex justify-between border-b border-white/5 py-1.5 text-sm"
                          >
                            <span className="text-slate-300">{row.layer}</span>
                            <span className="font-medium text-white">{row.thickness}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Panel>
                  <div className="lg:col-span-2">
                    <ScheduleBRegister sb={scheduleB} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {view === "geotech" && (
          <div className="mt-6">
            {geotechScoped && geotechScoped.boreholes.length > 0 ? (
              <GeotechSection geotech={geotechScoped} />
            ) : (
              <Panel title="Geotechnical">
                <p className="text-sm text-slate-400">
                  No borehole data in the selected section. Choose “All corridor” or another section.
                </p>
              </Panel>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          Showing <span className="text-slate-400">{scopeLabel}</span>
          {view !== "overview" && (
            <>
              {" "}
              · <span className="text-slate-400">{DATA_VIEWS.find((v) => v.id === view)?.label}</span>
            </>
          )}{" "}
          · Design centreline: {project.stats.design_length_km ?? metrics.length_km} km · Drawn:{" "}
          {fmt(project.stats.total_length_km)} km · {project.stats.line_count.toLocaleString()} line
          features.
        </p>
      </div>
    </div>
  );
}

function scopeCutFill(
  info: CutFillSummary | null,
  section: CorridorSection | null,
  corridorLengthKm: number | null,
): {
  fillM3: number;
  cutM3: number;
  netM3: number;
  lhsFillM3: number;
  rhsFillM3: number;
} {
  const fill = info?.fillM3 ?? 0;
  const cut = info?.cutM3 ?? 0;
  const net = info?.netM3 ?? fill - cut;
  const lhs = info?.lhsFillM3 ?? 0;
  const rhs = info?.rhsFillM3 ?? 0;
  if (!section || !corridorLengthKm || corridorLengthKm <= 0) {
    return { fillM3: fill, cutM3: cut, netM3: net, lhsFillM3: lhs, rhsFillM3: rhs };
  }
  const scale = section.ramp_length_km / corridorLengthKm;
  return {
    fillM3: Math.round(fill * scale),
    cutM3: Math.round(cut * scale),
    netM3: Math.round(net * scale),
    lhsFillM3: Math.round(lhs * scale),
    rhsFillM3: Math.round(rhs * scale),
  };
}

function scopeMetrics(
  metrics: Metrics,
  section: CorridorSection | null,
  geotech: GeotechData | null,
  lulc: LulcData | null,
) {
  const fullLength = Math.max(metrics.length_km, 0.001);
  const window = section ? sectionChainageWindow(section) : null;
  const scale = section ? section.ramp_length_km / fullLength : 1;

  const profile = window
    ? metrics.elevation_profile.filter((p) =>
        chainageInWindow(p.chainage_km, window.fromKm, window.toKm),
      )
    : metrics.elevation_profile;

  const elevs = profile.map((p) => p.ground_level_m);
  const minElev = elevs.length ? Math.min(...elevs) : metrics.min_elevation_m;
  const maxElev = elevs.length ? Math.max(...elevs) : metrics.max_elevation_m;

  const ew = metrics.earthwork;
  const earthwork = section
    ? {
        cut_m3: Math.round(ew.cut_m3 * scale),
        fill_m3: Math.round(ew.fill_m3 * scale),
        borrow_m3: Math.round(ew.borrow_m3 * scale),
        waste_m3: Math.round(ew.waste_m3 * scale),
        balance_m3: Math.round(ew.balance_m3 * scale),
      }
    : ew;

  const scheduleB = filterScheduleB(metrics.schedule_b ?? null, window);
  const structures = scheduleB
    ? countStructuresFromSb(scheduleB)
    : scaleRecord(metrics.structures, scale);
  const total_structures = Object.values(structures).reduce((a, b) => a + b, 0);

  const geotechScoped = filterGeotech(geotech, window);
  const lulcClasses = lulc?.classes ?? [];

  const viewMetrics: Metrics = {
    ...metrics,
    elevation_profile: profile.length ? profile : metrics.elevation_profile,
    min_elevation_m: Math.round(minElev * 10) / 10,
    max_elevation_m: Math.round(maxElev * 10) / 10,
    earthwork,
    structures,
    total_structures,
    estimated_cost_cr: Math.round(metrics.estimated_cost_cr * scale * 10) / 10,
    schedule_b: scheduleB,
  };

  const scopeLabel = section
    ? `Section ${section.id}: ${section.name} · Ch ${section.interchange_km.toFixed(3)} km`
    : "All corridor sections";

  return { viewMetrics, scopeLabel, geotechScoped, lulcClasses, scheduleB };
}

function scaleRecord(rec: Record<string, number>, scale: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = Math.max(0, Math.round(v * scale));
  }
  return out;
}

function inChWindow(
  value: unknown,
  window: { fromKm: number; toKm: number } | null,
): boolean {
  if (!window) return true;
  const n = Number(value);
  if (!Number.isFinite(n)) return true;
  return chainageInWindow(n, window.fromKm, window.toKm);
}

function overlapsWindow(
  from: unknown,
  to: unknown,
  window: { fromKm: number; toKm: number } | null,
): boolean {
  if (!window) return true;
  const a = Number(from);
  const b = Number(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return hi >= window.fromKm && lo <= window.toKm;
}

function filterScheduleB(
  sb: ScheduleB | null,
  window: { fromKm: number; toKm: number } | null,
): ScheduleB | null {
  if (!sb) return null;
  if (!window) return sb;

  const pointRows = <T extends Record<string, unknown>>(rows: T[] | undefined) =>
    (rows ?? []).filter((r) => inChWindow(r.chainage_km, window));

  const rangeRows = <T extends Record<string, unknown>>(rows: T[] | undefined) =>
    (rows ?? []).filter((r) => overlapsWindow(r.from_km, r.to_km, window));

  return {
    ...sb,
    structures: pointRows(sb.structures),
    underpasses: pointRows(sb.underpasses),
    overpasses: pointRows(sb.overpasses),
    interchanges: pointRows(sb.interchanges),
    culverts: pointRows(sb.culverts),
    interchange_ramps: rangeRows(sb.interchange_ramps),
    elevated: rangeRows(sb.elevated),
    re_walls: rangeRows(sb.re_walls),
    drains: rangeRows(sb.drains),
    service_roads: rangeRows(sb.service_roads),
    paved_shoulders: rangeRows(sb.paved_shoulders),
    tcs_stretches: rangeRows(sb.tcs_stretches),
  };
}

function countStructuresFromSb(sb: ScheduleB): Record<string, number> {
  return {
    underpasses: sb.underpasses?.length ?? 0,
    overpasses: sb.overpasses?.length ?? 0,
    interchanges: sb.interchanges?.length ?? 0,
    culverts: sb.culverts?.length ?? 0,
    retaining_walls: sb.re_walls?.length ?? 0,
    elevated_sections: sb.elevated?.length ?? 0,
    drain_sections: sb.drains?.length ?? 0,
  };
}

function filterGeotech(
  geotech: GeotechData | null,
  window: { fromKm: number; toKm: number } | null,
): GeotechData | null {
  if (!geotech) return null;
  if (!window) return geotech;
  // Boreholes rarely have chainage; keep all when section-scoped unless chainage exists.
  const boreholes = geotech.boreholes.filter((b) => {
    const ch = (b as { chainage_km?: number }).chainage_km;
    if (ch == null || !Number.isFinite(ch)) return true;
    return chainageInWindow(ch, window.fromKm, window.toKm);
  });
  return {
    ...geotech,
    boreholes,
    count: boreholes.length,
    detailed_count: boreholes.filter((b) => b.layers.length > 0).length,
  };
}

const tooltipStyle = {
  background: "#0a1120",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#e6edf7",
  fontSize: 12,
};

const tooltipItemStyle = { color: "#e6edf7" };
const tooltipLabelStyle = { color: "#94a3b8" };

function ElevationChart({
  data,
  height = 260,
}: {
  data: Array<{ chainage_km: number; ground_level_m: number }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="elev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12c9b0" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#12c9b0" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
        <XAxis dataKey="chainage_km" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}`} />
        <YAxis stroke="#64748b" fontSize={11} unit="m" />
        <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} labelFormatter={(v) => `Chainage ${v} km`} />
        <Area
          type="monotone"
          dataKey="ground_level_m"
          stroke="#38e1c6"
          strokeWidth={2}
          fill="url(#elev)"
          name="Ground level"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EarthworkChart({
  data,
  height = 260,
}: {
  data: Array<{ name: string; value: number }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
        <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
        <YAxis stroke="#64748b" fontSize={11} tickFormatter={fmt} />
        <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} formatter={(v: number) => [`${fmt(v)} m³`, ""]} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LandUseChart({
  data,
  height = 260,
  valueSuffix = "%",
}: {
  data: Array<{ name: string; value: number; color?: string }>;
  height?: number;
  /** Unit shown in tooltip. Defaults to percent of total. */
  valueSuffix?: "%" | "polygons" | "segments" | "count";
}) {
  const total = data.reduce((sum, row) => sum + (Number(row.value) || 0), 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((row, i) => (
            <Cell key={i} fill={row.color ?? COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value: number, name: string) => {
            const n = Number(value) || 0;
            if (valueSuffix === "%") {
              const pct = total > 0 ? (n / total) * 100 : 0;
              return [`${pct.toFixed(1)}%`, String(name)];
            }
            if (valueSuffix === "polygons") {
              return [`${n.toLocaleString()} polygons`, String(name)];
            }
            if (valueSuffix === "segments") {
              return [`${n.toLocaleString()} segments`, String(name)];
            }
            return [n.toLocaleString(), String(name)];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function SlopeChart({
  data,
  height = 260,
}: {
  data: Array<{ name: string; value: number }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
        <XAxis type="number" stroke="#64748b" fontSize={11} unit="%" />
        <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={110} />
        <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} formatter={(v: number) => [`${v}%`, ""]} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={["#22c55e", "#eab308", "#f97316", "#ef4444"][i % 4]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

type FloodYearRow = { year: string; peakFlood: number; peakWater: number };

function floodYearlyPeaks(flood: FloodData | null): FloodYearRow[] {
  if (!flood?.timeseries?.length) return [];
  const byYear = new Map<string, { peakFlood: number; peakWater: number }>();
  for (const t of flood.timeseries) {
    const year = t.date.slice(0, 4);
    const entry = byYear.get(year) ?? { peakFlood: 0, peakWater: 0 };
    entry.peakFlood = Math.max(entry.peakFlood, t.flood_area_ha ?? 0);
    entry.peakWater = Math.max(entry.peakWater, t.water_area_ha ?? 0);
    byYear.set(year, entry);
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, v]) => ({ year, peakFlood: v.peakFlood, peakWater: v.peakWater }));
}

function floodOverallPeaks(
  flood: FloodData | null,
): { peakFlood: number; peakWater: number; yearsLabel: string } | null {
  if (!flood?.timeseries?.length) return null;
  let peakFlood = 0;
  let peakWater = 0;
  for (const t of flood.timeseries) {
    peakFlood = Math.max(peakFlood, t.flood_area_ha ?? 0);
    peakWater = Math.max(peakWater, t.water_area_ha ?? 0);
  }
  const years = flood.dates.map((d) => d.slice(0, 4));
  const yearsLabel = years.length ? `${years[0]}–${years[years.length - 1]}` : "—";
  return { peakFlood, peakWater, yearsLabel };
}

function FloodTrendChart({
  data,
}: {
  data: Array<{ date: string; water: number; flood: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="floodWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="floodInund" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          fontSize={10}
          minTickGap={40}
          tickFormatter={(v) => String(v).slice(0, 4)}
        />
        <YAxis stroke="#64748b" fontSize={11} tickFormatter={fmt} unit="" />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(v) => formatFloodDate(String(v))}
          formatter={(val: number, name) => [
            `${fmt(val)} ha`,
            name === "water" ? "Water area" : "Inundation area",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
          formatter={(v) => (v === "water" ? "Water area" : "Inundation area")}
        />
        <Area
          type="monotone"
          dataKey="water"
          stroke="#38bdf8"
          strokeWidth={1.5}
          fill="url(#floodWater)"
        />
        <Area
          type="monotone"
          dataKey="flood"
          stroke="#fb923c"
          strokeWidth={1.5}
          fill="url(#floodInund)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function YearlyFloodChart({ data }: { data: FloodYearRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
        <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
        <YAxis stroke="#64748b" fontSize={11} tickFormatter={fmt} />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(val: number, name) => [
            `${fmt(val)} ha`,
            name === "peakWater" ? "Peak water" : "Peak inundation",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
          formatter={(v) => (v === "peakWater" ? "Peak water" : "Peak inundation")}
        />
        <Bar dataKey="peakWater" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
        <Bar dataKey="peakFlood" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MaxWaterLevelChart({
  data,
  gauge,
  record,
}: {
  data: FloodMaxWaterLevel[];
  gauge?: ReturnType<typeof floodGaugeReference>;
  record?: FloodMaxWaterLevel | null;
}) {
  const chartData = data.map((r) => ({
    year: String(r.year),
    level: r.max_water_level_m,
    label: r.peak_label,
    note: r.note ?? "",
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
        <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
        <YAxis
          stroke="#64748b"
          fontSize={11}
          unit=" m"
          domain={["dataMin - 1", "dataMax + 1"]}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(val: number, _name, item) => {
            const row = item?.payload as { label?: string; note?: string } | undefined;
            const extras = [row?.label, row?.note].filter(Boolean).join(" · ");
            return [
              `${Number(val).toFixed(2)} m${extras ? ` · ${extras}` : ""}`,
              gauge ? `Max water level · ${gauge.name}` : "Max water level",
            ];
          }}
        />
        {record && (
          <ReferenceLine
            y={record.max_water_level_m}
            stroke="#fb7185"
            strokeDasharray="4 3"
            label={{
              value: `Record ${record.max_water_level_m.toFixed(2)} m`,
              fill: "#fb7185",
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
        )}
        {gauge?.danger_level_m != null && (
          <ReferenceLine
            y={gauge.danger_level_m}
            stroke="#fbbf24"
            strokeDasharray="6 4"
            label={{
              value: `Danger ${gauge.danger_level_m.toFixed(2)} m`,
              fill: "#fbbf24",
              fontSize: 10,
              position: "insideTopLeft",
            }}
          />
        )}
        <Bar dataKey="level" fill="#38bdf8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ScourChainageChart({
  data,
}: {
  data: Array<{ chainage_km: number; scour: number; hfl: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="scourFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
        <XAxis
          dataKey="chainage_km"
          stroke="#64748b"
          fontSize={11}
          tickFormatter={(v) => `${Number(v).toFixed(0)}`}
        />
        <YAxis stroke="#64748b" fontSize={11} unit="m" />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(v) => `Chainage ${Number(v).toFixed(3)} km`}
          formatter={(val: number, name) => [
            `${Number(val).toFixed(2)} m`,
            name === "scour" ? "Max scour" : "Design HFL",
          ]}
        />
        <Area
          type="monotone"
          dataKey="scour"
          stroke="#f43f5e"
          strokeWidth={2}
          fill="url(#scourFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RoadFormationChart({ data }: { data: RoadFormationData }) {
  // Merge branches into one chainage-keyed series set so ground + each formation
  // branch can be compared on a single axis.
  const rows = new Map<number, Record<string, number>>();
  for (const branch of data.branches) {
    for (const p of branch.points) {
      const key = Math.round(p.chainage_km * 1000) / 1000;
      const row = rows.get(key) ?? { chainage_km: key };
      if (p.ground_elev_m != null) row.ground = p.ground_elev_m;
      if (p.formation_level_m != null) row[branch.id] = p.formation_level_m;
      rows.set(key, row);
    }
  }
  const merged = [...rows.values()].sort((a, b) => a.chainage_km - b.chainage_km);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <AreaChart data={merged}>
        <defs>
          <linearGradient id="groundFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38e1c6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#38e1c6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
        <XAxis
          dataKey="chainage_km"
          stroke="#64748b"
          fontSize={11}
          tickFormatter={(v) => `${Number(v).toFixed(0)}`}
        />
        <YAxis stroke="#64748b" fontSize={11} unit="m" domain={["dataMin - 2", "dataMax + 2"]} />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(v) => `Chainage ${Number(v).toFixed(3)} km`}
          formatter={(val: number, name) => [`${Number(val).toFixed(2)} m`, String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
        <Area
          type="monotone"
          dataKey="ground"
          name="Ground"
          stroke="#38e1c6"
          strokeWidth={2}
          fill="url(#groundFill)"
          connectNulls
        />
        {data.branches.map((b) => (
          <Area
            key={b.id}
            type="monotone"
            dataKey={b.id}
            name={`Formation ${b.name}`}
            stroke={ROAD_FORMATION_BRANCH_COLORS[b.id] ?? "#f59e0b"}
            strokeWidth={1.75}
            fill="none"
            connectNulls
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-slate-400">{label}</div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="card p-4">
      <div className={`mb-2 ${tint}`}>{icon}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card p-5 ${className}`}>
      <h3 className="mb-4 text-sm font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
  if (Math.abs(n) >= 1e5) return (n / 1e5).toFixed(1) + "L";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(Math.round(n));
}

function cell(v: unknown): string {
  if (v == null || v === "" || String(v) === "null") return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return String(v).replace(/\s*\n\s*/g, " ");
}

const COUNT_TINTS: Record<string, string> = {
  Underpasses: "text-blue-400",
  Overpasses: "text-violet-400",
  Interchanges: "text-amber-400",
  Culverts: "text-cyan-400",
  Elevated: "text-brand-400",
  "RE Walls": "text-orange-400",
  Drains: "text-sky-400",
  "Service Roads": "text-blue-300",
  Ramps: "text-yellow-400",
  "Paved Shoulders": "text-slate-300",
  TCS: "text-emerald-400",
};

function ScheduleBCountStrip({ sb }: { sb: ScheduleB }) {
  const items: Array<[string, number]> = [
    ["Underpasses", sb.underpasses?.length ?? 0],
    ["Overpasses", sb.overpasses?.length ?? 0],
    ["Interchanges", sb.interchanges?.length ?? 0],
    ["Ramps", sb.interchange_ramps?.length ?? 0],
    ["Elevated", sb.elevated?.length ?? 0],
    ["Culverts", sb.culverts?.length ?? 0],
    ["RE Walls", sb.re_walls?.length ?? 0],
    ["Drains", sb.drains?.length ?? 0],
    ["Service Roads", sb.service_roads?.length ?? 0],
    ["Paved Shoulders", sb.paved_shoulders?.length ?? 0],
    ["TCS", sb.tcs_stretches?.length ?? 0],
  ];
  return (
    <Panel title="Schedule-B · Inventory Summary">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11">
        {items.map(([label, count]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <div className={`text-2xl font-extrabold ${COUNT_TINTS[label] ?? "text-white"}`}>
              {count}
            </div>
            <div className="mt-1 text-[10px] leading-tight text-slate-400">{label}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

type Column = { key: string; label: string; suffix?: string };

type RegisterTab = {
  id: string;
  label: string;
  rows: Array<Record<string, unknown>>;
  columns: Column[];
};

function ScheduleBRegister({ sb }: { sb: ScheduleB }) {
  const tabs: RegisterTab[] = [
    {
      id: "structures",
      label: `Structures (${sb.structures?.length ?? 0})`,
      rows: (sb.structures ?? []).map((s) => ({
        chainage_km: s.chainage_km,
        type: s.type,
        label: s.label,
        detail:
          (s.details as Record<string, unknown>)?.span_arrangement ??
          (s.details as Record<string, unknown>)?.superstructure_type ??
          "—",
      })),
      columns: [
        { key: "chainage_km", label: "Chainage", suffix: " km" },
        { key: "type", label: "Type" },
        { key: "label", label: "Name" },
        { key: "detail", label: "Span / Type" },
      ],
    },
    {
      id: "tcs",
      label: `TCS (${sb.tcs_stretches?.length ?? 0})`,
      rows: sb.tcs_stretches ?? [],
      columns: [
        { key: "from_km", label: "From", suffix: " km" },
        { key: "to_km", label: "To", suffix: " km" },
        { key: "tcs", label: "TCS" },
        { key: "description", label: "Description" },
      ],
    },
    {
      id: "underpasses",
      label: `Underpasses (${sb.underpasses?.length ?? 0})`,
      rows: sb.underpasses ?? [],
      columns: [
        { key: "chainage_km", label: "Chainage", suffix: " km" },
        { key: "span_arrangement", label: "Span" },
        { key: "vertical_clearance_m", label: "V. Clr", suffix: " m" },
        { key: "superstructure_type", label: "Superstructure" },
        { key: "remarks", label: "Remarks" },
      ],
    },
    {
      id: "overpasses",
      label: `Overpasses (${sb.overpasses?.length ?? 0})`,
      rows: sb.overpasses ?? [],
      columns: [
        { key: "chainage_km", label: "Chainage", suffix: " km" },
        { key: "span_arrangement", label: "Span" },
        { key: "vertical_clearance_m", label: "V. Clr", suffix: " m" },
        { key: "superstructure_type", label: "Superstructure" },
        { key: "remarks", label: "Remarks" },
      ],
    },
    {
      id: "interchanges",
      label: `Interchanges (${sb.interchanges?.length ?? 0})`,
      rows: sb.interchanges ?? [],
      columns: [
        { key: "chainage_km", label: "Chainage", suffix: " km" },
        { key: "name", label: "Name" },
        { key: "span_arrangement", label: "Span" },
        { key: "tcs", label: "TCS" },
      ],
    },
    {
      id: "ramps",
      label: `Ramps (${sb.interchange_ramps?.length ?? 0})`,
      rows: sb.interchange_ramps ?? [],
      columns: [
        { key: "interchange", label: "Interchange" },
        { key: "from_km", label: "From", suffix: " km" },
        { key: "to_km", label: "To", suffix: " km" },
        { key: "carriageway_width_m", label: "Width", suffix: " m" },
        { key: "description", label: "Description" },
      ],
    },
    {
      id: "elevated",
      label: `Elevated (${sb.elevated?.length ?? 0})`,
      rows: sb.elevated ?? [],
      columns: [
        { key: "from_km", label: "From", suffix: " km" },
        { key: "to_km", label: "To", suffix: " km" },
        { key: "length_m", label: "Length", suffix: " m" },
        { key: "span_arrangement", label: "Span" },
        { key: "vertical_clearance_m", label: "V. Clr", suffix: " m" },
      ],
    },
    {
      id: "culverts",
      label: `Culverts (${sb.culverts?.length ?? 0})`,
      rows: sb.culverts ?? [],
      columns: [
        { key: "chainage_km", label: "Chainage", suffix: " km" },
        { key: "span_arrangement", label: "Span" },
        { key: "type", label: "Type" },
        { key: "remarks", label: "Remarks" },
      ],
    },
    {
      id: "re_walls",
      label: `RE Walls (${sb.re_walls?.length ?? 0})`,
      rows: sb.re_walls ?? [],
      columns: [
        { key: "from_km", label: "From", suffix: " km" },
        { key: "to_km", label: "To", suffix: " km" },
        { key: "lhs_length_km", label: "LHS", suffix: " km" },
        { key: "rhs_length_km", label: "RHS", suffix: " km" },
        { key: "total_length_km", label: "Total", suffix: " km" },
      ],
    },
    {
      id: "drains",
      label: `Drains (${sb.drains?.length ?? 0})`,
      rows: sb.drains ?? [],
      columns: [
        { key: "from_km", label: "From", suffix: " km" },
        { key: "to_km", label: "To", suffix: " km" },
        { key: "width", label: "Size" },
        { key: "total_length_km", label: "Total", suffix: " km" },
      ],
    },
    {
      id: "service_roads",
      label: `Service Roads (${sb.service_roads?.length ?? 0})`,
      rows: sb.service_roads ?? [],
      columns: [
        { key: "from_km", label: "From", suffix: " km" },
        { key: "to_km", label: "To", suffix: " km" },
        { key: "carriageway_width", label: "Width" },
        { key: "total_length_km", label: "Total", suffix: " km" },
        { key: "remarks", label: "Remarks" },
      ],
    },
    {
      id: "paved_shoulders",
      label: `Paved Shoulders (${sb.paved_shoulders?.length ?? 0})`,
      rows: sb.paved_shoulders ?? [],
      columns: [
        { key: "from_km", label: "From", suffix: " km" },
        { key: "to_km", label: "To", suffix: " km" },
        { key: "length_km", label: "Length", suffix: " km" },
        { key: "shoulder_type", label: "Type" },
        { key: "tcs_ref", label: "TCS Ref" },
      ],
    },
  ].filter((t) => t.rows.length > 0);

  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Schedule-B · Engineering Register</h3>
        <span className="text-[11px] text-slate-500">{sb.source_file}</span>
      </div>

      {tabs.length === 0 ? (
        <p className="text-sm text-slate-400">No Schedule-B rows in this section window.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                  current?.id === t.id
                    ? "bg-brand-500/20 text-brand-300 ring-1 ring-brand-400/40"
                    : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {current && (
            <div className="max-h-96 overflow-auto rounded-lg border border-white/5">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-ink-900/95 text-slate-400">
                  <tr>
                    {current.columns.map((c) => (
                      <th key={c.key} className="whitespace-nowrap px-3 py-2 font-semibold">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {current.rows.map((row, i) => (
                    <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                      {current.columns.map((c, ci) => {
                        const raw = row[c.key];
                        const text =
                          raw == null || raw === "" || String(raw) === "null"
                            ? "—"
                            : cell(raw) + (c.suffix && raw != null ? c.suffix : "");
                        return (
                          <td
                            key={c.key}
                            className={`px-3 py-1.5 align-top ${
                              ci === 0
                                ? "whitespace-nowrap font-medium text-brand-400"
                                : "text-slate-300"
                            } ${
                              c.label === "Description" ||
                              c.label === "Remarks" ||
                              c.label === "Name" ||
                              c.label === "Interchange"
                                ? "min-w-[140px]"
                                : "whitespace-nowrap"
                            }`}
                          >
                            {ci === 0 ? cell(raw) + (c.suffix ?? "") : text}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GeotechSection({ geotech }: { geotech: GeotechData }) {
  const withData = geotech.boreholes.filter((b) => b.layers.length > 0);
  const [activeId, setActiveId] = useState(withData[0]?.id ?? "");
  const current = withData.find((b) => b.id === activeId) ?? withData[0];
  const cols = geotech.columns.length
    ? geotech.columns
    : Object.keys(current?.layers[0] ?? {});

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Geotechnical · Boreholes & Soil Tests</h3>
        <span className="text-[11px] text-slate-500">
          {geotech.count} boreholes · {geotech.detailed_count} with soil-test detail
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Site investigation borehole logs. Select a location to view its layer-wise soil-test summary.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {withData.map((b) => (
          <button
            key={b.id}
            onClick={() => setActiveId(b.id)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
              current?.id === b.id
                ? "bg-brand-500/20 text-brand-300 ring-1 ring-brand-400/40"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            {b.id}
          </button>
        ))}
      </div>

      {current && (
        <>
          <div className="mb-2 text-[11px] text-slate-500">
            {current.name}
            {current.lat != null && current.lon != null && (
              <span className="ml-2">
                {current.lat.toFixed(6)}, {current.lon.toFixed(6)}
              </span>
            )}
          </div>
          <div className="max-h-96 overflow-auto rounded-lg border border-white/5">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-ink-900/95 text-slate-400">
                <tr>
                  {cols.map((c) => (
                    <th key={c} className="whitespace-nowrap px-2.5 py-2 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {current.layers.map((row, i) => (
                  <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                    {cols.map((c, ci) => (
                      <td
                        key={c}
                        className={`px-2.5 py-1.5 align-top ${
                          ci === 0
                            ? "whitespace-nowrap font-medium text-brand-400"
                            : c === "Remarks"
                              ? "min-w-[160px]"
                              : "whitespace-nowrap"
                        }`}
                      >
                        {cell(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
