import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
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
  /** True while the user is actively dragging the scrubber. */
  dragging?: boolean;
};

type Props = {
  points: ElevationPoint[];
  onClose: () => void;
  onPointClick?: (point: ElevationPoint) => void;
  /** Fired while the vertical scrubber moves — used to sync the map cross-section. */
  onScrub?: (sample: ElevationScrubSample) => void;
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

/** Chainage vs ground elevation profile with a draggable vertical scrubber. */
export default function ElevationGraphModal({
  points,
  onClose,
  onPointClick,
  onScrub,
  projectName,
  exportPoints,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const pendingXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const scrubChainageRef = useRef<number | null>(null);

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
    return {
      chainage: center.chainage,
      centerline: center,
      lhs: nearestPoint(lhsPts, center.chainage),
      rhs: nearestPoint(rhsPts, center.chainage),
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
  const paddingLeft = 44;
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

  const minY = Math.min(...normalized.map((p) => p.elevation));
  const maxY = Math.max(...normalized.map((p) => p.elevation));
  const avgY = normalized.reduce((sum, p) => sum + p.elevation, 0) / normalized.length;

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
      className="shrink-0 border-t border-white/10 bg-ink-900/95 backdrop-blur-xl"
      role="region"
      aria-label="Ground elevation profile"
    >
      <div className="px-3 py-1.5">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0 text-[10px]">
            <h3 className="text-[11px] font-bold text-white">Ground Elevation Profile</h3>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">Survey · 50 m · drag on centreline · shows LHS / Centre / RHS</span>
            {series.map((s) => (
              <span key={s.branch} className="inline-flex items-center gap-1">
                <span className="h-0.5 w-3 rounded" style={{ background: s.color }} />
                <span style={{ color: s.color }}>{s.label}</span>
              </span>
            ))}
            <span className="text-slate-500">·</span>
            <span>
              Min <span className="text-brand-400">{minY.toFixed(0)}</span>
            </span>
            <span>
              Max <span className="text-brand-400">{maxY.toFixed(0)}</span>
            </span>
            <span>
              Avg <span className="text-brand-400">{avgY.toFixed(0)}</span> m
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
          <span className="rounded bg-white/10 px-2 py-0.5 font-semibold text-white">
            Centre Ch {sample.chainage.toFixed(3)} km
          </span>
          <span className="rounded px-2 py-0.5 font-semibold" style={{ background: "#3b82f620", color: "#60a5fa" }}>
            LHS {sample.lhs != null ? `${sample.lhs.elevation.toFixed(2)} m` : "—"}
          </span>
          <span className="rounded px-2 py-0.5 font-semibold" style={{ background: "#12c9b020", color: "#38e1c6" }}>
            Centre {sample.centerline != null ? `${sample.centerline.elevation.toFixed(2)} m` : "—"}
          </span>
          <span className="rounded px-2 py-0.5 font-semibold" style={{ background: "#f59e0b20", color: "#fbbf24" }}>
            RHS {sample.rhs != null ? `${sample.rhs.elevation.toFixed(2)} m` : "—"}
          </span>
        </div>

        <div className="overflow-x-auto rounded bg-ink-950">
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
                    {p.chainage.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {[
              { y: minY, label: minY.toFixed(1) },
              { y: (minY + maxY) / 2, label: ((minY + maxY) / 2).toFixed(1) },
              { y: maxY, label: maxY.toFixed(1) },
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

            {series.map((s) => (
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

            {/* Dots sit on the centreline scrubber X; Y = each branch elevation at that Ch */}
            {sample.lhs && (
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
            {sample.centerline && (
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
            {sample.rhs && (
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
