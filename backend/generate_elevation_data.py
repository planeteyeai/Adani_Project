"""Generate elevation profile JSON directly from the KMZ chainage markers.

For every chainage marker (e.g. ``23+700``) we take its exact lat/long and look up
the SRTM ground elevation at that point. No interpolation or resampling — the graph
therefore matches the chainage markers shown on the map exactly.
"""
from __future__ import annotations

import json
import math
import os
import re
import urllib.request

DEMO = os.path.join(os.path.dirname(__file__), "projects", "fixtures", "demo_project.json")
OUT = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "public", "Elevation_data_100m_distance.json"
)
API = "https://api.open-elevation.com/api/v1/lookup"
BATCH = 50


def _haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin(
        (lon2 - lon1) * p / 2
    ) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _lines(geojson: dict) -> list[list[list[float]]]:
    return [
        f["geometry"]["coordinates"]
        for f in geojson.get("features", [])
        if f.get("geometry", {}).get("type") == "LineString"
        and len(f["geometry"]["coordinates"]) >= 2
    ]


def _dist_to_lines_m(lon: float, lat: float, lines: list[list[list[float]]]) -> float:
    best = float("inf")
    for c in lines:
        for i in range(len(c) - 1):
            x1, y1 = c[i][0], c[i][1]
            x2, y2 = c[i + 1][0], c[i + 1][1]
            dx, dy = x2 - x1, y2 - y1
            l2 = dx * dx + dy * dy
            t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((lon - x1) * dx + (lat - y1) * dy) / l2))
            d = _haversine_km(lon, lat, x1 + t * dx, y1 + t * dy) * 1000
            if d < best:
                best = d
    return best


def _chainage_markers(geojson: dict) -> list[tuple[float, float, float]]:
    """Sorted (km, lon, lat) picking, per chainage, the marker nearest the alignment."""
    lines = _lines(geojson)
    by_km: dict[float, list[tuple[float, float]]] = {}
    for feat in geojson.get("features", []):
        if feat.get("geometry", {}).get("type") != "Point":
            continue
        m = re.match(r"^(\d+)\+(\d+)$", str(feat.get("properties", {}).get("name", "")))
        if not m:
            continue
        km = round(int(m[1]) + int(m[2]) / 1000, 3)
        lon, lat = feat["geometry"]["coordinates"][:2]
        by_km.setdefault(km, []).append((lon, lat))

    markers: list[tuple[float, float, float]] = []
    for km, pts in by_km.items():
        # keep only chainages that are exact multiples of 100 m
        if round(km * 1000) % 100 != 0:
            continue
        best = min(pts, key=lambda p: _dist_to_lines_m(p[0], p[1], lines))
        markers.append((km, best[0], best[1]))
    markers.sort(key=lambda x: x[0])
    return markers


def _fetch_elevations(samples: list[tuple[float, float, float]]) -> list[float]:
    elevations: list[float] = []
    for i in range(0, len(samples), BATCH):
        batch = samples[i : i + BATCH]
        payload = {"locations": [{"latitude": lat, "longitude": lon} for _, lon, lat in batch]}
        req = urllib.request.Request(
            API,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read())
        elevations.extend(r["elevation"] for r in data["results"])
        print(f"  fetched {min(i + BATCH, len(samples))}/{len(samples)}")
    return elevations


def main() -> None:
    with open(DEMO, encoding="utf-8") as f:
        demo = json.load(f)

    markers = _chainage_markers(demo["geojson"])
    if not markers:
        raise SystemExit("No chainage markers found in demo geojson")

    print(f"Sampling {len(markers)} chainage markers ({markers[0][0]:.3f}–{markers[-1][0]:.3f} km)")
    print("Fetching SRTM elevations from Open-Elevation API…")
    elevations = _fetch_elevations(markers)

    rows = []
    for (km, lon, lat), elev in zip(markers, elevations):
        rows.append(
            {
                "chainage": round(km, 3),
                "elevation": round(float(elev), 2),
                "latitude": round(lat, 6),
                "longitude": round(lon, 6),
                "distance": round(km * 1000, 1),
                "trees": 0,
            }
        )

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(rows, f, separators=(",", ":"))

    elevs = [r["elevation"] for r in rows]
    print(f"wrote {OUT}  ({len(rows)} rows)")
    print(f"elevation range: {min(elevs):.1f} – {max(elevs):.1f} m")


if __name__ == "__main__":
    main()
