import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type TopBarWeatherValue = {
  latitude: number | null;
  longitude: number | null;
  setCoords: (lat: number, lon: number) => void;
  clearCoords: () => void;
  requestOpenDetails: () => void;
  registerOpenDetails: (handler: (() => void) | null) => void;
};

const TopBarWeatherContext = createContext<TopBarWeatherValue | null>(null);

export function TopBarWeatherProvider({ children }: { children: ReactNode }) {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const openHandlerRef = useRef<(() => void) | null>(null);

  const setCoords = useCallback((lat: number, lon: number) => {
    setLatitude(lat);
    setLongitude(lon);
  }, []);

  const clearCoords = useCallback(() => {
    setLatitude(null);
    setLongitude(null);
  }, []);

  const requestOpenDetails = useCallback(() => {
    openHandlerRef.current?.();
  }, []);

  const registerOpenDetails = useCallback((handler: (() => void) | null) => {
    openHandlerRef.current = handler;
  }, []);

  const value = useMemo<TopBarWeatherValue>(
    () => ({
      latitude,
      longitude,
      setCoords,
      clearCoords,
      requestOpenDetails,
      registerOpenDetails,
    }),
    [latitude, longitude, setCoords, clearCoords, requestOpenDetails, registerOpenDetails],
  );

  return (
    <TopBarWeatherContext.Provider value={value}>{children}</TopBarWeatherContext.Provider>
  );
}

export function useTopBarWeather() {
  const ctx = useContext(TopBarWeatherContext);
  if (!ctx) {
    throw new Error("useTopBarWeather must be used within TopBarWeatherProvider");
  }
  return ctx;
}
