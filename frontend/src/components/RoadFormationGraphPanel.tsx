import { useEffect, useMemo, useRef, useState } from "react";
import {
  ROAD_FORMATION_BRANCH_COLORS,
  type RoadFormationData,
  type RoadFormationPoint,
} from "../lib/roadFormation";
import type { DesignHflPoint, ElevationPoint } from "./ElevationGraphModal";

export type RoadFormationScrubSample = {
  chainage: number;
  index: number;
  points: Array<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    formationLevelM: number | null;
  }>;
};

export type RoadFormationSeriesVisibility = {
  lhs: boolean;
  centerline: boolean;
  rhs: boolean;
  /** Ground elevation series (when provided). Default true. */
  elevation?: boolean;
  /** Design HFL series (when provided). Default true. */
  hfl?: boolean;
};

export const DEFAULT_ROAD_FORMATION_VISIBILITY: RoadFormationSeriesVisibility = {
  lhs: true,
  centerline: false,
  rhs: false,
  elevation: true,
  hfl: true,
};

type BranchId = "lhs" | "centerline" | "rhs";

const ELEV_BRANCH_COLORS: Record<BranchId, string> = {
  lhs: "#3b82f6",
  centerline: "#12c9b0",
  rhs: "#f59e0b",
};

const ELEV_BRANCH_LABELS: Record<BranchId, string> = {
  lhs: "Elev LHS",
  centerline: "Elev Centre",
  rhs: "Elev RHS",
};

const HFL_COLOR = "#38bdf8";
const BRANCH_ORDER: BranchId[] = ["lhs", "centerline", "rhs"];

type Props = {
  data: RoadFormationData;
  /** Ground elevation points — mixed into this graph when provided. */
  elevationPoints?: ElevationPoint[];
  /** Design HFL points — mixed into this graph when provided. */
  hflPoints?: DesignHflPoint[];
  onClose: () => void;
  /** Fired as the scrubber moves — used to highlight the point on the map. */
  onScrub?: (sample: RoadFormationScrubSample | null) => void;
  visibility?: RoadFormationSeriesVisibility;
  onVisibilityChange?: (next: RoadFormationSeriesVisibility) => void;
};

function nearestFormation(points: RoadFormationPoint[], chainage: number) {
  if (!points.length) return undefined;
  let lo = 0;
  let hi = points.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].chainage_km < chainage) lo = mid + 1;
    else hi = mid - 1;
  }
  const a = points[Math.max(0, hi)];
  const b = points[Math.min(points.length - 1, lo)];
  return Math.abs(a.chainage_km - chainage) <= Math.abs(b.chainage_km - chainage)
    ? a
    : b;
}

function nearestElev(points: ElevationPoint[], chainage: number) {
  if (!points.length) return undefined;
  let lo = 0;
  let hi = points.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].chainage < chainage) lo = mid + 1;
    else hi = mid - 1;
  }
  const a = points[Math.max(0, hi)];
  const b = points[Math.min(points.length - 1, lo)];
  return Math.abs(a.chainage - chainage) <= Math.abs(b.chainage - chainage) ? a : b;
}

