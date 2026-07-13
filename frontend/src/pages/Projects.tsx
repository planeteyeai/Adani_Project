import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CloudUpload, FileUp, Loader2, MapPin, Route } from "lucide-react";
import { fetchProjects, uploadProject } from "../lib/api";
import type { Project } from "../lib/types";

const INDUSTRIES = [
  "Highways", "Oil & Gas", "Railways", "Power Transmission", "Solar",
  "Water Supply", "Mining", "Smart Cities", "Metro Rail", "Other",
];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [industry, setIndustry] = useState("Highways");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetchProjects().then((p) => {
      setProjects(p);
      setLoading(false);
    });
  };
  useEffect(load, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ ok: false, text: "Choose a KMZ / KML file first." });
      return;
    }
    const form = new FormData(e.currentTarget);
    form.set("file", file);
    setUploading(true);
    setMessage(null);
    const res = await uploadProject(form);
    setUploading(false);
    if ("error" in res) {
      setMessage({ ok: false, text: res.error });
    } else {
      setMessage({ ok: true, text: `Parsed "${res.name}" — ${res.stats.line_count} lines, ${res.stats.point_count} points.` });
      load();
      fileRef.current!.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 pt-16">
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="chip mb-2">Projects</div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">Your planning projects</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload an alignment to parse it into GIS-ready geometry and engineering metrics.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Upload */}
          <form onSubmit={onSubmit} className="card h-fit p-6 lg:col-span-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <CloudUpload className="h-5 w-5 text-brand-400" /> Upload Project
            </h2>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Project name
            </label>
            <input
              name="name"
              placeholder="e.g. NH-XX Greenfield Bypass"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Location
            </label>
            <input
              name="location"
              placeholder="District, State"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Industry
            </label>
            <select
              name="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Alignment file
            </label>
            <label className="mt-1.5 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 bg-ink-950 px-4 py-6 text-center hover:border-brand-500/50">
              <FileUp className="h-6 w-6 text-brand-400" />
              <span className="text-sm text-slate-300">Click to select KMZ / KML</span>
              <span className="text-xs text-slate-500">Shapefile · GeoJSON · GPX also supported by API</span>
              <input ref={fileRef} type="file" name="file" accept=".kmz,.kml,.geojson,.json" className="hidden" />
            </label>

            <button type="submit" disabled={uploading} className="btn-primary mt-5 w-full disabled:opacity-60">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
                </>
              ) : (
                "Upload & Parse"
              )}
            </button>

            {message && (
              <p className={`mt-3 text-sm ${message.ok ? "text-emerald-400" : "text-rose-400"}`}>
                {message.text}
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Requires the Django API running. Without it, explore the bundled demo project below.
            </p>
          </form>

          {/* List */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="grid h-40 place-items-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {projects.map((p) => (
                  <div key={p.id} className="group card p-5 transition hover:border-brand-500/40">
                    <div className="flex items-start justify-between">
                      <span className="chip">{p.industry}</span>
                      <span className="text-xs text-slate-500">
                        {Math.round(p.stats?.total_length_km ?? 0).toLocaleString()} km
                      </span>
                    </div>
                    <h3 className="mt-3 flex items-center gap-2 font-semibold text-white">
                      <Route className="h-4 w-4 text-brand-400" /> {p.name}
                    </h3>
                    {p.location && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                        <MapPin className="h-3 w-3" /> {p.location}
                      </div>
                    )}
                    <div className="mt-3 flex gap-4 text-xs text-slate-400">
                      <span>{(p.stats?.line_count ?? 0).toLocaleString()} lines</span>
                      <span>{(p.stats?.point_count ?? 0).toLocaleString()} points</span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Link to="/explorer" className="btn-primary flex-1 py-2 text-xs">
                        Map
                      </Link>
                      <Link to="/dashboard" className="btn-ghost flex-1 py-2 text-xs">
                        Dashboard
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
