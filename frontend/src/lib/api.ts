import demo from "../data/demo_project.json";
import { deriveMetrics } from "./metrics";
import type { GeoJSON, Metrics, Project, ProjectStats } from "./types";

const API = "/api";

const demoProject: Project = {
  id: "demo",
  name: (demo as any).name,
  location: (demo as any).location,
  industry: (demo as any).industry,
  description: "Bundled demo — real plan & profile alignment parsed from KMZ.",
  stats: (demo as any).stats as ProjectStats,
  geojson: (demo as any).geojson as GeoJSON,
  source_filename: "digha_koilwar.kmz",
};

async function tryFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchProjects(): Promise<Project[]> {
  const data = await tryFetch<{ results?: Project[] } | Project[]>(`${API}/projects/`);
  if (data) {
    const list = Array.isArray(data) ? data : data.results ?? [];
    if (list.length) return list;
  }
  return [demoProject];
}

export async function fetchProject(id: string | number): Promise<Project> {
  if (id === "demo") return demoProject;
  const data = await tryFetch<Project>(`${API}/projects/${id}/`);
  return data ?? demoProject;
}

export async function fetchMetrics(project: Project): Promise<Metrics> {
  if (project.id !== "demo") {
    const data = await tryFetch<Metrics>(`${API}/projects/${project.id}/metrics/`);
    if (data) return data;
  }
  return deriveMetrics(project.stats);
}

export async function uploadProject(form: FormData): Promise<Project | { error: string }> {
  try {
    const res = await fetch(`${API}/projects/upload/`, { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: (body as any).detail || `Upload failed (${res.status})` };
    }
    return (await res.json()) as Project;
  } catch (e) {
    return { error: "Backend not reachable. Start the Django API to enable uploads." };
  }
}

export { demoProject };
