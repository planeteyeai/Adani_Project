import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  fetchWeatherForecast,
  weatherCodeEmoji,
  weatherCodeLabel,
  type WeatherForecast,
} from "../lib/weather";

type Props = {
  latitude: number;
  longitude: number;
  onOpenDetails?: () => void;
  variant?: "inline" | "pill";
};

/** Weather strip — inline on map or pill in the app top bar. */
export default function WeatherHud({
  latitude,
  longitude,
  onOpenDetails,
  variant = "inline",
}: Props) {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWeatherForecast(latitude, longitude).then((data) => {
      if (cancelled) return;
      setForecast(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  if (loading) {
    if (variant === "pill") {
      return (
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-400/90" />
          <span>Weather…</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-[13px] text-white/70 drop-shadow-md">
        <Loader2 className="h-3 w-3 animate-spin text-brand-400/90" />
        <span>Weather…</span>
      </div>
    );
  }

  if (!forecast) return null;

  const { current, hourly } = forecast;
  const rainChance = hourly.precipitation_probability[0] ?? 0;

  const tempLabel = `${weatherCodeEmoji(current.weather_code)} ${Math.round(current.temperature_2m)}°C`;
  const conditionLabel = weatherCodeLabel(current.weather_code);

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onOpenDetails}
        title="Open full forecast"
        className="flex max-w-[min(100vw-8rem,18rem)] items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white transition hover:border-white/20 hover:bg-white/10"
      >
        <span className="shrink-0 font-medium">{tempLabel}</span>
        <span className="text-white/35">·</span>
        <span className="truncate text-white/85">{conditionLabel}</span>
      </button>
    );
  }

  const parts = [
    tempLabel,
    conditionLabel,
    `${current.relative_humidity_2m}% hum`,
    `${Math.round(current.wind_speed_10m)} km/h`,
    `${Math.round(current.surface_pressure)} hPa`,
    `UV ${current.uv_index.toFixed(1)}`,
    `${current.precipitation ?? 0} mm`,
    `${rainChance}% rain`,
  ];

  return (
    <button
      type="button"
      onClick={onOpenDetails}
      title="Open full forecast"
      className="max-w-full truncate text-left text-[13px] leading-tight text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] transition hover:text-white"
    >
      {parts.join(" · ")}
    </button>
  );
}