export default function RoadFormationGraphPanel({
  data,
  elevationPoints = [],
  hflPoints = [],
  onClose,
  onScrub,
  visibility: visibilityProp,
  onVisibilityChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;
  const draggingRef = useRef(false);

  const [internalVisibility, setInternalVisibility] =
    useState<RoadFormationSeriesVisibility>(DEFAULT_ROAD_FORMATION_VISIBILITY);
  const visibility = visibilityProp ?? internalVisibility;
  const setVisibility = (next: RoadFormationSeriesVisibility) => {
    if (visibilityProp == null) setInternalVisibility(next);
    onVisibilityChange?.(next);
  };

  const showElevation = visibility.elevation !== false;
  const showHfl = visibility.hfl !== false;

  const toggleBranch = (branch: BranchId) => {
    const othersOn =
      (branch !== "lhs" && visibility.lhs) ||
      (branch !== "centerline" && visibility.centerline) ||
      (branch !== "rhs" && visibility.rhs);
    if (visibility[branch] && !othersOn) {
      setVisibility({ ...visibility, lhs: true, centerline: true, rhs: true });
    } else {
      setVisibility({
        ...visibility,
        lhs: branch === "lhs",
        centerline: branch === "centerline",
        rhs: branch === "rhs",
      });
    }
  };

  const branches = useMemo(
    () =>
      data.branches.map((branch) => ({
        ...branch,
        points: branch.points
          .filter((p) => p.formation_level_m != null)
          .slice()
          .sort((a, b) => a.chainage_km - b.chainage_km),
      })),
    [data],
  );

  const elevSeries = useMemo(() => {
    if (!elevationPoints.length) return [];
    const byBranch = new Map<BranchId, ElevationPoint[]>();
    for (const p of elevationPoints) {
      const id = (p.branch ?? "centerline") as BranchId;
      if (!BRANCH_ORDER.includes(id)) continue;
      const list = byBranch.get(id) ?? [];
      list.push({
        ...p,
        chainage: Number(p.chainage),
        elevation: Number(p.elevation),
      });
      byBranch.set(id, list);
    }
    return BRANCH_ORDER.map((id) => {
      const pts = (byBranch.get(id) ?? [])
        .filter((p) => !Number.isNaN(p.chainage) && !Number.isNaN(p.elevation))
        .sort((a, b) => a.chainage - b.chainage);
      if (pts.length < 2) return null;
      return { id, points: pts, color: ELEV_BRANCH_COLORS[id], label: ELEV_BRANCH_LABELS[id] };
    }).filter((s): s is NonNullable<typeof s> => s != null);
  }, [elevationPoints]);

  const normalizedHfl = useMemo(() => {
    if (!hflPoints.length) return [];
    return [...hflPoints]
      .map((p) => ({
        chainage_km: Number(p.chainage_km),
        design_hfl_continuous_m: Number(p.design_hfl_continuous_m),
      }))
      .filter(
        (p) =>
          !Number.isNaN(p.chainage_km) && !Number.isNaN(p.design_hfl_continuous_m),
      )
      .sort((a, b) => a.chainage_km - b.chainage_km);
  }, [hflPoints]);

  const hasElevation = elevSeries.length > 0;
  const hasHfl = normalizedHfl.length > 1;

  const centerline =
    branches.find((b) => b.id === "centerline")?.points ??
    branches.find((b) => b.id === "rhs")?.points ??
    [];
  const n = centerline.length;

  const chMin = centerline[0]?.chainage_km ?? data.from_km ?? 0;
  const chMax = centerline[n - 1]?.chainage_km ?? data.to_km ?? chMin + 1;

  const visibleBranches = branches.filter(
    (b) => visibility[b.id as BranchId] !== false,
  );
  const visibleElev = showElevation
    ? elevSeries.filter((s) => visibility[s.id] !== false)
    : [];

  const scaleVals = [
    ...visibleBranches.flatMap((b) =>
      b.points.map((p) => p.formation_level_m as number),
    ),
    ...visibleElev.flatMap((s) => s.points.map((p) => p.elevation)),
    ...(showHfl && hasHfl
      ? normalizedHfl.map((p) => p.design_hfl_continuous_m)
      : []),
  ];
  const rawMinY = scaleVals.length
    ? Math.min(...scaleVals)
    : (data.formation_min_m ?? 0);
  const rawMaxY = scaleVals.length
    ? Math.max(...scaleVals)
    : (data.formation_max_m ?? rawMinY + 1);
  const yPad = Math.max(0.5, (rawMaxY - rawMinY) * 0.08);
  const minY = rawMinY - yPad;
  const maxY = rawMaxY + yPad;

  const [scrubIndex, setScrubIndex] = useState(() => Math.floor(n / 2));

  const width = 1400;
  const height = 160;
  const left = 56;
  const right = 14;
  const top = 10;
  const bottom = 25;
  const plotW = width - left - right;
  const xAtChainage = (ch: number) =>
    left + ((ch - chMin) / Math.max(1e-9, chMax - chMin)) * plotW;
  const y = (value: number) =>
    top + ((maxY - value) / Math.max(1e-9, maxY - minY)) * (height - top - bottom);

  const clampedIndex = Math.max(0, Math.min(Math.max(0, n - 1), scrubIndex));
  const chainage = centerline[clampedIndex]?.chainage_km ?? chMin;
  const scrubX = xAtChainage(chainage);

  const sample = branches.map((branch) => ({
    branch,
    point: nearestFormation(branch.points, chainage),
  }));

  const elevSample = elevSeries.map((s) => ({
    series: s,
    point: nearestElev(s.points, chainage),
  }));

  const hflSample =
    hasHfl && showHfl
      ? nearestElev(
          normalizedHfl.map((p) => ({
            chainage: p.chainage_km,
            elevation: p.design_hfl_continuous_m,
          })),
          chainage,
        )
      : undefined;

  const isVisible = (id: string) => visibility[id as BranchId] !== false;

  const emitScrub = (index: number) => {
    const idx = Math.max(0, Math.min(Math.max(0, n - 1), index));
    const ch = centerline[idx]?.chainage_km ?? chainage;
    const points = branches
      .filter((branch) => isVisible(branch.id))
      .map((branch) => {
        const point = nearestFormation(branch.points, ch);
        if (!point) return null;
        return {
          id: branch.id,
          name: branch.name,
          lat: point.lat,
          lon: point.lon,
          formationLevelM: point.formation_level_m ?? null,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);
    onScrubRef.current?.(points.length ? { chainage: ch, index: idx, points } : null);
  };

  useEffect(() => {
    emitScrub(clampedIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedIndex, branches, visibility]);

  useEffect(() => () => onScrubRef.current?.(null), []);

  const indexFromClientX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || n < 2) return clampedIndex;
    const rect = svg.getBoundingClientRect();
    const localX = ((clientX - rect.left) / Math.max(1, rect.width)) * width;
    const t = (localX - left) / Math.max(1, plotW);
    const rawCh = chMin + Math.max(0, Math.min(1, t)) * (chMax - chMin);
    const nearest = nearestFormation(centerline, rawCh);
    if (!nearest) return clampedIndex;
    const idx = centerline.findIndex((p) => p === nearest);
    return idx >= 0 ? idx : clampedIndex;
  };

  const applyIndex = (index: number) => {
    const idx = Math.max(0, Math.min(n - 1, index));
    setScrubIndex((prev) => (prev === idx ? prev : idx));
  };

  const xTicks = useMemo(() => {
    if (n < 2) return [];
    const count = Math.min(18, n);
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.round((i / Math.max(1, count - 1)) * (n - 1));
      return { ch: centerline[idx]?.chainage_km ?? 0 };
    });
  }, [centerline, n]);

  const yTicks = [rawMinY, (rawMinY + rawMaxY) / 2, rawMaxY];

  const soloOutline = (id: BranchId) => {
    const on = visibility[id];
    const othersOff =
      (id === "lhs" || !visibility.lhs) &&
      (id === "centerline" || !visibility.centerline) &&
      (id === "rhs" || !visibility.rhs);
    return on && othersOff;
  };

  return (
    <div
      className="max-h-[42vh] shrink-0 overflow-hidden border-t border-amber-400/20 bg-ink-900/95 backdrop-blur-xl"
      role="region"
      aria-label="Road formation level profile"
    >
      <div className="px-3 py-1.5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            <h3 className="text-[11px] font-bold text-white">
              {hasElevation
                ? "Road Formation + Elevation Profile"
                : "Road Formation Level Profile"}
            </h3>
            <span className="text-slate-400">
              Ch {data.from_km?.toFixed(2) ?? "—"}–{data.to_km?.toFixed(2) ?? "—"} km
            </span>

            {/* Line-style key: what each stroke pattern means */}
            {hasElevation && (
              <span className="inline-flex items-center gap-1 text-slate-300">
                <svg width="20" height="8" aria-hidden>
                  <line x1="0" y1="4" x2="20" y2="4" stroke="#e2e8f0" strokeWidth="2" />
                </svg>
                Ground elevation
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-slate-300">
              <svg width="20" height="8" aria-hidden>
                <line
                  x1="0"
                  y1="4"
                  x2="20"
                  y2="4"
                  stroke="#e2e8f0"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                />
              </svg>
              Road formation
            </span>
            {hasHfl && (
              <span className="inline-flex items-center gap-1 text-slate-300">
                <svg width="20" height="8" aria-hidden>
                  <line
                    x1="0"
                    y1="4"
                    x2="20"
                    y2="4"
                    stroke={HFL_COLOR}
                    strokeWidth="2"
                    strokeDasharray="2 3"
                  />
                </svg>
                Design HFL
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {hasElevation && (
              <button
                type="button"
                onClick={() =>
                  setVisibility({ ...visibility, elevation: !showElevation })
                }
                aria-pressed={showElevation}
                title={showElevation ? "Hide ground elevation" : "Show ground elevation"}
                className="rounded border border-white/15 px-2 py-0.5 text-[10px] text-slate-200 transition hover:bg-white/10"
                style={{ opacity: showElevation ? 1 : 0.4 }}
              >
                Elevation
              </button>
            )}
            {hasHfl && (
              <button
                type="button"
                onClick={() => setVisibility({ ...visibility, hfl: !showHfl })}
                aria-pressed={showHfl}
                title={showHfl ? "Hide Design HFL" : "Show Design HFL"}
                className="rounded border border-white/15 px-2 py-0.5 text-[10px] transition hover:bg-white/10"
                style={{ color: HFL_COLOR, opacity: showHfl ? 1 : 0.4 }}
              >
                HFL
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-white/10"
            >
              Hide
            </button>
          </div>
        </div>

        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded bg-white/10 px-2 py-0.5 font-semibold text-white">
            Ch {chainage.toFixed(3)} km
          </span>
          {BRANCH_ORDER.map((id) => {
            const branch = branches.find((b) => (b.id as BranchId) === id);
            if (!branch) return null;
            const on = isVisible(id);
            const formColor = ROAD_FORMATION_BRANCH_COLORS[id] ?? "#f59e0b";
            const elevColor = ELEV_BRANCH_COLORS[id];
            const formPoint = sample.find(({ branch: b }) => (b.id as BranchId) === id)
              ?.point;
            const elevPoint = elevSample.find(({ series }) => series.id === id)?.point;
            const shortName = branch.name.replace(" 30M", "").replace("30M ", "");
            return (
              <button
                key={`grp-${id}`}
                type="button"
                onClick={() => toggleBranch(id)}
                aria-pressed={on}
                title={
                  on
                    ? `Show only ${shortName} (click again for all branches)`
                    : `Show ${shortName}`
                }
                className="flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-semibold transition hover:bg-white/5"
                style={{
                  borderColor: soloOutline(id) ? "#ffffff55" : "#ffffff18",
                  opacity: on ? 1 : 0.35,
                }}
              >
                <span className="text-slate-200">{shortName}</span>
                {hasElevation && (
                  <span className="inline-flex items-center gap-1" style={{ color: elevColor }}>
                    <span className="h-0.5 w-2.5 rounded" style={{ background: elevColor }} />
                    {elevPoint != null ? `${elevPoint.elevation.toFixed(2)} m` : "—"}
                  </span>
                )}
                <span className="inline-flex items-center gap-1" style={{ color: formColor }}>
                  <span
                    className="h-0.5 w-2.5 rounded border-t border-dashed"
                    style={{ borderColor: formColor, background: formColor }}
                  />
                  {formPoint?.formation_level_m != null
                    ? `${formPoint.formation_level_m.toFixed(2)} m`
                    : "—"}
                </span>
              </button>
            );
          })}
          {hflSample && (
            <button
              type="button"
              onClick={() => setVisibility({ ...visibility, hfl: !showHfl })}
              title={showHfl ? "Hide Design HFL" : "Show Design HFL"}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-semibold transition hover:bg-white/5"
              style={{
                borderColor: "#ffffff18",
                color: HFL_COLOR,
                opacity: showHfl ? 1 : 0.35,
              }}
            >
              <span
                className="h-0.5 w-2.5 rounded"
                style={{ background: HFL_COLOR }}
              />
              HFL {hflSample.elevation.toFixed(2)} m
            </button>
          )}
        </div>

        <div className="w-full overflow-hidden rounded bg-ink-950">
          <svg
            ref={svgRef}
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="block cursor-crosshair select-none touch-none"
            onPointerDown={(event) => {
              draggingRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              applyIndex(indexFromClientX(event.clientX));
            }}
            onPointerMove={(event) => {
              if (!draggingRef.current && event.buttons !== 1) return;
              applyIndex(indexFromClientX(event.clientX));
            }}
            onPointerUp={() => {
              draggingRef.current = false;
            }}
            onPointerCancel={() => {
              draggingRef.current = false;
            }}
          >
            {xTicks.map((tick) => (
              <g key={`xt-${tick.ch}`}>
                <line
                  x1={xAtChainage(tick.ch)}
                  y1={top}
                  x2={xAtChainage(tick.ch)}
                  y2={height - bottom}
                  stroke="#334155"
                  strokeWidth={0.5}
                  strokeDasharray="2 4"
                />
                <text
                  x={xAtChainage(tick.ch)}
                  y={height - 8}
                  fill="#94a3b8"
                  fontSize={8}
                  textAnchor="middle"
                >
                  {tick.ch.toFixed(2)} km
                </text>
              </g>
            ))}
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={left}
                  y1={y(tick)}
                  x2={width - right}
                  y2={y(tick)}
                  stroke="#334155"
                  strokeWidth={0.5}
                  strokeDasharray="2 4"
                />
                <text
                  x={left - 7}
                  y={y(tick) + 3}
                  fill="#94a3b8"
                  fontSize={8}
                  textAnchor="end"
                >
                  {tick.toFixed(1)} m
                </text>
              </g>
            ))}

            {/* Ground elevation (solid) */}
            {visibleElev.map((s) => (
              <polyline
                key={`elev-${s.id}`}
                fill="none"
                stroke={s.color}
                strokeWidth={s.id === "centerline" ? 2.25 : 1.75}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={s.points
                  .map((p) => `${xAtChainage(p.chainage)},${y(p.elevation)}`)
                  .join(" ")}
              />
            ))}

            {/* Road formation (dashed) */}
            {visibleBranches.map((branch) => (
              <polyline
                key={`form-${branch.id}`}
                fill="none"
                stroke={ROAD_FORMATION_BRANCH_COLORS[branch.id] ?? "#f59e0b"}
                strokeWidth={branch.id === "centerline" ? 2.5 : 2}
                strokeDasharray="5 3"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={branch.points
                  .map(
                    (point) =>
                      `${xAtChainage(point.chainage_km)},${y(point.formation_level_m as number)}`,
                  )
                  .join(" ")}
              />
            ))}

            {/* Water fill below the Design HFL line — underwater effect */}
            {showHfl && hasHfl && (
              <>
                <defs>
                  <linearGradient id="hfl-water-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={HFL_COLOR} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={HFL_COLOR} stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <polygon
                  fill="url(#hfl-water-fill)"
                  stroke="none"
                  points={[
                    ...normalizedHfl.map(
                      (p) =>
                        `${xAtChainage(p.chainage_km)},${y(p.design_hfl_continuous_m)}`,
                    ),
                    `${xAtChainage(normalizedHfl[normalizedHfl.length - 1].chainage_km)},${height - bottom}`,
                    `${xAtChainage(normalizedHfl[0].chainage_km)},${height - bottom}`,
                  ].join(" ")}
                />
              </>
            )}

            {/* Design HFL (dotted) */}
            {showHfl && hasHfl && (
              <polyline
                fill="none"
                stroke={HFL_COLOR}
                strokeWidth={2}
                strokeDasharray="2 3"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={normalizedHfl
                  .map(
                    (p) =>
                      `${xAtChainage(p.chainage_km)},${y(p.design_hfl_continuous_m)}`,
                  )
                  .join(" ")}
              />
            )}

            <line
              x1={scrubX}
              y1={top}
              x2={scrubX}
              y2={height - bottom}
              stroke="#fff"
              strokeWidth={1}
              strokeDasharray="3 3"
            />

            {sample.map(({ branch, point }) =>
              isVisible(branch.id) && point?.formation_level_m != null ? (
                <circle
                  key={`form-dot-${branch.id}`}
                  cx={scrubX}
                  cy={y(point.formation_level_m)}
                  r={3.5}
                  fill={ROAD_FORMATION_BRANCH_COLORS[branch.id] ?? "#f59e0b"}
                  stroke="#fff"
                  strokeWidth={1.25}
                />
              ) : null,
            )}
            {showElevation &&
              elevSample.map(({ series: s, point }) =>
                isVisible(s.id) && point != null ? (
                  <circle
                    key={`elev-dot-${s.id}`}
                    cx={scrubX}
                    cy={y(point.elevation)}
                    r={3.5}
                    fill={s.color}
                    stroke="#fff"
                    strokeWidth={1.25}
                  />
                ) : null,
              )}
            {hflSample && showHfl && (
              <circle
                cx={scrubX}
                cy={y(hflSample.elevation)}
                r={3.5}
                fill={HFL_COLOR}
                stroke="#fff"
                strokeWidth={1.25}
              />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
