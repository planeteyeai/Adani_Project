import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";
import type { Borehole, SoilLayer } from "../lib/geotech";

const ROW_H = 34;

const COMP = [
  { key: "Gravel %", label: "Gravel", color: "#8b97a7" },
  { key: "Sand %", label: "Sand", color: "#e0a13a" },
  { key: "Silt %", label: "Silt", color: "#3d8a63" },
  { key: "Clay %", label: "Clay", color: "#3f6fd0" },
] as const;

const ENG = [
  { key: "CBR (%)", label: "CBR", unit: "(%)", color: "#3fbf6f" },
  { key: "SBC (T/m²)", label: "SBC", unit: "(T/m²)", color: "#a855f7" },
  { key: "UCS (kg/cm²)", label: "UCS", unit: "(kg/cm²)", color: "#ef4444" },
] as const;

function num(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function depthStart(layer: SoilLayer): number {
  const s = String(layer["Depth (m)"] ?? "");
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

/** Naturalistic soil colour based on gravel content + depth. */
function soilColor(layer: SoilLayer, i: number, n: number): string {
  const gravel = num(layer["Gravel %"]) ?? 0;
  const t = n > 1 ? i / (n - 1) : 0;
  const hue = Math.max(28, 42 - gravel * 0.35);
  const sat = 58 - t * 8;
  const light = 62 - t * 20 - gravel * 0.35;
  return `hsl(${hue} ${sat}% ${Math.max(28, light)}%)`;
}

export default function BoreholeCard({
  borehole,
  columns,
  onClose,
}: {
  borehole: Borehole;
  columns: string[];
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const layers = borehole.layers;
  const n = layers.length;
  const maxDepth = n ? depthStart(layers[n - 1]) + 1 : 10;
  void columns;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = cardRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        setFullscreen(true);
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setFullscreen((f) => !f);
    }
  };

  const isFs = fullscreen;

  const card = (
    <div
      ref={cardRef}
      className={
        isFs
          ? "fixed inset-0 z-[9999] flex h-[100dvh] w-[100dvw] flex-col overflow-hidden bg-[#0a1120]"
          : "fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      }
      onClick={isFs ? undefined : onClose}
    >
      <div
        className={`flex flex-col overflow-hidden bg-[#0a1120] ${
          isFs
            ? "h-full w-full"
            : "max-h-[92vh] w-full max-w-6xl rounded-2xl border border-white/10 shadow-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-white/10 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-white">{borehole.id}</h2>
              <span className="rounded-md bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-300 ring-1 ring-fuchsia-400/40">
                Geotechnical
              </span>
            </div>
            <div className="mt-0.5 text-sm font-semibold text-teal-400">{borehole.name}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleFullscreen}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label={isFs ? "Exit fullscreen" : "Fullscreen"}
              title={isFs ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFs ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
              onClick={async () => {
                if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
                onClose();
              }}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {/* Meta strip */}
          <div className="mx-6 mt-4 grid grid-cols-3 gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-3">
            <Meta label="Latitude" value={borehole.lat != null ? borehole.lat.toFixed(6) : "—"} />
            <Meta label="Longitude" value={borehole.lon != null ? borehole.lon.toFixed(6) : "—"} />
            <Meta label="Depth Explored" value={`${n} m`} />
          </div>

          {/* Body */}
          <div
            className={`grid grid-cols-1 gap-6 p-6 ${
              isFs ? "min-h-[calc(100dvh-10rem)] lg:grid-cols-3 lg:items-stretch" : "lg:grid-cols-[1fr_0.9fr_1.35fr]"
            }`}
          >
            <Composition layers={layers} rowH={isFs ? 44 : ROW_H} />
            <Engineering layers={layers} maxDepth={maxDepth} rowH={isFs ? 44 : ROW_H} />
            <SoilProfile layers={layers} rowH={isFs ? 44 : ROW_H} />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(card, document.body);
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-300">
      {children}
    </div>
  );
}

function SoilProfile({ layers, rowH = ROW_H }: { layers: SoilLayer[]; rowH?: number }) {
  return (
    <div>
      <div className="mb-2 grid grid-cols-[38px_1fr_38px] items-end gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <div>Depth (m)</div>
        <div>Soil Description</div>
        <div className="text-right">USCS</div>
      </div>
      <div className="grid grid-cols-[38px_1fr_38px] gap-x-1">
        {layers.map((layer, i) => (
          <div key={i} className="contents">
            <div className="flex items-center text-[11px] text-slate-400" style={{ height: rowH }}>
              {String(layer["Depth (m)"])}
            </div>
            <div className="flex items-center pr-1 text-[11px] leading-tight text-slate-300" style={{ height: rowH }}>
              {String(layer["Remarks"] ?? "—")}
            </div>
            <div className="flex items-center justify-end text-[11px] font-semibold text-slate-200" style={{ height: rowH }}>
              {String(layer["Soil Class"] ?? "—")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Composition({ layers, rowH = ROW_H }: { layers: SoilLayer[]; rowH?: number }) {
  return (
    <div>
      <SectionTitle>Composition (%)</SectionTitle>
      <div className="mb-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {COMP.map((c) => (
          <div key={c.key} className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
            {c.label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[30px_1fr] gap-x-1">
        {layers.map((layer, i) => (
          <div key={i} className="contents">
            <div className="flex items-center text-[10px] text-slate-500" style={{ height: rowH }}>
              {String(layer["Depth (m)"])}
            </div>
            <div className="flex items-center" style={{ height: rowH }}>
              <div className="flex h-4 w-full overflow-hidden rounded-sm">
                {COMP.map((c) => {
                  const v = num(layer[c.key]) ?? 0;
                  if (v <= 0) return null;
                  return (
                    <div
                      key={c.key}
                      className="flex items-center justify-center text-[9px] font-semibold text-black/70"
                      style={{ width: `${v}%`, background: c.color }}
                      title={`${c.label}: ${v}%`}
                    >
                      {v >= 7 ? v : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-[30px_1fr] gap-x-1">
        <div />
        <div className="flex justify-between text-[9px] text-slate-500">
          <span>0</span>
          <span>20</span>
          <span>40</span>
          <span>60</span>
          <span>80</span>
          <span>100</span>
        </div>
      </div>
      <div className="mt-0.5 text-center text-[10px] text-slate-500">Percentage (%)</div>
    </div>
  );
}

function Engineering({
  layers,
  maxDepth,
  rowH = ROW_H,
}: {
  layers: SoilLayer[];
  maxDepth: number;
  rowH?: number;
}) {
  const n = layers.length;
  const plotH = n * rowH;
  const depthTicks = Array.from({ length: maxDepth + 1 }, (_, i) => i);
  const depthAxisW = 40;
  const colW = 118;
  const padX = 20;
  const svgH = plotH + 8;
  const totalW = depthAxisW + ENG.length * colW;

  // Shared Y scale — 1 viewBox unit = 1 px vertically (fixed svg height).
  const depthY = (d: number) => 4 + (d / maxDepth) * plotH;
  const layerY = (i: number) => depthY(depthStart(layers[i]) + 0.5);

  return (
    <div>
      <SectionTitle>Engineering Properties</SectionTitle>

      {/* Column headers — aligned with SVG columns */}
      <div className="mb-1 flex" style={{ paddingLeft: depthAxisW }}>
        {ENG.map((prop) => (
          <div
            key={prop.key}
            className="text-center text-[11px] font-bold leading-tight"
            style={{ width: colW, color: prop.color }}
          >
            {prop.label}
            <br />
            <span className="text-[10px] font-medium text-slate-400">{prop.unit}</span>
          </div>
        ))}
      </div>

      {/* Single SVG — depth axis + all 4 property charts share one Y scale */}
      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 ${totalW} ${svgH}`}
        preserveAspectRatio="xMinYMin meet"
        className="overflow-visible"
      >
        {/* Depth axis label */}
        <text
          x={10}
          y={plotH / 2 + 4}
          fontSize={11}
          fontWeight={500}
          fill="#64748b"
          textAnchor="middle"
          transform={`rotate(-90, 10, ${plotH / 2 + 4})`}
        >
          Depth (m)
        </text>

        {/* Depth ticks + horizontal guide lines */}
        {depthTicks.map((d) => {
          const y = depthY(d);
          return (
            <g key={d}>
              <text
                x={depthAxisW - 6}
                y={y + 4}
                fontSize={11}
                fontWeight={500}
                fill="#94a3b8"
                textAnchor="end"
              >
                {d}
              </text>
              <line
                x1={depthAxisW}
                y1={y}
                x2={totalW}
                y2={y}
                stroke="#ffffff"
                strokeOpacity={0.07}
                strokeWidth={1}
              />
            </g>
          );
        })}

        {/* Property charts */}
        {ENG.map((prop, colIdx) => {
          const colX = depthAxisW + colIdx * colW;
          const vals = layers.map((l) => num(l[prop.key]));
          const present = vals.filter((v): v is number => v != null);
          const min = present.length ? Math.min(...present) : 0;
          const max = present.length ? Math.max(...present) : 1;
          const span = max - min || 1;
          const innerW = colW - padX * 2;
          const x = (v: number) => colX + padX + ((v - min) / span) * innerW;

          const pts = vals
            .map((v, i) => (v == null ? null : { x: x(v), y: layerY(i), v, i }))
            .filter((p): p is { x: number; y: number; v: number; i: number } => p != null);

          return (
            <g key={prop.key}>
              {/* Column separator */}
              {colIdx > 0 && (
                <line
                  x1={colX}
                  y1={0}
                  x2={colX}
                  y2={svgH}
                  stroke="#ffffff"
                  strokeOpacity={0.05}
                  strokeWidth={1}
                />
              )}
              {pts.length > 1 && (
                <polyline
                  points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={prop.color}
                  strokeWidth={1.8}
                  opacity={0.75}
                />
              )}
              {pts.map((p) => {
                const label = Number.isInteger(p.v) ? String(p.v) : p.v.toFixed(2);
                const labelOnRight = p.x < colX + colW * 0.55;
                return (
                  <g key={p.i}>
                    <circle cx={p.x} cy={p.y} r={3.5} fill={prop.color} stroke="#0a1120" strokeWidth={1} />
                    <text
                      x={labelOnRight ? p.x + 7 : p.x - 7}
                      y={p.y + 4}
                      fontSize={10}
                      fontWeight={600}
                      fill="#f1f5f9"
                      textAnchor={labelOnRight ? "start" : "end"}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Min -> Max legend */}
      <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <span>Min</span>
        <span
          className="h-1.5 w-24 rounded-full"
          style={{ background: "linear-gradient(90deg,#334155,#64748b,#e2e8f0)" }}
        />
        <span>Max</span>
      </div>
    </div>
  );
}
