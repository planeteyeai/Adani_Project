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
};

/** Single-line weather strip — no card, blends into the map. */
export default function WeatherHud({ latitude, longitude, onOpenDetails }: Props) {
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

  const parts = [
    `${weatherCodeEmoji(current.weather_code)} ${Math.round(current.temperature_2m)}°C`,
    weatherCodeLabel(current.weather_code),
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
