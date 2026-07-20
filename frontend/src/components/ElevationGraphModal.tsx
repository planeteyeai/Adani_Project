import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { downloadElevationKml } from "../lib/elevationKml";
import { downloadElevationExcel } from "../lib/elevationExcel";

export type ElevationPoint = {
  chainage: number;
  elevation: number;
  latitude?: number;
  longitude?: number;
  distance?: number;
  trees?: number;
  /** Alignment branch when survey provides parallel profiles (lhs / centerline / rhs). */
  branch?: "lhs" | "centerline" | "rhs" | string;
};

export type ElevationScrubSample = {
  chainage: number;
  lhs?: ElevationPoint;
  centerline?: ElevationPoint;
  rhs?: ElevationPoint;
  hfl?: { chainage_km: number; design_hfl_continuous_m: number };
  /** True while the user is actively dragging the scrubber. */
  dragging?: boolean;
};

/** Which elevation / HFL series are drawn on the graph and map. */
export type ElevationSeriesVisibility = {
  lhs: boolean;
  centerline: boolean;
  rhs: boolean;
  hfl: boolean;
};

export const DEFAULT_ELEVATION_VISIBILITY: ElevationSeriesVisibility = {
  lhs: true,
  centerline: true,
  rhs: true,
  hfl: true,
};

export type DesignHflPoint = {
  id: number;
  chainage_km: number;
  latitude: number;
  longitude: number;
  design_hfl_continuous_m: number;
};

type Props = {
  points: ElevationPoint[];
  hflPoints?: DesignHflPoint[];
  onClose: () => void;
  onPointClick?: (point: ElevationPoint) => void;
  /** Fired while the vertical scrubber moves — used to sync the map cross-section. */
  onScrub?: (sample: ElevationScrubSample) => void;
  /** Fired when LHS / Centre / RHS / Design HFL visibility chips are toggled. */
  visibility?: ElevationSeriesVisibility;
  onVisibilityChange?: (next: ElevationSeriesVisibility) => void;
  projectName?: string;
  exportPoints?: ElevationPoint[];
};

const BRANCH_STYLES: Record<string, { label: string; color: string }> = {
  lhs: { label: "LHS (30 m)", color: "#3b82f6" },
  centerline: { label: "Centre line", color: "#12c9b0" },
  rhs: { label: "RHS (30 m)", color: "#f59e0b" },
};

const BRANCH_ORDER = ["lhs", "centerline", "rhs"] as const;

function branchKey(p: ElevationPoint): string {
  return p.branch ?? "centerline";
}

/** Binary search nearest point on a chainage-sorted array. */
function nearestPoint(pts: ElevationPoint[], chainage: number): ElevationPoint | undefined {
  if (!pts.length) return undefined;
  let lo = 0;
  let hi = pts.length - 1;
  if (chainage <= pts[0].chainage) return pts[0];
  if (chainage >= pts[hi].chainage) return pts[hi];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = pts[mid].chainage;
    if (c === chainage) return pts[mid];
    if (c < chainage) lo = mid + 1;
    else hi = mid - 1;
  }
  const a = pts[Math.max(0, hi)];
  const b = pts[Math.min(pts.length - 1, lo)];
  return Math.abs(a.chainage - chainage) <= Math.abs(b.chainage - chainage) ? a : b;
}

const HFL_COLOR = "#38bdf8";

