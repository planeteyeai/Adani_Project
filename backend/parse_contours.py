"""Parse contour LineStrings from KML into compact GeoJSON for the map."""
from __future__ import annotations

import json
import math
import os
import re
import xml.etree.ElementTree as ET

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")

SOURCES = [
    {
        "src": r"C:\Users\Kunal.Desale\Downloads\1M Interval_contours (1).kml",
        "out": "contours_1m.json",
        "interval_m": 1.0,
        "title": "Contours 1 m",
        "description": "1 metre interval ground contours",
    },
    {
        "src": r"C:\Users\Kunal.Desale\Downloads\0.5M Interval_contours.kml",
        "out": "contours_0_5m.json",
        "interval_m": 0.5,
        "title": "Contours 0.5 m",
        "description": "0.5 metre interval ground contours",
    },
]

_NS_RE = re.compile(r"\{.*?\}")
_WS_RE = re.compile(r"\s+")

# ~2–3 m at this latitude — keeps files manageable for the browser.
SIMPLIFY_TOL = 0.000025


def _localname(tag: str) -> str:
    return _NS_RE.sub("", tag)


def _parse_line(text: str) -> list[list[float]]:
    pts: list[list[float]] = []
    for token in _WS_RE.split(text.strip()):
        if not token:
            continue
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            lon = round(float(parts[0]), 6)
            lat = round(float(parts[1]), 6)
        except ValueError:
            continue
        if pts and pts[-1][0] == lon and pts[-1][1] == lat:
            continue
        pts.append([lon, lat])
    return pts


def _perp_dist(p: list[float], a: list[float], b: list[float]) -> float:
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplify(pts: list[list[float]], tol: float) -> list[list[float]]:
    """Douglas–Peucker polyline simplification."""
    if len(pts) <= 2:
        return pts
    stack = [(0, len(pts) - 1)]
    keep = {0, len(pts) - 1}
    while stack:
        i, j = stack.pop()
        max_d = 0.0
        idx = -1
        a, b = pts[i], pts[j]
        for k in range(i + 1, j):
            d = _perp_dist(pts[k], a, b)
            if d > max_d:
                max_d = d
                idx = k
        if idx >= 0 and max_d > tol:
            keep.add(idx)
            stack.append((i, idx))
            stack.append((idx, j))
    return [pts[i] for i in sorted(keep)]


def _bbox(coords: list[list[float]]) -> list[float]:
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    return [min(xs), min(ys), max(xs), max(ys)]


def _elevation(pm: ET.Element) -> float | None:
    for d in pm.iter():
        if _localname(d.tag) != "SimpleData":
            continue
        name = (d.get("name") or "").upper()
        if name.startswith("ELEV") and d.text:
            try:
                return round(float(d.text.strip()), 2)
            except ValueError:
                continue
    return None


def parse_kml(path: str, interval_m: float, title: str, description: str) -> dict:
    root = ET.parse(path).getroot()
    features: list[dict] = []
    idx = 0
    raw_pts = 0
    out_pts = 0
    elevs: list[float] = []

    for pm in root.iter():
        if _localname(pm.tag) != "Placemark":
            continue
        elev = _elevation(pm)
        for geom in pm.iter():
            if _localname(geom.tag) != "LineString":
                continue
            for child in geom:
                if _localname(child.tag) != "coordinates" or not child.text:
                    continue
                ring = _parse_line(child.text)
                raw_pts += len(ring)
                if len(ring) < 2:
                    continue
                ring = simplify(ring, SIMPLIFY_TOL)
                if len(ring) < 2:
                    continue
                out_pts += len(ring)
                idx += 1
                if elev is not None:
                    elevs.append(elev)
                features.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "id": f"C{interval_m:g}-{idx:04d}",
                            "elevation": elev,
                            "interval_m": interval_m,
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": ring,
                        },
                        # compact helper for canvas culling (non-standard; stripped by Leaflet ok)
                        "bbox": _bbox(ring),
                    }
                )

    return {
        "title": title,
        "description": description,
        "interval_m": interval_m,
        "count": len(features),
        "elev_min": min(elevs) if elevs else None,
        "elev_max": max(elevs) if elevs else None,
        "points_raw": raw_pts,
        "points_simplified": out_pts,
        "type": "FeatureCollection",
        "features": features,
    }


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for cfg in SOURCES:
        data = parse_kml(cfg["src"], cfg["interval_m"], cfg["title"], cfg["description"])
        out = os.path.join(OUT_DIR, cfg["out"])
        with open(out, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))
        size_mb = os.path.getsize(out) / (1024 * 1024)
        print(
            f"{cfg['out']}: {data['count']} lines, "
            f"{data['points_raw']} -> {data['points_simplified']} pts, "
            f"elev {data['elev_min']}–{data['elev_max']} m, {size_mb:.1f} MB"
        )


if __name__ == "__main__":
    main()
