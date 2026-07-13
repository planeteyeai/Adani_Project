import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  CloudRain,
  Droplets,
  Gauge,
  Loader2,
  Sun,
  Wind,
  X,
} from "lucide-react";
import {
  fetchWeatherForecast,
  formatForecastDate,
  formatForecastTime,
  uvIndexLabel,
  weatherCodeEmoji,
  weatherCodeLabel,
  type WeatherForecast,
} from "../lib/weather";

type Tab = "hourly" | "daily";

type Props = {
  latitude: number;
  longitude: number;
  locationLabel?: string;
  onClose: () => void;
};

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default function WeatherForecastModal({
  latitude,
  longitude,
  locationLabel,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("hourly");
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWeatherForecast(latitude, longitude).then((data) => {
      if (cancelled) return;
      setLoading(false);
      if (!data) {
        setError("Could not load weather forecast. Check your connection and try again.");
        setForecast(null);
        return;
      }
      setForecast(data);
    });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  const uv = forecast ? uvIndexLabel(forecast.current.uv_index) : null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <CloudRain className="h-5 w-5 text-brand-400" />
              <h2 className="text-lg font-bold text-white">Weather Forecast</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {locationLabel ?? `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`}
              {forecast && (
                <span className="ml-2 text-slate-500">
                  · {forecast.timezone_abbreviation} · {forecast.elevation.toFixed(0)} m elev.
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
              <span className="text-sm">Loading forecast…</span>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-6 text-center text-sm text-rose-300">
              {error}
            </div>
          )}

          {forecast && !loading && (
            <div className="space-y-5">
              {/* Current conditions */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Current weather
                </h3>
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-brand-500/10 to-accent-500/5 p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-5xl" aria-hidden>
                      {weatherCodeEmoji(forecast.current.weather_code)}
                    </span>
                    <div>
                      <div className="text-4xl font-extrabold text-white">
                        {Math.round(forecast.current.temperature_2m)}°C
                      </div>
                      <div className="text-sm text-slate-300">
                        {weatherCodeLabel(forecast.current.weather_code)}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Updated {formatForecastTime(forecast.current.time, forecast.timezone)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <StatCard
                    icon={<Droplets className="h-3 w-3" />}
                    label="Humidity"
                    value={`${forecast.current.relative_humidity_2m}%`}
                  />
                  <StatCard
                    icon={<Wind className="h-3 w-3" />}
                    label="Wind"
                    value={`${Math.round(forecast.current.wind_speed_10m)} km/h`}
                  />
                  <StatCard
                    icon={<Gauge className="h-3 w-3" />}
                    label="Pressure"
                    value={`${Math.round(forecast.current.surface_pressure)} hPa`}
                  />
                  <StatCard
                    icon={<Sun className="h-3 w-3" />}
                    label="UV Index"
                    value={forecast.current.uv_index.toFixed(1)}
                    sub={uv?.label}
                  />
                  <StatCard
                    icon={<CloudRain className="h-3 w-3" />}
                    label="Rain now"
                    value={`${forecast.current.precipitation ?? 0} mm`}
                  />
                  <StatCard
                    icon={<CloudRain className="h-3 w-3" />}
                    label="Rain chance"
                    value={`${forecast.hourly.precipitation_probability[0] ?? 0}%`}
                    sub="Next hour"
                  />
                </div>
              </section>

              {/* Tabs */}
              <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setTab("hourly")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    tab === "hourly"
                      ? "bg-brand-500/20 text-brand-300"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Hourly (48 h)
                </button>
                <button
                  type="button"
                  onClick={() => setTab("daily")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    tab === "daily"
                      ? "bg-brand-500/20 text-brand-300"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  16-day forecast
                </button>
              </div>

              {tab === "hourly" && (
                <section>
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2 font-semibold">Time</th>
                          <th className="px-3 py-2 font-semibold">Condition</th>
                          <th className="px-3 py-2 font-semibold">Temp</th>
                          <th className="px-3 py-2 font-semibold">Rain %</th>
                          <th className="px-3 py-2 font-semibold">Rain mm</th>
                          <th className="px-3 py-2 font-semibold">Wind</th>
                          <th className="px-3 py-2 font-semibold">Humidity</th>
                          <th className="px-3 py-2 font-semibold">UV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecast.hourly.time.slice(0, 48).map((t, i) => (
                          <tr
                            key={t}
                            className="border-b border-white/5 transition hover:bg-white/5"
                          >
                            <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                              {formatForecastDate(t, forecast.timezone)}
                              <span className="ml-1 text-slate-500">
                                {formatForecastTime(t, forecast.timezone)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span title={weatherCodeLabel(forecast.hourly.weather_code[i])}>
                                {weatherCodeEmoji(forecast.hourly.weather_code[i])}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-medium text-white">
                              {Math.round(forecast.hourly.temperature_2m[i])}°
                            </td>
                            <td className="px-3 py-2 text-cyan-300">
                              {forecast.hourly.precipitation_probability[i]}%
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {forecast.hourly.precipitation[i]} mm
                            </td>
                            <td className="px-3 py-2 text-slate-300">
                              {Math.round(forecast.hourly.wind_speed_10m[i])} km/h
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {forecast.hourly.relative_humidity_2m[i]}%
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {forecast.hourly.uv_index[i].toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {tab === "daily" && (
                <section className="grid gap-2 sm:grid-cols-2">
                  {forecast.daily.time.map((day, i) => {
                    const rainProb = forecast.daily.precipitation_probability_max[i];
                    const uvDay = uvIndexLabel(forecast.daily.uv_index_max[i]);
                    return (
                      <div
                        key={day}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <span className="text-2xl" aria-hidden>
                          {weatherCodeEmoji(forecast.daily.weather_code[i])}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-white">
                            {formatForecastDate(day, forecast.timezone)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {weatherCodeLabel(forecast.daily.weather_code[i])}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-white">
                            {Math.round(forecast.daily.temperature_2m_max[i])}° /{" "}
                            {Math.round(forecast.daily.temperature_2m_min[i])}°
                          </div>
                          <div className="mt-0.5 text-[10px] text-cyan-300">
                            Rain {rainProb}%
                            {forecast.daily.precipitation_sum[i] > 0 &&
                              ` · ${forecast.daily.precipitation_sum[i]} mm`}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Wind {Math.round(forecast.daily.wind_speed_10m_max[i])} km/h · UV{" "}
                            {forecast.daily.uv_index_max[i].toFixed(1)} ({uvDay.label})
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
