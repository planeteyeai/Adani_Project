import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Globe2, Menu, X } from "lucide-react";

const NAV = [
  { label: "Features", to: "/#features" },
  { label: "Map Explorer", to: "/explorer" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "Projects", to: "/projects" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [loc.pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all ${
        scrolled ? "border-b border-white/10 bg-ink-950/80 backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand-500/15 ring-1 ring-brand-500/40">
            <Globe2 className="h-5 w-5 text-brand-400" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Geo<span className="text-brand-400">Vision</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((n) => (
            <NavItem key={n.label} to={n.to} label={n.label} />
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
            {NAV.map((n) => (
              <NavItem key={n.label} to={n.to} label={n.label} />
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

function NavItem({ to, label }: { to: string; label: string }) {
  const isHash = to.includes("#");
  if (isHash) {
    return (
      <a href={to} className="text-sm font-medium text-slate-300 transition hover:text-white">
        {label}
      </a>
    );
  }
  return (
    <Link to={to} className="text-sm font-medium text-slate-300 transition hover:text-white">
      {label}
    </Link>
  );
}