/** Chainage vs ground elevation profile with a draggable vertical scrubber. */
export default function ElevationGraphModal({
  points,
  hflPoints = [],
  onClose,
  onPointClick,
  onScrub,
  visibility: visibilityProp,
  onVisibilityChange,
  projectName,
  exportPoints,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const pendingXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const scrubChainageRef = useRef<number | null>(null);

  const [internalVisibility, setInternalVisibility] = useState<ElevationSeriesVisibility>(
    DEFAULT_ELEVATION_VISIBILITY,
  );
  const visibility = visibilityProp ?? internalVisibility;
  const setVisibility = (next: ElevationSeriesVisibility) => {
    if (visibilityProp == null) setInternalVisibility(next);
    onVisibilityChange?.(next);
  };

  const toggleBranch = (branch: "lhs" | "centerline" | "rhs") => {
    const othersOn =
      (branch !== "lhs" && visibility.lhs) ||
      (branch !== "centerline" && visibility.centerline) ||
      (branch !== "rhs" && visibility.rhs);
    // Click a branch → show only that branch (+ HFL). Click again when solo → restore all.
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

  const toggleHfl = () => setVisibility({ ...visibility, hfl: !visibility.hfl });

  const normalized = useMemo(() => {
    if (!points?.length) return [];
    return points
      .map((p) => ({
        chainage: Number(p.chainage),
        elevation: Number(p.elevation),
        latitude: p.latitude,
        longitude: p.longitude,
        distance: p.distance,
        trees: p.trees,
        branch: branchKey(p),
      }))
      .filter((p) => !Number.isNaN(p.chainage) && !Number.isNaN(p.elevation))
      .sort((a, b) => a.chainage - b.chainage || a.branch.localeCompare(b.branch));
  }, [points]);

  const normalizedHfl = useMemo(() => {
    if (!hflPoints?.length) return [];
    return [...hflPoints]
      .map((p) => ({
        chainage_km: Number(p.chainage_km),
        design_hfl_continuous_m: Number(p.design_hfl_continuous_m),
        latitude: p.latitude,
        longitude: p.longitude,
        id: p.id,
      }))
      .filter(
        (p) => !Number.isNaN(p.chainage_km) && !Number.isNaN(p.design_hfl_continuous_m),
      )
      .sort((a, b) => a.chainage_km - b.chainage_km);
  }, [hflPoints]);

  const series = useMemo(() => {
    const byBranch = new Map<string, typeof normalized>();
    for (const p of normalized) {
      const list = byBranch.get(p.branch) ?? [];
      list.push(p);
      byBranch.set(p.branch, list);
    }
    return BRANCH_ORDER.filter((b) => (byBranch.get(b)?.length ?? 0) > 1).map((b) => ({
      branch: b,
      ...BRANCH_STYLES[b],
      points: (byBranch.get(b) ?? []).sort((a, c) => a.chainage - c.chainage),
    }));
  }, [normalized]);

  // Scrubber X is driven only by centreline chainage; LHS/RHS are elevation readouts at that Ch.
  const centerlinePts = series.find((s) => s.branch === "centerline")?.points ?? [];
  const lhsPts = series.find((s) => s.branch === "lhs")?.points ?? [];
  const rhsPts = series.find((s) => s.branch === "rhs")?.points ?? [];

  const minX = centerlinePts.length
    ? centerlinePts[0].chainage
    : normalized.length
      ? Math.min(...normalized.map((p) => p.chainage))
      : 0;
  const maxX = centerlinePts.length
    ? centerlinePts[centerlinePts.length - 1].chainage
    : normalized.length
      ? Math.max(...normalized.map((p) => p.chainage))
      : 1;

  const [scrubChainage, setScrubChainage] = useState<number | null>(null);
  scrubChainageRef.current = scrubChainage;

  useEffect(() => {
    if (!centerlinePts.length) return;
    setScrubChainage((prev) => {
      if (prev != null) {
        const snap = nearestPoint(centerlinePts, prev);
        if (snap) return snap.chainage;
      }
      return centerlinePts[Math.floor(centerlinePts.length / 2)]?.chainage ?? minX;
    });
  }, [centerlinePts, minX, maxX]);

  const buildSample = (ch: number, dragging: boolean): ElevationScrubSample | null => {
    const center = nearestPoint(centerlinePts, ch);
    if (!center) return null;
    const hfl = nearestPoint(
      normalizedHfl.map((p) => ({
        chainage: p.chainage_km,
        elevation: p.design_hfl_continuous_m,
      })),
      center.chainage,
    );
    return {
      chainage: center.chainage,
      centerline: center,
      lhs: nearestPoint(lhsPts, center.chainage),
      rhs: nearestPoint(rhsPts, center.chainage),
      hfl: hfl
        ? { chainage_km: hfl.chainage, design_hfl_continuous_m: hfl.elevation }
        : undefined,
      dragging,
    };
  };

  const sample = useMemo((): ElevationScrubSample | null => {
    if (scrubChainage == null || !centerlinePts.length) return null;
    return buildSample(scrubChainage, draggingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubChainage, centerlinePts, lhsPts, rhsPts]);

  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;
  const onPointClickRef = useRef(onPointClick);
  onPointClickRef.current = onPointClick;

  const width = Math.max(1200, Math.min(Math.max(centerlinePts.length, 200) * 3, 14000));
  const height = 120;
  const paddingLeft = 52;
  const paddingRight = 12;
  const paddingTop = 10;
  const paddingBottom = 22;

  const chainageFromClientX = (clientX: number) => {
    const svg = svgRef.current;
    const fallback = scrubChainageRef.current ?? minX;
    if (!svg) return fallback;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * width;
    const raw =
      minX + ((x - paddingLeft) / Math.max(1, width - paddingLeft - paddingRight)) * (maxX - minX);
    const clamped = Math.max(minX, Math.min(maxX, raw));
    const snap = nearestPoint(centerlinePts, clamped);
    return snap?.chainage ?? clamped;
  };

  const applyScrub = (ch: number, dragging: boolean) => {
    const prev = scrubChainageRef.current;
    if (prev === ch && dragging) return;
    scrubChainageRef.current = ch;
    if (prev !== ch) setScrubChainage(ch);
    const next = buildSample(ch, dragging);
    if (next) onScrubRef.current?.(next);
  };

  const scrubIndex = useMemo(() => {
    if (scrubChainage == null || !centerlinePts.length) return -1;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < centerlinePts.length; i++) {
      const d = Math.abs(centerlinePts[i].chainage - scrubChainage);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }, [scrubChainage, centerlinePts]);

  const canStepLeft = scrubIndex > 0;
  const canStepRight = scrubIndex >= 0 && scrubIndex < centerlinePts.length - 1;

  const scrollScrubberIntoView = (ch: number) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const x =
      paddingLeft +
      ((ch - minX) / Math.max(1e-9, maxX - minX)) * (width - paddingLeft - paddingRight);
    const viewW = scroller.clientWidth;
    const target = x - viewW / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  };

  const stepScrub = (dir: -1 | 1) => {
    if (!centerlinePts.length) return;
    const idx =
      scrubIndex >= 0
        ? scrubIndex
        : Math.floor(centerlinePts.length / 2);
    const nextIdx = Math.max(0, Math.min(centerlinePts.length - 1, idx + dir));
    const next = centerlinePts[nextIdx];
    if (!next) return;
    applyScrub(next.chainage, false);
    onPointClickRef.current?.(next);
    scrollScrubberIntoView(next.chainage);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepScrub(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepScrub(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerlinePts, scrubIndex, minX, maxX, width]);

  const scheduleScrub = (clientX: number) => {
    pendingXRef.current = clientX;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const x = pendingXRef.current;
      if (x == null) return;
      pendingXRef.current = null;
      applyScrub(chainageFromClientX(x), draggingRef.current);
    });
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      scheduleScrub(e.clientX);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const x = pendingXRef.current;
      pendingXRef.current = null;
      const ch =
        x != null ? chainageFromClientX(x) : scrubChainageRef.current ?? minX;
      applyScrub(ch, false);
      const center = nearestPoint(centerlinePts, ch);
      if (center) onPointClickRef.current?.(center);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerlinePts, lhsPts, rhsPts, minX, maxX, width]);

  // One-shot map sync when scrubber first lands on a chainage
  const initSyncedRef = useRef(false);
  useEffect(() => {
    if (scrubChainage == null || initSyncedRef.current) return;
    initSyncedRef.current = true;
    const next = buildSample(scrubChainage, false);
    if (next) onScrubRef.current?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubChainage]);

  if (!normalized.length || scrubChainage == null || !sample) return null;

  const visibleSeries = series.filter((s) => visibility[s.branch as keyof ElevationSeriesVisibility]);
  const showHfl = visibility.hfl && normalizedHfl.length > 0;
  const elevForScale = visibleSeries.flatMap((s) => s.points.map((p) => p.elevation));
  const hflForScale = showHfl
    ? normalizedHfl.map((p) => p.design_hfl_continuous_m)
    : [];
  const scaleVals = elevForScale.length || hflForScale.length
    ? [...elevForScale, ...hflForScale]
    : normalized.map((p) => p.elevation);
  const minY = Math.min(...scaleVals);
  const maxY = Math.max(...scaleVals);
  const avgY =
    elevForScale.length > 0
      ? elevForScale.reduce((sum, v) => sum + v, 0) / elevForScale.length
      : normalized.reduce((sum, p) => sum + p.elevation, 0) / normalized.length;

  const tickPoints =
    centerlinePts.length > 0
      ? centerlinePts.filter(
          (_, i) =>
            i % Math.max(1, Math.floor(centerlinePts.length / 40)) === 0 ||
            i === centerlinePts.length - 1,
        )
      : [];

  const xScale = (x: number) => {
    if (maxX === minX) return paddingLeft;
    return paddingLeft + ((x - minX) / (maxX - minX)) * (width - paddingLeft - paddingRight);
  };

  const yScale = (y: number) => {
    if (maxY === minY) return height - paddingBottom;
    return paddingTop + ((maxY - y) / (maxY - minY)) * (height - paddingTop - paddingBottom);
  };

  const scrubX = xScale(sample.chainage);

  return (
    <div
      className="max-h-[42vh] shrink-0 overflow-hidden border-t border-white/10 bg-ink-900/95 backdrop-blur-xl"
      role="region"
      aria-label="Ground elevation profile"
    >
      <div className="px-3 py-1.5">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0 text-[10px]">
            <h3 className="text-[11px] font-bold text-white">Ground Elevation Profile</h3>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">Survey · 50 m · click chips to filter · drag centreline</span>
            {series.map((s) => {
              const on = visibility[s.branch as "lhs" | "centerline" | "rhs"];
              return (
                <button
                  key={s.branch}
                  type="button"
                  onClick={() => toggleBranch(s.branch as "lhs" | "centerline" | "rhs")}
                  aria-pressed={on}
                  title={on ? `Hide ${s.label} (solo / restore)` : `Show only ${s.label}`}
                  className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-white/5"
                  style={{ opacity: on ? 1 : 0.35 }}
                >
                  <span className="h-0.5 w-3 rounded" style={{ background: s.color }} />
                  <span style={{ color: s.color }}>{s.label}</span>
                </button>
              );
            })}
            {normalizedHfl.length > 0 && (
              <button
                type="button"
                onClick={toggleHfl}
                aria-pressed={visibility.hfl}
                title={visibility.hfl ? "Hide Design HFL" : "Show Design HFL"}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-white/5"
                style={{ opacity: visibility.hfl ? 1 : 0.35 }}
              >
                <span
                  className="h-0.5 w-3 rounded border-t border-dashed"
                  style={{ borderColor: HFL_COLOR, background: HFL_COLOR }}
                />
                <span style={{ color: HFL_COLOR }}>Design HFL (continuous)</span>
              </button>
            )}
            <span className="text-slate-500">·</span>
            <span>
              Min <span className="text-brand-400">{minY.toFixed(0)} m</span>
            </span>
            <span>
              Max <span className="text-brand-400">{maxY.toFixed(0)} m</span>
            </span>
            <span>
              Avg <span className="text-brand-400">{avgY.toFixed(0)} m</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                downloadElevationExcel(
                  exportPoints ?? normalized,
                  "digha_koilwar_ground_elevation.xls",
                  projectName ?? "Digha–Koilwar Ground Elevation"
                )
              }
              className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
              title="Download ground elevation as Excel spreadsheet"
            >
              <Download className="h-3 w-3" />
              Excel
            </button>
            <button
              type="button"
              onClick={() =>
                downloadElevationKml(
                  exportPoints ?? normalized,
                  "digha_koilwar_ground_elevation.kml",
                  projectName ?? "Digha–Koilwar Ground Elevation"
                )
              }
              className="flex items-center gap-1 rounded border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-300 hover:bg-brand-500/20"
              title="Download ground elevation as KML for Google Earth"
            >
              <Download className="h-3 w-3" />
              KML
            </button>
            <button
              onClick={onClose}
              className="shrink-0 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-white/10"
            >
              Hide
            </button>
          </div>
        </div>

        {/* Live scrub readout — position = centreline Ch; heights = LHS / Centre / RHS */}
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => stepScrub(-1)}
              disabled={!canStepLeft}
              title="Previous chainage (←)"
              aria-label="Previous chainage"
              className="grid h-6 w-6 place-items-center rounded border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => stepScrub(1)}
              disabled={!canStepRight}
              title="Next chainage (→)"
              aria-label="Next chainage"
              className="grid h-6 w-6 place-items-center rounded border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="rounded bg-white/10 px-2 py-0.5 font-semibold text-white">
            Centre Ch {sample.chainage.toFixed(3)} km
          </span>
          <button
            type="button"
            onClick={() => toggleBranch("lhs")}
            aria-pressed={visibility.lhs}
            title={visibility.lhs ? "Show only LHS (click again to show all)" : "Show only LHS"}
            className="rounded px-2 py-0.5 font-semibold transition hover:brightness-125"
            style={{
              background: "#3b82f620",
              color: "#60a5fa",
              opacity: visibility.lhs ? 1 : 0.35,
              outline: visibility.lhs && !visibility.centerline && !visibility.rhs
                ? "1px solid #60a5fa"
                : undefined,
            }}
          >
            LHS {sample.lhs != null ? `${sample.lhs.elevation.toFixed(2)} m` : "—"}
          </button>
          <button
            type="button"
            onClick={() => toggleBranch("centerline")}
            aria-pressed={visibility.centerline}
            title={
              visibility.centerline
                ? "Show only Centre (click again to show all)"
                : "Show only Centre"
            }
            className="rounded px-2 py-0.5 font-semibold transition hover:brightness-125"
            style={{
              background: "#12c9b020",
              color: "#38e1c6",
              opacity: visibility.centerline ? 1 : 0.35,
              outline:
                visibility.centerline && !visibility.lhs && !visibility.rhs
                  ? "1px solid #38e1c6"
                  : undefined,
            }}
          >
            Centre {sample.centerline != null ? `${sample.centerline.elevation.toFixed(2)} m` : "—"}
          </button>
          <button
            type="button"
            onClick={() => toggleBranch("rhs")}
            aria-pressed={visibility.rhs}
            title={visibility.rhs ? "Show only RHS (click again to show all)" : "Show only RHS"}
            className="rounded px-2 py-0.5 font-semibold transition hover:brightness-125"
            style={{
              background: "#f59e0b20",
              color: "#fbbf24",
              opacity: visibility.rhs ? 1 : 0.35,
              outline: visibility.rhs && !visibility.lhs && !visibility.centerline
                ? "1px solid #fbbf24"
                : undefined,
            }}
          >
            RHS {sample.rhs != null ? `${sample.rhs.elevation.toFixed(2)} m` : "—"}
          </button>
          {sample.hfl && (
            <button
              type="button"
              onClick={toggleHfl}
              aria-pressed={visibility.hfl}
              title={visibility.hfl ? "Hide Design HFL" : "Show Design HFL"}
              className="rounded px-2 py-0.5 font-semibold transition hover:brightness-125"
              style={{
                background: "#38bdf820",
                color: "#7dd3fc",
                opacity: visibility.hfl ? 1 : 0.35,
                outline: visibility.hfl ? "1px solid #7dd3fc88" : undefined,
              }}
            >
              Design HFL {sample.hfl.design_hfl_continuous_m.toFixed(2)} m
            </button>
          )}
          <span className="hidden text-slate-500 sm:inline">← → keys</span>
        </div>

        <div ref={scrollRef} className="overflow-x-auto rounded bg-ink-950">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="block select-none"
            onPointerDown={(e) => {
              draggingRef.current = true;
              (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
              scheduleScrub(e.clientX);
            }}
          >
            <line
              x1={paddingLeft}
              y1={height - paddingBottom}
              x2={width - paddingRight}
              y2={height - paddingBottom}
              stroke="#64748b"
              strokeWidth="1"
            />
            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={paddingLeft}
              y2={height - paddingBottom}
              stroke="#64748b"
              strokeWidth="1"
            />

            {tickPoints.map((p, idx) => {
              const xPos = xScale(p.chainage);
              return (
                <g key={`xtick-${idx}`}>
                  <line
                    x1={xPos}
                    y1={paddingTop}
                    x2={xPos}
                    y2={height - paddingBottom}
                    stroke="#334155"
                    strokeWidth="0.5"
                    strokeDasharray="2,4"
                  />
                  <line
                    x1={xPos}
                    y1={height - paddingBottom}
                    x2={xPos}
                    y2={height - paddingBottom + 4}
                    stroke="#64748b"
                    strokeWidth="1"
                  />
                  <text
                    x={xPos}
                    y={height - paddingBottom + 12}
                    fill="#94a3b8"
                    fontSize="7"
                    textAnchor="middle"
                  >
                    {p.chainage.toFixed(2)} km
                  </text>
                </g>
              );
            })}

            {[
              { y: minY, label: `${minY.toFixed(1)} m` },
              { y: (minY + maxY) / 2, label: `${((minY + maxY) / 2).toFixed(1)} m` },
              { y: maxY, label: `${maxY.toFixed(1)} m` },
            ].map((tick, idx) => (
              <g key={`ytick-${idx}`}>
                <line
                  x1={paddingLeft}
                  y1={yScale(tick.y)}
                  x2={width - paddingRight}
                  y2={yScale(tick.y)}
                  stroke="#334155"
                  strokeWidth="0.5"
                  strokeDasharray="2,4"
                />
                <line
                  x1={paddingLeft - 4}
                  y1={yScale(tick.y)}
                  x2={paddingLeft}
                  y2={yScale(tick.y)}
                  stroke="#64748b"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={yScale(tick.y) + 2}
                  fill="#94a3b8"
                  fontSize="8"
                  textAnchor="end"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {visibleSeries.map((s) => (
              <polyline
                key={`line-${s.branch}`}
                fill="none"
                stroke={s.color}
                strokeWidth={s.branch === "centerline" ? 2.25 : 1.75}
                strokeOpacity={s.branch === "centerline" ? 1 : 0.95}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={s.points.map((p) => `${xScale(p.chainage)},${yScale(p.elevation)}`).join(" ")}
                style={{ pointerEvents: "none" }}
              />
            ))}

            {showHfl && normalizedHfl.length > 1 && (
              <polyline
                fill="none"
                stroke={HFL_COLOR}
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={normalizedHfl
                  .map((p) => `${xScale(p.chainage_km)},${yScale(p.design_hfl_continuous_m)}`)
                  .join(" ")}
                style={{ pointerEvents: "none" }}
              />
            )}


            {/* Dots sit on the centreline scrubber X; Y = each branch elevation at that Ch */}
            {visibility.lhs && sample.lhs && (
              <circle
                cx={scrubX}
                cy={yScale(sample.lhs.elevation)}
                r={3.5}
                fill="#3b82f6"
                stroke="#fff"
                strokeWidth={1.5}
                style={{ pointerEvents: "none" }}
              />
            )}
            {visibility.centerline && sample.centerline && (
              <circle
                cx={scrubX}
                cy={yScale(sample.centerline.elevation)}
                r={4}
                fill="#12c9b0"
                stroke="#fff"
                strokeWidth={1.5}
                style={{ pointerEvents: "none" }}
              />
            )}
            {visibility.rhs && sample.rhs && (
              <circle
                cx={scrubX}
                cy={yScale(sample.rhs.elevation)}
                r={3.5}
                fill="#f59e0b"
                stroke="#fff"
                strokeWidth={1.5}
                style={{ pointerEvents: "none" }}
              />
            )}
            {visibility.hfl && sample.hfl && (
              <circle
                cx={scrubX}
                cy={yScale(sample.hfl.design_hfl_continuous_m)}
                r={3.5}
                fill={HFL_COLOR}
                stroke="#fff"
                strokeWidth={1.5}
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* Draggable vertical scrubber */}
            <g style={{ cursor: "ew-resize" }}>
              <rect
                x={scrubX - 8}
                y={paddingTop}
                width={16}
                height={height - paddingTop - paddingBottom}
                fill="transparent"
              />
              <line
                x1={scrubX}
                y1={paddingTop}
                x2={scrubX}
                y2={height - paddingBottom}
                stroke="#f8fafc"
                strokeWidth={2}
                strokeDasharray="4 3"
              />
              <rect
                x={scrubX - 6}
                y={paddingTop - 2}
                width={12}
                height={8}
                rx={2}
                fill="#f8fafc"
              />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
