"""Build chainage-wise RoW / land-requirement areas from Polyline [236ED8] outline.

Uses the KMZ chainage markers as the corridor axis. At each chainage step a
perpendicular is cast left/right onto the outline edges; consecutive cuts form
a slab polygon whose geodesic area is reported in hectares.
"""
from __future__ import annotations

import json
import math
import re
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DEMO = ROOT / "frontend" / "src" / "data" / "demo_project.json"
OUT = ROOT / "frontend" / "public" / "land_acquisition_chainage.json"

OUTLINE_FOLDER = "Model / Polyline [236ED8]"
STEP_KM = 1.0
SEARCH_M = 350.0  # max half-width to search for outline
R_M = 6_371_000.0

CHAINAGE_RE = re.compile(r"^(\d+)\+(\d+)$")


def _haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    p = math.pi / 180
    a = (
        math.sin(((lat2 - lat1) * p) / 2) ** 2
        + math.cos(lat1 * p)
        * math.cos(lat2 * p)
        * math.sin(((lon2 - lon1) * p) / 2) ** 2
    )
    return 2 * R_M * math.asin(math.sqrt(min(1.0, a)))


def _bearing_deg(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δλ = math.radians(lon2 - lon1)
    y = math.sin(Δλ) * math.cos(φ2)
    x = math.cos(φ1) * math.sin(φ2) - math.sin(φ1) * math.cos(φ2) * math.cos(Δλ)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def _offset(lon: float, lat: float, bearing_deg: float, dist_m: float) -> tuple[float, float]:
    δ = dist_m / R_M
    θ = math.radians(bearing_deg)
    φ1 = math.radians(lat)
    λ1 = math.radians(lon)
    φ2 = math.asin(
        math.sin(φ1) * math.cos(δ) + math.cos(φ1) * math.sin(δ) * math.cos(θ)
    )
    λ2 = λ1 + math.atan2(
        math.sin(θ) * math.sin(δ) * math.cos(φ1),
        math.cos(δ) - math.sin(φ1) * math.sin(φ2),
    )
    return math.degrees(λ2), math.degrees(φ2)


def _seg_intersect(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
    d: tuple[float, float],
) -> tuple[float, float] | None:
    """Segment intersection in lon/lat (planar local approx). Returns (lon, lat)."""
    ax, ay = a
    bx, by = b
    cx, cy = c
    dx, dy = d
    den = (ax - bx) * (cy - dy) - (ay - by) * (cx - dx)
    if abs(den) < 1e-18:
        return None
    t = ((ax - cx) * (cy - dy) - (ay - cy) * (cx - dx)) / den
    u = -((ax - bx) * (ay - cy) - (ay - by) * (ax - cx)) / den
    if t < -1e-9 or t > 1 + 1e-9 or u < -1e-9 or u > 1 + 1e-9:
        return None
    return ax + t * (bx - ax), ay + t * (by - ay)


def _polygon_area_m2(ring_lonlat: list[tuple[float, float]]) -> float:
    """Spherical excess area. ring as [(lon, lat), ...] (not necessarily closed)."""
    if len(ring_lonlat) < 3:
        return 0.0
    pts = ring_lonlat
    n = len(pts)
    total = 0.0
    for i in range(n):
        lon1, lat1 = pts[i]
        lon2, lat2 = pts[(i + 1) % n]
        total += math.radians(lon2 - lon1) * (
            2 + math.sin(math.radians(lat1)) + math.sin(math.radians(lat2))
        )
    return abs(total * R_M * R_M / 2)


def _build_anchors(features: list[dict]) -> list[dict[str, float]]:
    by_km: dict[float, list[tuple[float, float]]] = {}
    for f in features:
        if f["geometry"]["type"] != "Point":
            continue
        name = str((f.get("properties") or {}).get("name") or "")
        m = CHAINAGE_RE.match(name)
        if not m:
            continue
        km = int(m.group(1)) + int(m.group(2)) / 1000
        key = round(km * 1000) / 1000
        lon, lat = f["geometry"]["coordinates"][:2]
        by_km.setdefault(key, []).append((lon, lat))

    # Prefer markers near the densest cluster (on-alignment); for simplicity take first
    # then refine by proximity to median of all markers at that chainage.
    anchors = []
    for km, pts in sorted(by_km.items()):
        if len(pts) == 1:
            lon, lat = pts[0]
        else:
            mx = sum(p[0] for p in pts) / len(pts)
            my = sum(p[1] for p in pts) / len(pts)
            lon, lat = min(pts, key=lambda p: (p[0] - mx) ** 2 + (p[1] - my) ** 2)
        anchors.append({"km": km, "lon": lon, "lat": lat})
    return anchors


def _coord_at(anchors: list[dict[str, float]], km: float) -> tuple[float, float]:
    if km <= anchors[0]["km"]:
        return anchors[0]["lon"], anchors[0]["lat"]
    last = anchors[-1]
    if km >= last["km"]:
        return last["lon"], last["lat"]
    for i in range(len(anchors) - 1):
        a, b = anchors[i], anchors[i + 1]
        if a["km"] <= km <= b["km"]:
            if b["km"] == a["km"]:
                return a["lon"], a["lat"]
            t = (km - a["km"]) / (b["km"] - a["km"])
            return a["lon"] + t * (b["lon"] - a["lon"]), a["lat"] + t * (b["lat"] - a["lat"])
    return last["lon"], last["lat"]


def _bearing_at(anchors: list[dict[str, float]], km: float) -> float:
    a = _coord_at(anchors, max(anchors[0]["km"], km - 0.05))
    b = _coord_at(anchors, min(anchors[-1]["km"], km + 0.05))
    if a == b:
        # fall back to nearest distinct pair
        i = 0
        while i < len(anchors) - 1 and anchors[i]["km"] < km:
            i += 1
        i = max(0, min(i, len(anchors) - 2))
        a = (anchors[i]["lon"], anchors[i]["lat"])
        b = (anchors[i + 1]["lon"], anchors[i + 1]["lat"])
    return _bearing_deg(a[0], a[1], b[0], b[1])


def _outline_edges(features: list[dict]) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    edges = []
    for f in features:
        props = f.get("properties") or {}
        if props.get("folder") != OUTLINE_FOLDER:
            continue
        if f["geometry"]["type"] != "LineString":
            continue
        coords = f["geometry"]["coordinates"]
        for a, b in zip(coords, coords[1:]):
            edges.append(((a[0], a[1]), (b[0], b[1])))
    return edges


def _ray_hit(
    lon: float,
    lat: float,
    bearing: float,
    edges: list[tuple[tuple[float, float], tuple[float, float]]],
    max_m: float,
) -> tuple[float, float, float] | None:
    """Return (lon, lat, dist_m) of nearest outline intersection along bearing."""
    end = _offset(lon, lat, bearing, max_m)
    best = None
    best_d = 1e18
    for e0, e1 in edges:
        hit = _seg_intersect((lon, lat), end, e0, e1)
        if hit is None:
            continue
        d = _haversine_m(lon, lat, hit[0], hit[1])
        if 0.5 < d < best_d:  # ignore hits essentially at origin
            best_d = d
            best = (hit[0], hit[1], d)
    return best


def _outline_ring(features: list[dict]) -> list[tuple[float, float]]:
    """Prefer the longest nearly-closed 236ED8 segment as the RoW ring."""
    cands = [
        f
        for f in features
        if (f.get("properties") or {}).get("folder") == OUTLINE_FOLDER
        and f["geometry"]["type"] == "LineString"
    ]
    if not cands:
        return []
    main = max(cands, key=lambda f: len(f["geometry"]["coordinates"]))
    ring = [(c[0], c[1]) for c in main["geometry"]["coordinates"]]
    if ring and _haversine_m(ring[0][0], ring[0][1], ring[-1][0], ring[-1][1]) > 2:
        ring.append(ring[0])
    elif ring and ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def build(step_km: float = STEP_KM) -> dict[str, Any]:
    data = json.loads(DEMO.read_text(encoding="utf-8"))
    features = data["geojson"]["features"]
    anchors = _build_anchors(features)
    if len(anchors) < 2:
        raise SystemExit("need chainage markers")
    edges = _outline_edges(features)
    if not edges:
        raise SystemExit("no outline edges for Polyline [236ED8]")

    min_km = anchors[0]["km"]
    max_km = anchors[-1]["km"]
    # Sample at step boundaries covering the corridor
    stations: list[float] = []
    km = math.floor(min_km / step_km) * step_km
    while km <= max_km + 1e-9:
        if km >= min_km - 1e-9:
            stations.append(round(km, 3))
        km += step_km
    if not stations or stations[-1] < max_km - 0.05:
        stations.append(round(max_km, 3))

    cuts = []
    for km in stations:
        lon, lat = _coord_at(anchors, km)
        brg = _bearing_at(anchors, km)
        left = _ray_hit(lon, lat, (brg - 90) % 360, edges, SEARCH_M)
        right = _ray_hit(lon, lat, (brg + 90) % 360, edges, SEARCH_M)
        cuts.append(
            {
                "km": km,
                "lon": lon,
                "lat": lat,
                "bearing": brg,
                "left": None
                if left is None
                else {"lon": left[0], "lat": left[1], "dist_m": round(left[2], 1)},
                "right": None
                if right is None
                else {"lon": right[0], "lat": right[1], "dist_m": round(right[2], 1)},
                "width_m": None
                if left is None or right is None
                else round(left[2] + right[2], 1),
            }
        )

    blocks = []
    for i in range(len(cuts) - 1):
        a, b = cuts[i], cuts[i + 1]
        if not (a["left"] and a["right"] and b["left"] and b["right"]):
            continue
        # Sample intermediate left/right along the block for a smoother polygon
        ring: list[tuple[float, float]] = []
        n_mid = max(1, int(round((b["km"] - a["km"]) / 0.25)))
        # left side a → b
        for j in range(n_mid + 1):
            t = j / n_mid
            km = a["km"] + t * (b["km"] - a["km"])
            lon, lat = _coord_at(anchors, km)
            brg = _bearing_at(anchors, km)
            hit = _ray_hit(lon, lat, (brg - 90) % 360, edges, SEARCH_M)
            if hit:
                ring.append((hit[0], hit[1]))
            elif j == 0:
                ring.append((a["left"]["lon"], a["left"]["lat"]))
            elif j == n_mid:
                ring.append((b["left"]["lon"], b["left"]["lat"]))
        # right side b → a
        right_side: list[tuple[float, float]] = []
        for j in range(n_mid + 1):
            t = j / n_mid
            km = b["km"] - t * (b["km"] - a["km"])
            lon, lat = _coord_at(anchors, km)
            brg = _bearing_at(anchors, km)
            hit = _ray_hit(lon, lat, (brg + 90) % 360, edges, SEARCH_M)
            if hit:
                right_side.append((hit[0], hit[1]))
            elif j == 0:
                right_side.append((b["right"]["lon"], b["right"]["lat"]))
            elif j == n_mid:
                right_side.append((a["right"]["lon"], a["right"]["lat"]))
        ring.extend(right_side)
        if len(ring) < 4:
            continue

        area_m2 = _polygon_area_m2(ring)
        length_m = (b["km"] - a["km"]) * 1000
        w0 = a["width_m"] or 0
        w1 = b["width_m"] or 0
        trap_m2 = ((w0 + w1) / 2) * length_m
        # Prefer polygon area; fall back to trapezoid if polygon is degenerate
        use_m2 = area_m2 if area_m2 > 10 else trap_m2

        blocks.append(
            {
                "id": f"LA-{a['km']:.0f}-{b['km']:.0f}",
                "from_km": a["km"],
                "to_km": b["km"],
                "length_m": round(length_m, 1),
                "width_start_m": w0,
                "width_end_m": w1,
                "avg_width_m": round((w0 + w1) / 2, 1),
                "area_m2": round(use_m2, 1),
                "area_ha": round(use_m2 / 10_000, 3),
                "ring": [[lon, lat] for lon, lat in ring],  # GeoJSON order
            }
        )

    outline = _outline_ring(features)
    outline_area_m2 = _polygon_area_m2(outline) if outline else 0.0
    total_ha = sum(b["area_ha"] for b in blocks)

    payload = {
        "title": "Land requirement by chainage",
        "description": (
            "RoW / acquisition outline (Polyline [236ED8]) sliced into chainage "
            f"blocks every {step_km:g} km. Area from perpendicular cuts onto the outline."
        ),
        "source_outline": OUTLINE_FOLDER,
        "step_km": step_km,
        "chainage_min_km": min_km,
        "chainage_max_km": max_km,
        "search_radius_m": SEARCH_M,
        "outline_area_ha": round(outline_area_m2 / 10_000, 2) if outline_area_m2 else None,
        "total_area_ha": round(total_ha, 2),
        "block_count": len(blocks),
        "cuts": [
            {
                "km": c["km"],
                "width_m": c["width_m"],
                "left_m": c["left"]["dist_m"] if c["left"] else None,
                "right_m": c["right"]["dist_m"] if c["right"] else None,
            }
            for c in cuts
        ],
        "blocks": blocks,
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "id": b["id"],
                    "from_km": b["from_km"],
                    "to_km": b["to_km"],
                    "area_ha": b["area_ha"],
                    "avg_width_m": b["avg_width_m"],
                    "length_m": b["length_m"],
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [b["ring"] + [b["ring"][0]]],
                },
            }
            for b in blocks
        ],
    }
    return payload


def main() -> None:
    payload = build(STEP_KM)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Slim file for frontend: keep features + summary, drop bulky ring copies on blocks
    slim_blocks = [
        {k: v for k, v in b.items() if k != "ring"} for b in payload["blocks"]
    ]
    out = {**payload, "blocks": slim_blocks}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT}")
    print(f"blocks: {payload['block_count']}")
    print(f"total area: {payload['total_area_ha']} ha")
    print(f"outline area: {payload['outline_area_ha']} ha")
    if payload["blocks"]:
        b0 = payload["blocks"][0]
        print(
            f"first block {b0['from_km']}-{b0['to_km']} km: "
            f"{b0['area_ha']} ha, avg width {b0['avg_width_m']} m"
        )
        widths = [c["width_m"] for c in payload["cuts"] if c["width_m"] is not None]
        print(f"width samples: n={len(widths)} min={min(widths)} max={max(widths)} med={sorted(widths)[len(widths)//2]}")


if __name__ == "__main__":
    main()
