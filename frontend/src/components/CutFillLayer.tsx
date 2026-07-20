import L from "leaflet";
import { useMemo, useRef } from "react";
import { CircleMarker, useMap, useMapEvents } from "react-leaflet";
import {
  CUT_FILL_BRANCH_META,
  CUT_FILL_CLASS_META,
  CUT_FILL_CLASS_ORDER,
  cutFillClassColor,
  cutFillClassLabel,
  DEFAULT_CUT_FILL_VISIBILITY,
  type CutFillBranch,
  type CutFillBranchId,
  type CutFillData,
  type CutFillSegment,
  type CutFillSeriesVisibility,
} from "../lib/cutFill";

export type CutFillMapPoint = {
  key: string;
  branchId: CutFillBranchId;
  branchName: string;
  lat: number;
  lon: number;
  segment: CutFillSegment;
  color: string;
  height: number | null;
};

type Props = {
  data: CutFillData;
  resolveChainage: (km: number) => [number, number] | null;
  visibility?: CutFillSeriesVisibility;
  blink?: boolean;
  svgRenderer: L.SVG;
  hoveredKey?: string | null;
  selectedKey?: string | null;
  onHover: (
    point: CutFillMapPoint | null,
    cursor: { x: number; y: number } | null,
  ) => void;
  onSelect: (point: CutFillMapPoint | null) => void;
  interactionEnabled?: boolean;
};

function fmtVol(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString()} m³`;
}

function fmtMass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString()} T`;
}

const M_PER_DEG_LAT = 110540;

/**
 * Offset a point perpendicular to the alignment by a fixed distance in metres,
 * using the previous/next anchor points to estimate the local tangent. Works in
 * a local metric frame (longitude scaled by cos(lat)) so the offset stays a
 * true perpendicular and constant width even on east–west stretches.
 */
function offsetPerp(
  anchor: [number, number],
  prev: [number, number] | null,
  next: [number, number] | null,
  offsetM: number,
): { lat: number; lon: number } {
  const [lat, lon] = anchor;
  if (!offsetM) return { lat, lon };

  const mPerDegLon = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const a = prev ?? anchor;
  const b = next ?? anchor;
  const tEast = (b[1] - a[1]) * mPerDegLon;
  const tNorth = (b[0] - a[0]) * M_PER_DEG_LAT;
  const len = Math.hypot(tEast, tNorth);
  if (len < 1e-6) return { lat, lon };

  // Left-hand perpendicular (rotate tangent +90°): (-north, east).
  const pEast = -tNorth / len;
  const pNorth = tEast / len;

  return {
    lat: lat + (pNorth * offsetM) / M_PER_DEG_LAT,
    lon: lon + (pEast * offsetM) / mPerDegLon,
  };
}

function expandBranchPoints(
  branch: CutFillBranch,
  resolveChainage: (km: number) => [number, number] | null,
): CutFillMapPoint[] {
  const meta = CUT_FILL_BRANCH_META[branch.id];
  const segments: CutFillSegment[] =
    branch.segments?.length > 0 ? branch.segments : branch.stretches ?? [];

  // Anchor lat/lon for each segment: prefer the coordinate embedded in the
  // datasheet, fall back to chainage resolution.
  const anchors: Array<[number, number] | null> = segments.map((seg) => {
    if (seg.lat != null && seg.lon != null) return [seg.lat, seg.lon];
    return resolveChainage(seg.mid_km);
  });

  const points: CutFillMapPoint[] = [];
  for (let i = 0; i < segments.length; i++) {
    const anchor = anchors[i];
    if (!anchor) continue;
    const segment = segments[i];
    const pos = offsetPerp(
      anchor,
      anchors[i - 1] ?? null,
      anchors[i + 1] ?? null,
      meta.offsetM,
    );
    points.push({
      key: `${branch.id}-${segment.id}`,
      branchId: branch.id,
      branchName: branch.name,
      lat: pos.lat,
      lon: pos.lon,
      segment,
      color: cutFillClassColor(segment.class_id),
      height: segment.height_cl_m ?? segment.avg_fill_height_m ?? null,
    });
  }
  return points;
}

