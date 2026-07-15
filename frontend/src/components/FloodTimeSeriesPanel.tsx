import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight, Pause, Play, Waves, X } from "lucide-react";
import {
  FLOOD_COLORS,
  formatFloodDate,
  type FloodData,
  type FloodTimeStep,
} from "../lib/flood";

type Props = {
  data: FloodData;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onClose: () => void;
};

type ChartRow = { date: string; label: string; water: number; flood: number };

export default function FloodTimeSeriesPanel({
  data,
  selectedDate,
  onDateChange,
  onClose,
}: Props) {
  const years = useMemo(() => {
    const ys = new Set(data.dates.map((d) => d.slice(0, 4)));
    return [...ys].sort();
  }, [data.dates]);

  const [year, setYear] = useState(() => selectedDate.slice(0, 4));
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const y = selectedDate.slice(0, 4);
    if (years.includes(y)) setYear(y);
  }, [selectedDate, years]);

  const yearDates = useMemo(
    () => data.dates.filter((d) => d.startsWith(year)),
    [data.dates, year],
  );

  const idx = Math.max(0, data.dates.indexOf(selectedDate));
  const step: FloodTimeStep | undefined = data.timeseries[idx];
  const yearIdx = Math.max(0, yearDates.indexOf(selectedDate));

  const chartData = useMemo<ChartRow[]>(
    () =>
      data.timeseries
        .filter((t) => t.date.startsWith(year))
        .map((t) => ({
          date: t.date,
          label: formatFloodDate(t.date).replace(/ \d{4}$/, ""),
          water: t.water_area_ha ?? 0,
          flood: t.flood_area_ha ?? 0,
        })),
    [data.timeseries, year],
  );

  useEffect(() => {
    if (!playing || !yearDates.length) return;
    const id = window.setInterval(() => {
      const i = yearDates.indexOf(selectedDate);
      const next = yearDates[(Math.max(0, i) + 1) % yearDates.length];
      onDateChange(next);
    }, 900);
    return () => window.clearInterval(id);
  }, [playing, selectedDate, yearDates, onDateChange]);

  const go = (delta: number) => {
    setPlaying(false);
    if (!yearDates.length) return;
    const next =
      yearDates[(yearIdx + delta + yearDates.length) % yearDates.length];
    onDateChange(next);
  };

  const selectYear = (y: string) => {
    setPlaying(false);
    setYear(y);
    const first = data.dates.find((d) => d.startsWith(y));
    if (first) onDateChange(first);
  };

  return (
    <div
      className="shrink-0 border-t border-white/10 bg-ink-900/95 backdrop-blur-xl"
      role="region"
      aria-label="Flood water time series"
    >
      <div className="px-3 py-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
            <Waves className="h-3.5 w-3.5 text-sky-400" />
            <h3 className="text-[11px] font-bold text-white">Flood water time series</h3>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">
              {data.dates.length} obs · {years[0]}–{years[years.length - 1]} · ha
            </span>
            <span className="inline-flex items-center gap-1 text-sky-300">
              <span className="h-1.5 w-3 rounded-sm bg-sky-400" /> Water area
            </span>
            <span className="inline-flex items-center gap-1 text-orange-300">
              <span className="h-1.5 w-3 rounded-sm bg-orange-400" /> Flood area
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => go(-1)}
              className="rounded border border-white/10 bg-white/5 p-1 text-slate-200 hover:bg-white/10"
              title="Previous date"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-500/20"
              title={playing ? "Pause" : "Play through dates"}
            >
              {playing ? (
                <span className="inline-flex items-center gap-1">
                  <Pause className="h-3 w-3" /> Pause
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Play className="h-3 w-3" /> Play
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="rounded border border-white/10 bg-white/5 p-1 text-slate-200 hover:bg-white/10"
              title="Next date"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-white/10"
            >
              <span className="inline-flex items-center gap-1">
                <X className="h-3 w-3" /> Hide
              </span>
            </button>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => selectYear(y)}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                y === year
                  ? "bg-brand-500/25 text-brand-200 ring-1 ring-brand-400/40"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded bg-white/10 px-2 py-0.5 font-semibold text-white">
            {formatFloodDate(selectedDate)}
          </span>
          {step?.pre_date && (
            <span className="text-slate-500">vs {formatFloodDate(step.pre_date)}</span>
          )}
          <span
            className="rounded px-2 py-0.5 font-semibold"
            style={{ background: "#0ea5e920", color: FLOOD_COLORS.waterArea }}
          >
            Water {step?.water_area_ha?.toFixed(2) ?? "—"} ha
          </span>
          <span
            className="rounded px-2 py-0.5 font-semibold"
            style={{ background: "#f9731620", color: FLOOD_COLORS.floodArea }}
          >
            Flood {step?.flood_area_ha?.toFixed(2) ?? "—"} ha
          </span>
          <span className="text-slate-500">
            Map · {step?.water_points ?? 0} water · {step?.flood_points ?? 0} flood pts
          </span>
        </div>

        <div className="mb-2 flex gap-1 overflow-x-auto pb-0.5">
          {yearDates.map((d) => {
            const active = d === selectedDate;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  onDateChange(d);
                }}
                className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium transition ${
                  active
                    ? "bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/50"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                {formatFloodDate(d).replace(/ \d{4}$/, "")}
              </button>
            );
          })}
        </div>

        <div className="h-[140px] w-full rounded bg-ink-950/80 px-1 pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              onClick={(state) => {
                const payload = state?.activePayload?.[0]?.payload as ChartRow | undefined;
                if (payload?.date) {
                  setPlaying(false);
                  onDateChange(payload.date);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatFloodDate(String(v)).replace(/ \d{4}$/, "")}
                tick={{ fill: "#94a3b8", fontSize: 9 }}
                axisLine={{ stroke: "#475569" }}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,17,32,0.95)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelFormatter={(v) => formatFloodDate(String(v))}
                formatter={(value, name) => [
                  `${Number(value).toFixed(2)} ha`,
                  name === "water" ? "Water area" : "Flood area",
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 10 }}
                formatter={(v) => (v === "water" ? "Water area" : "Flood area")}
              />
              <ReferenceLine
                x={selectedDate}
                stroke="#f8fafc"
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="water"
                name="water"
                stroke={FLOOD_COLORS.waterArea}
                fill={FLOOD_COLORS.waterArea}
                fillOpacity={0.18}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="flood"
                name="flood"
                stroke={FLOOD_COLORS.floodArea}
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
