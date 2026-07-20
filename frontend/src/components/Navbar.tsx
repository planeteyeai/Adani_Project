import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Layers,
  LayoutDashboard,
  MapPinned,
  Menu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import WeatherHud from "./WeatherHud";
import { useTopBarWeather } from "../lib/topBarWeather";

const LANDING_NAV = [
  { label: "Features", to: "/#features" },
  { label: "Map Explorer", to: "/explorer" },
  { label: "Dashboard", to: "/dashboard" },
];

const APP_NAV: { label: string; to: string; icon: LucideIcon }[] = [
  { label: "Map Explorer", to: "/explorer", icon: MapPinned },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Reports", to: "/reports", icon: Layers },
];

const APP_ROUTES = new Set(["/explorer", "/dashboard", "/projects", "/reports"]);

function BrandMark() {
  const loc = useLocation();
  const isHome = loc.pathname === "/";

  if (!isHome) {
    return (
      <Link to="/" className="flex items-center gap-1.5 shrink-0">
        <img
          src="/adani-logo.png"
          alt="Adani"
          className="-mr-4 h-20 w-auto object-contain"
        />
        <span className="h-7 w-px bg-white/25" aria-hidden />
        <span className="text-xl font-light tracking-wide text-slate-300">Infra</span>
      </Link>
    );
  }

  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0">
      <img
        src="/planeteye-logo.png"
        alt="PlanetEye INFRA-AI"
        className="h-12 w-12 rounded-full object-contain"
      />
      <span className="text-xl font-extrabold tracking-wider">
        Planet<span className="text-brand-400">Eye</span>
      </span>
      <span className="mx-1 h-8 w-px bg-white/20" aria-hidden />
      <span className="rounded-md bg-white px-2 py-1">
        <img
          src="/mitcon-logo.png"
          alt="MITCON — Solutions for Sustainable Tomorrow"
          className="h-7 w-auto object-contain"
        />
      </span>
    </Link>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const isAppShell = APP_ROUTES.has(loc.pathname);
  const weather = useTopBarWeather();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [loc.pathname]);

  if (isAppShell) {
    return (
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-ink-950/95 backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5">
          <BrandMark />

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
            {APP_NAV.map((item) => (
              <AppNavItem key={item.label} {...item} />
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {weather.latitude != null && weather.longitude != null && (
              <WeatherHud
                latitude={weather.latitude}
                longitude={weather.longitude}
                variant="pill"
                onOpenDetails={weather.requestOpenDetails}
              />
            )}

            <button
              className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-white/10 bg-ink-950/95 px-5 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {APP_NAV.map((item) => (
                <AppNavItem key={item.label} {...item} mobile />
              ))}
            </div>
          </div>
        )}
      </header>
    );
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all ${
        scrolled ? "border-b border-white/10 bg-ink-950/80 backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <BrandMark />

        <nav className="hidden items-center gap-7 lg:flex">
          {LANDING_NAV.map((n) => (
            <LandingNavItem key={n.label} to={n.to} label={n.label} />
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/dashboard" className="text-sm font-medium text-slate-300 hover:text-white">
            Dashboard Login
          </Link>
          <Link to="/explorer" className="btn-primary">
            Start Project
          </Link>
        </div>

        <button
          className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-ink-950/95 px-5 py-4 lg:hidden">
          <div className="flex flex-col gap-3">
            {LANDING_NAV.map((n) => (
              <LandingNavItem key={n.label} to={n.to} label={n.label} />
            ))}
            <Link to="/explorer" className="btn-primary mt-2 w-full">
              Start Project
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function AppNavItem({
  to,
  label,
  icon: Icon,
  mobile = false,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  mobile?: boolean;
}) {
  const loc = useLocation();
  const active = loc.pathname === to || loc.pathname.startsWith(`${to}/`);

  const className = active
    ? "relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-brand-400"
    : "relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/5 hover:text-white";

  const content = (
    <>
      {active && (
        <>
          <span className="absolute inset-0 rounded-lg bg-brand-500/10" aria-hidden />
          <span
            className="absolute inset-x-3 -bottom-[17px] h-[3px] rounded-full bg-brand-400"
            aria-hidden
          />
        </>
      )}
      <Icon className={`relative h-4 w-4 shrink-0 ${active ? "text-brand-400" : "text-white"}`} />
      <span className="relative">{label}</span>
    </>
  );

  if (mobile) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}

function LandingNavItem({ to, label }: { to: string; label: string }) {
  const loc = useLocation();
  const isHash = to.includes("#");
  const path = to.split("#")[0] || "/";
  const active = !isHash && (loc.pathname === path || loc.pathname.startsWith(`${path}/`));

  const className = active
    ? "rounded-lg border-2 border-sky-400/60 px-2.5 py-1 text-sm font-semibold text-white ring-1 ring-sky-300/20"
    : "rounded-lg border-2 border-transparent px-2.5 py-1 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white";

  if (isHash) {
    return (
      <a href={to} className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {label}
    </Link>
  );
}
