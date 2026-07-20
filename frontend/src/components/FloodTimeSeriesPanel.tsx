import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  floodGaugeReference,
  floodMaxWaterLevelForYear,
  floodRecordMaxWaterLevel,
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
type ChartMode = "area" | "level";

type LevelRow = {
  year: string;
  level: number;
  peakLabel: string;
  note: string;
  isRecord: boolean;
};

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
  const [chartMode, setChartMode] = useState<ChartMode>(
    data.max_water_levels?.length ? "level" : "area",
  );

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

  const recordPeak = floodRecordMaxWaterLevel(data);
  const yearPeak = floodMaxWaterLevelForYear(data, year);
  const gaugeRef = floodGaugeReference(data);

  const levelChartData = useMemo<LevelRow[]>(
    () =>
      (data.max_water_levels ?? []).map((row) => ({
        year: String(row.year),
        level: row.max_water_level_m,
        peakLabel: row.peak_label,
        note: row.note ?? "",
        isRecord: recordPeak != null && row.year === recordPeak.year,
      })),
    [data.max_water_levels, recordPeak],
  );

  const hasLevelData = levelChartData.length > 0;

  useEffect(() => {
    if (!playing || !yearDates.length || chartMode !== "area") return;
    const id = window.setInterval(() => {
      const i = yearDates.indexOf(selectedDate);
      const next = yearDates[(Math.max(0, i) + 1) % yearDates.length];
      onDateChange(next);
    }, 900);
    return () => window.clearInterval(id);
  }, [playing, selectedDate, yearDates, onDateChange, chartMode]);

  useEffect(() => {
    if (chartMode === "level") setPlaying(false);
  }, [chartMode]);

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

  const tooltipStyle = {
    background: "rgba(10,17,32,0.95)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    fontSize: 11,
  };

  return (
    <div
      className="max-h-[42vh] shrink-0 overflow-hidden border-t border-white/10 bg-ink-900/95 backdrop-blur-xl"
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
              {data.dates.length} obs · {years[0]}–{years[years.length - 1]}
            </span>
            {chartMode === "area" ? (
              <>
                <span className="inline-flex items-center gap-1 text-sky-300">
                  <span className="h-1.5 w-3 rounded-sm bg-sky-400" /> Water area
                </span>
                <span className="inline-flex items-center gap-1 text-orange-300">
                  <span className="h-1.5 w-3 rounded-sm bg-orange-400" /> Flood area
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 text-sky-300">
                  <span className="h-1.5 w-3 rounded-sm bg-sky-400" /> Max water level
                </span>
                {recordPeak && (
                  <span className="inline-flex items-center gap-1 text-rose-300">
                    <span
                      className="inline-block h-0 w-3 border-t border-dashed border-rose-400"
                      aria-hidden
                    />
                    Record {recordPeak.max_water_level_m.toFixed(2)} m
                  </span>
                )}
                {gaugeRef.danger_level_m != null && (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <span
                      className="inline-block h-0 w-3 border-t border-dashed border-amber-400"
                      aria-hidden
                    />
                    Danger level {gaugeRef.danger_level_m.toFixed(2)} m
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {hasLevelData && (
              <div className="mr-1 inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                <button
                  type="button"
                  onClick={() => setChartMode("level")}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                    chartMode === "level"
                      ? "bg-sky-500/30 text-sky-100"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Level (m)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode("area")}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                    chartMode === "area"
                      ? "bg-sky-500/30 text-sky-100"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Area (ha)
                </button>
              </div>
            )}
            {chartMode === "area" && (
              <>
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
              </>
            )}
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

        {chartMode === "area" && (
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
        )}

        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
          {chartMode === "area" ? (
            <>
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
            </>
          ) : (
            <span className="text-slate-400">
              Yearly maximum gauge water level at{" "}
              <span className="font-semibold text-sky-300">{gaugeRef.name}</span>
              {gaugeRef.agency ? (
                <span className="text-slate-500"> · {gaugeRef.agency}</span>
              ) : null}
              {" · "}click a bar to open that year on the map
            </span>
          )}
          {yearPeak && (
            <span
              className="rounded px-2 py-0.5 font-semibold"
              style={{
                background: yearPeak.note ? "#f43f5e25" : "#38bdf820",
                color: yearPeak.note ? "#fb7185" : "#7dd3fc",
              }}
              title={yearPeak.note ?? "Maximum water level (gauge)"}
            >
              Max WL {yearPeak.max_water_level_m.toFixed(2)} m
              <span className="ml-1 font-normal opacity-80">· {yearPeak.peak_label}</span>
              {yearPeak.note ? ` · ${yearPeak.note}` : ""}
            </span>
          )}
        </div>

        {chartMode === "area" && (
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
        )}

        <div className="h-[160px] w-full rounded bg-ink-950/80 px-1 pt-1">
          {chartMode === "level" && hasLevelData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={levelChartData}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                onClick={(state) => {
                  const payload = state?.activePayload?.[0]?.payload as LevelRow | undefined;
                  if (payload?.year) selectYear(payload.year);
                }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                  axisLine={{ stroke: "#475569" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tickFormatter={(v) => `${v} m`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, _name, item) => {
                    const row = item?.payload as LevelRow | undefined;
                    const extras = [row?.peakLabel, row?.note].filter(Boolean).join(" · ");
                    return [
                      `${Number(value).toFixed(2)} m${extras ? ` · ${extras}` : ""}`,
                      "Max water level",
                    ];
                  }}
                  labelFormatter={(v) => `Year ${v}`}
                />
                {recordPeak && (
                  <ReferenceLine
                    y={recordPeak.max_water_level_m}
                    stroke="#fb7185"
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    label={{
                      value: `Record ${recordPeak.max_water_level_m.toFixed(2)} m`,
                      fill: "#fb7185",
                      fontSize: 9,
                      position: "insideTopRight",
                    }}
                  />
                )}
                {gaugeRef.danger_level_m != null && (
                  <ReferenceLine
                    y={gaugeRef.danger_level_m}
                    stroke="#fbbf24"
                    strokeDasharray="6 4"
                    strokeWidth={1}
                    label={{
                      value: `Danger ${gaugeRef.danger_level_m.toFixed(2)} m`,
                      fill: "#fbbf24",
                      fontSize: 9,
                      position: "insideTopLeft",
                    }}
                  />
                )}
                <Bar dataKey="level" name="level" radius={[4, 4, 0, 0]}>
                  {levelChartData.map((row) => (
                    <Cell
                      key={row.year}
                      fill={
                        row.year === year
                          ? row.isRecord
                            ? "#fb7185"
                            : "#38bdf8"
                          : row.isRecord
                            ? "#f43f5e88"
                            : "#0ea5e988"
                      }
                      stroke={row.year === year ? "#f8fafc" : "transparent"}
                      strokeWidth={row.year === year ? 1.5 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
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
                  width={52}
                  tickFormatter={(v) => `${v} ha`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
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
          )}
        </div>
      </div>
    </div>
  );
}
