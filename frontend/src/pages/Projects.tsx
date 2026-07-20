import { Link } from "react-router-dom";
import { LayoutDashboard, MapPinned } from "lucide-react";

export default function Projects() {
  return (
    <div className="min-h-screen bg-ink-950 pt-16">
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="chip mb-2">Projects</div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">Your planning projects</h1>
        <p className="mt-1 text-sm text-slate-400">
          Open the corridor on the map or review analytics on the dashboard.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/explorer" className="btn-primary inline-flex items-center gap-2">
            <MapPinned className="h-4 w-4" /> Map Explorer
          </Link>
          <Link to="/dashboard" className="btn-ghost inline-flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
