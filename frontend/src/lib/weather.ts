/** Open-Meteo forecast — free, no API key. Docs: https://open-meteo.com/en/docs */

export type WeatherModelId =
  | "best_match"
  | "ecmwf_ifs04"
  | "gfs_seamless"
  | "icon_seamless"
  | "gem_seamless"
  | "meteofrance_seamless";

export const WEATHER_MODELS: { id: WeatherModelId; label: string; description: string }[] = [
  { id: "best_match", label: "Best Match", description: "Auto-select best model for location" },
  { id: "ecmwf_ifs04", label: "ECMWF IFS", description: "European Centre medium-range" },
  { id: "gfs_seamless", label: "GFS (US)", description: "NOAA Global Forecast System" },
  { id: "icon_seamless", label: "ICON (DWD)", description: "German Weather Service" },
  { id: "gem_seamless", label: "GEM (Canada)", description: "Environment Canada" },
  { id: "meteofrance_seamless", label: "Météo-France", description: "ARPEGE / AROME blend" },
];

export type WeatherCurrent = {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  weather_code: number;
  wind_speed_10m: number;
  surface_pressure: number;
  uv_index: number;
  precipitation?: number;
};

export type WeatherHourly = {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  precipitation: number[];
  wind_speed_10m: number[];
  relative_humidity_2m: number[];
  surface_pressure: number[];
  uv_index: number[];
  weather_code: number[];
};

export type WeatherDaily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  precipitation_sum: number[];
  wind_speed_10m_max: number[];
  uv_index_max: number[];
  weather_code: number[];
};

export type WeatherForecast = {
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  model: WeatherModelId;
  current: WeatherCurrent;
  hourly: WeatherHourly;
  daily: WeatherDaily;
};

const CACHE = new Map<string, { data: WeatherForecast; at: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

const CURRENT_VARS =
  "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure,uv_index,precipitation";
const HOURLY_VARS =
  "temperature_2m,precipitation_probability,precipitation,wind_speed_10m,relative_humidity_2m,surface_pressure,uv_index,weather_code";
const DAILY_VARS =
  "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,weather_code";

/** WMO weather interpretation codes (Open-Meteo). */
export function weatherCodeLabel(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code === 51 || code === 53 || code === 55) return "Drizzle";
  if (code === 56 || code === 57) return "Freezing drizzle";
  if (code === 61 || code === 63 || code === 65) return "Rain";
  if (code === 66 || code === 67) return "Freezing rain";
  if (code === 71 || code === 73 || code === 75) return "Snow";
  if (code === 77) return "Snow grains";
  if (code === 80 || code === 81 || code === 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with hail";
  return "Unknown";
}

export function weatherCodeEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 85 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

export function uvIndexLabel(uv: number): { label: string; color: string } {
  if (uv < 3) return { label: "Low", color: "#22c55e" };
  if (uv < 6) return { label: "Moderate", color: "#eab308" };
  if (uv < 8) return { label: "High", color: "#f97316" };
  if (uv < 11) return { label: "Very high", color: "#ef4444" };
  return { label: "Extreme", color: "#a855f7" };
}

function cacheKey(lat: number, lon: number, model: WeatherModelId): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}:${model}`;
}

export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  model: WeatherModelId = "best_match",
): Promise<WeatherForecast | null> {
  const key = cacheKey(latitude, longitude, model);
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: CURRENT_VARS,
    hourly: HOURLY_VARS,
    daily: DAILY_VARS,
    forecast_days: "16",
    timezone: "auto",
    wind_speed_unit: "kmh",
  });
  if (model !== "best_match") params.set("models", model);

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();

    const data: WeatherForecast = {
      latitude: json.latitude,
      longitude: json.longitude,
      timezone: json.timezone,
      timezone_abbreviation: json.timezone_abbreviation,
      elevation: json.elevation,
      model,
      current: {
        time: json.current.time,
        temperature_2m: json.current.temperature_2m,
        relative_humidity_2m: json.current.relative_humidity_2m,
        weather_code: json.current.weather_code,
        wind_speed_10m: json.current.wind_speed_10m,
        surface_pressure: json.current.surface_pressure,
        uv_index: json.current.uv_index,
        precipitation: json.current.precipitation,
      },
      hourly: {
        time: json.hourly.time,
        temperature_2m: json.hourly.temperature_2m,
        precipitation_probability: json.hourly.precipitation_probability,
        precipitation: json.hourly.precipitation,
        wind_speed_10m: json.hourly.wind_speed_10m,
        relative_humidity_2m: json.hourly.relative_humidity_2m,
        surface_pressure: json.hourly.surface_pressure,
        uv_index: json.hourly.uv_index,
        weather_code: json.hourly.weather_code,
      },
      daily: {
        time: json.daily.time,
        temperature_2m_max: json.daily.temperature_2m_max,
        temperature_2m_min: json.daily.temperature_2m_min,
        precipitation_probability_max: json.daily.precipitation_probability_max,
        precipitation_sum: json.daily.precipitation_sum,
        wind_speed_10m_max: json.daily.wind_speed_10m_max,
        uv_index_max: json.daily.uv_index_max,
        weather_code: json.daily.weather_code,
      },
    };

    CACHE.set(key, { data, at: Date.now() });
    return data;
  } catch {
    return null;
  }
}

export function formatForecastTime(iso: string, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

export function formatForecastDate(iso: string, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: timezone,
    }).format(new Date(iso + (iso.length === 10 ? "T12:00:00" : "")));
  } catch {
    return iso;
  }
}