function CutFillPointerBridge({
  points,
  enabled,
  onHover,
  onSelect,
}: {
  points: CutFillMapPoint[];
  enabled: boolean;
  onHover: (
    point: CutFillMapPoint | null,
    cursor: { x: number; y: number } | null,
  ) => void;
  onSelect: (point: CutFillMapPoint | null) => void;
}) {
  const map = useMap();
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const lastKeyRef = useRef<string | null>(null);

  const findNearest = (e: L.LeafletMouseEvent, thresholdPx: number) => {
    const mouse = map.mouseEventToContainerPoint(e.originalEvent);
    let best: CutFillMapPoint | null = null;
    let bestDist = thresholdPx;
    for (const p of pointsRef.current) {
      const pt = map.latLngToContainerPoint(L.latLng(p.lat, p.lon));
      const d = Math.hypot(pt.x - mouse.x, pt.y - mouse.y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  };

  useMapEvents({
    mousemove(e) {
      if (!enabledRef.current) {
        if (lastKeyRef.current != null) {
          lastKeyRef.current = null;
          onHoverRef.current(null, null);
        }
        return;
      }
      const best = findNearest(e, 16);
      const key = best?.key ?? null;
      if (key !== lastKeyRef.current) {
        lastKeyRef.current = key;
        onHoverRef.current(
          best,
          best
            ? { x: e.originalEvent.clientX, y: e.originalEvent.clientY }
            : null,
        );
      } else if (best) {
        onHoverRef.current(best, {
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
        });
      }
    },
    mouseout() {
      if (lastKeyRef.current != null) {
        lastKeyRef.current = null;
        onHoverRef.current(null, null);
      }
    },
    click(e) {
      if (!enabledRef.current) return;
      const best = findNearest(e, 16);
      onSelectRef.current(best);
    },
  });

  return null;
}

export function CutFillPointCard({
  point,
  compact = false,
}: {
  point: CutFillMapPoint;
  compact?: boolean;
}) {
  const { segment, branchName, color, height } = point;
  const title = `Cut & Fill · ${branchName}`;
  const subtitle = cutFillClassLabel(segment.class_id);

  const rows: Array<{ label: string; value: string }> = [
    {
      label: "Chainage",
      value: `${segment.from_km.toFixed(3)}–${segment.to_km.toFixed(3)} km`,
    },
    { label: "Side", value: branchName },
    { label: "Fill class", value: cutFillClassLabel(segment.class_id) },
    { label: "Fill volume", value: fmtVol(segment.fill_m3) },
    { label: "Fill mass", value: fmtMass(segment.fill_mass_t) },
    {
      label: "Embankment height",
      value: height != null ? `${height.toFixed(2)} m` : "—",
    },
    ...(segment.length_m != null
      ? [{ label: "Length", value: `${Number(segment.length_m).toFixed(0)} m` }]
      : []),
  ];

  return (
    <div className={compact ? "p-2.5" : "p-3.5"}>
      <div className="mb-2 flex items-start gap-2">
        <span
          className="mt-0.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-white/30"
          style={{ background: color }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">{title}</div>
          <div className="text-[11px] text-slate-400">{subtitle}</div>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: `${color}33`, color }}
        >
          {branchName}
        </span>
      </div>
      <dl className="space-y-1 text-[11px]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="text-right font-semibold tabular-nums text-slate-100">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {!compact && (
        <p className="mt-2 text-[10px] text-slate-500">
          Hover for preview · click to pin details
        </p>
      )}
    </div>
  );
}

export function CutFillLegend({
  visibility = DEFAULT_CUT_FILL_VISIBILITY,
  onVisibilityChange,
}: {
  visibility?: CutFillSeriesVisibility;
  onVisibilityChange?: (next: CutFillSeriesVisibility) => void;
  tcsTypes?: string[];
}) {
  const toggle = (id: CutFillBranchId) => {
    if (!onVisibilityChange) return;
    onVisibilityChange({ ...visibility, [id]: !visibility[id] });
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1">
        {(Object.keys(CUT_FILL_BRANCH_META) as CutFillBranchId[]).map((id) => {
          const meta = CUT_FILL_BRANCH_META[id];
          const on = visibility[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                on
                  ? "ring-1 ring-white/25 text-white"
                  : "bg-white/5 text-slate-500 line-through"
              }`}
              style={on ? { background: `${meta.color}33`, color: meta.color } : undefined}
              title={`Toggle ${meta.label}`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {(visibility.lhs || visibility.rhs) && (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Embankment fill height (points)
          </div>
          {CUT_FILL_CLASS_ORDER.map((id) => {
            const meta = CUT_FILL_CLASS_META[id];
            return (
              <div key={id} className="flex items-center gap-2 text-[10px] text-slate-400">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: meta.color }}
                />
                {meta.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CutFillLayer({
  data,
  resolveChainage,
  visibility = DEFAULT_CUT_FILL_VISIBILITY,
  blink = false,
  svgRenderer,
  hoveredKey = null,
  selectedKey = null,
  onHover,
  onSelect,
  interactionEnabled = true,
}: Props) {
  const branches =
    data.branches?.length > 0
      ? data.branches
      : ([
          {
            id: "lhs" as const,
            name: "LHS",
            side: "lhs",
            offset: -1,
            station_count: 0,
            segment_count: 0,
            stretch_count: data.stretch_count,
            stretches: data.stretches,
            segments: data.segments,
          },
        ] satisfies CutFillBranch[]);

  const points = useMemo(() => {
    const out: CutFillMapPoint[] = [];
    for (const branch of branches) {
      if (!visibility[branch.id]) continue;
      out.push(...expandBranchPoints(branch, resolveChainage));
    }
    return out;
  }, [branches, visibility, resolveChainage]);

  return (
    <>
      <CutFillPointerBridge
        points={points}
        enabled={interactionEnabled}
        onHover={onHover}
        onSelect={onSelect}
      />
      {points.map((p) => {
        const active = hoveredKey === p.key || selectedKey === p.key;
        return (
          <CircleMarker
            key={`${p.key}-${blink ? "b" : "s"}`}
            center={[p.lat, p.lon]}
            radius={active ? 8 : 5}
            pane="markerPane"
            renderer={svgRenderer}
            pathOptions={{
              color: active ? "#fff" : "#0f172a",
              weight: active ? 2.5 : 1,
              fillColor: p.color,
              fillOpacity: 1,
              interactive: false,
              className: blink ? "active-layer-marker-blink" : undefined,
            }}
          />
        );
      })}
    </>
  );
}
