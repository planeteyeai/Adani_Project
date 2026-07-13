"""
KML/KMZ parsing utilities for GeoVision.

Parses Google-Earth style KML (as exported from AutoCAD / Civil 3D plan & profile
sets) into clean GeoJSON. Handles KMZ (zip) transparently, merges the thousands of
tiny 2-point LineStrings that CAD exporters produce into continuous alignments, and
runs a Douglas-Peucker simplification so the geometry is light enough to render in a
browser.

Preserves inline KML LineStyle colours (AABBGGRR) on each feature.
"""
from __future__ import annotations

import math
import re
import zipfile
from io import BytesIO
from xml.etree import ElementTree as ET

_NS_RE = re.compile(r"\{.*?\}")
_WS_RE = re.compile(r"\s+")


def _localname(tag: str) -> str:
    return _NS_RE.sub("", tag)


def kml_color_to_css(kml_color: str | None) -> str | None:
    """Convert KML AABBGGRR (or RRGGBB) to CSS #rrggbb."""
    if not kml_color:
        return None
    k = kml_color.strip().lstrip("#")
    if len(k) == 6:
        return f"#{k.lower()}"
    if len(k) == 8:
        # AABBGGRR
        r, g, b = k[6:8], k[4:6], k[2:4]
        return f"#{r}{g}{b}".lower()
    return None


def read_kml_bytes(raw: bytes) -> str:
    """Return KML text from raw bytes that may be a .kml or a zipped .kmz."""
    if raw[:2] == b"PK":
        with zipfile.ZipFile(BytesIO(raw)) as zf:
            kml_name = next(
                (n for n in zf.namelist() if n.lower().endswith(".kml")),
                None,
            )
            if kml_name is None:
                raise ValueError("KMZ archive contains no .kml file")
            return zf.read(kml_name).decode("utf-8", errors="replace")
    return raw.decode("utf-8", errors="replace")


def _parse_coord_string(text: str) -> list[list[float]]:
    coords: list[list[float]] = []
    for token in _WS_RE.split(text.strip()):
        if not token:
            continue
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            lon = float(parts[0])
            lat = float(parts[1])
        except ValueError:
            continue
        coords.append([lon, lat])
    return coords


def _iter_elements(root: ET.Element):
    for el in root.iter():
        yield el


def _placemark_style(placemark: ET.Element) -> tuple[str | None, float | None]:
    """Read inline <Style><LineStyle> colour and width from a Placemark."""
    color = None
    width = None
    for el in placemark.iter():
        tag = _localname(el.tag)
        if tag == "color" and el.text and color is None:
            color = kml_color_to_css(el.text.strip())
        if tag == "width" and el.text and width is None:
            try:
                width = float(el.text.strip())
            except ValueError:
                width = None
    return color, width


def _linestrings_in(placemark: ET.Element) -> list[list[list[float]]]:
    """Extract all LineString coordinate lists (direct or inside MultiGeometry)."""
    out: list[list[list[float]]] = []
    for geom in _iter_elements(placemark):
        if _localname(geom.tag) != "LineString":
            continue
        for child in geom:
            if _localname(child.tag) == "coordinates" and child.text:
                pts = _parse_coord_string(child.text)
                if len(pts) >= 2:
                    out.append(pts)
    return out


def parse_kml_geometries(kml_text: str) -> dict:
    """
    Extract line, point and polygon geometries from KML text.

    Returns segments with KMZ stroke colour, folder path, and name preserved.
    """
    root = ET.fromstring(kml_text)

    segments: list[dict] = []
    points: list[dict] = []
    polygons: list[list[list[float]]] = []
    folder_stack: list[str] = []

    def handle_placemark(placemark: ET.Element) -> None:
        name = None
        for child in placemark:
            if _localname(child.tag) == "name" and child.text:
                name = child.text.strip()
                break

        color, width = _placemark_style(placemark)
        folder = " / ".join(folder_stack) if folder_stack else None

        for coords in _linestrings_in(placemark):
            segments.append(
                {
                    "coords": coords,
                    "color": color,
                    "width": width,
                    "name": name,
                    "folder": folder,
                }
            )

        for geom in _iter_elements(placemark):
            ln = _localname(geom.tag)
            if ln == "Point":
                for c in geom:
                    if _localname(c.tag) == "coordinates" and c.text:
                        pts = _parse_coord_string(c.text)
                        if pts:
                            points.append({"name": name, "coordinate": pts[0]})
            elif ln == "Polygon":
                for c in _iter_elements(geom):
                    if _localname(c.tag) == "coordinates" and c.text:
                        ring = _parse_coord_string(c.text)
                        if len(ring) >= 3:
                            polygons.append(ring)

    def walk(node: ET.Element) -> None:
        tag = _localname(node.tag)
        if tag == "Folder":
            folder_name = None
            for child in node:
                if _localname(child.tag) == "name" and child.text:
                    folder_name = child.text.strip()
                    break
            if folder_name:
                folder_stack.append(folder_name)
            for child in node:
                walk(child)
            if folder_name:
                folder_stack.pop()
        elif tag in ("Document", "kml"):
            for child in node:
                walk(child)
        elif tag == "Placemark":
            handle_placemark(node)

    walk(root)

    return {"segments": segments, "points": points, "polygons": polygons}


def merge_segments(segments: list[dict], tol: float = 1e-6) -> list[dict]:
    """
    Merge CAD-exported 2-point segments into continuous polylines.

    Only chains segments that share the same stroke colour so merged lines keep
    a single KMZ colour.
    """
    def key(pt: list[float]) -> tuple[int, int]:
        return (round(pt[0] / tol), round(pt[1] / tol))

    from collections import defaultdict

    # Group by colour (None colours merge together).
    by_color: dict[str | None, list[dict]] = defaultdict(list)
    for seg in segments:
        coords = seg.get("coords") or []
        if len(coords) < 2:
            continue
        by_color[seg.get("color")].append(seg)

    merged: list[dict] = []

    for color, group in by_color.items():
        remaining = [s["coords"] for s in group]
        meta = group[0]

        starts: dict[tuple[int, int], list[int]] = defaultdict(list)
        for idx, seg in enumerate(remaining):
            starts[key(seg[0])].append(idx)

        used = [False] * len(remaining)
        for i, seg in enumerate(remaining):
            if used[i]:
                continue
            used[i] = True
            line = list(seg)
            extended = True
            while extended:
                extended = False
                tail = key(line[-1])
                for j in starts.get(tail, []):
                    if not used[j]:
                        used[j] = True
                        line.extend(remaining[j][1:])
                        extended = True
                        break
            merged.append(
                {
                    "coords": line,
                    "color": color,
                    "width": meta.get("width"),
                    "name": meta.get("name"),
                    "folder": meta.get("folder"),
                }
            )

    return merged


def _perp_distance(pt, start, end) -> float:
    if start == end:
        return math.hypot(pt[0] - start[0], pt[1] - start[1])
    x0, y0 = pt[0], pt[1]
    x1, y1 = start[0], start[1]
    x2, y2 = end[0], end[1]
    num = abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1)
    den = math.hypot(y2 - y1, x2 - x1)
    return num / den if den else 0.0


def simplify(points: list[list[float]], epsilon: float) -> list[list[float]]:
    if len(points) < 3:
        return points
    dmax, index = 0.0, 0
    for i in range(1, len(points) - 1):
        d = _perp_distance(points[i], points[0], points[-1])
        if d > dmax:
            index, dmax = i, d
    if dmax > epsilon:
        left = simplify(points[: index + 1], epsilon)
        right = simplify(points[index:], epsilon)
        return left[:-1] + right
    return [points[0], points[-1]]


def haversine_km(a: list[float], b: list[float]) -> float:
    r = 6371.0088
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlon, dlat = lon2 - lon1, lat2 - lat1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def line_length_km(coords: list[list[float]]) -> float:
    return sum(haversine_km(coords[i], coords[i + 1]) for i in range(len(coords) - 1))


def bounds_of(coords: list[list[float]]) -> list[float]:
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return [min(lons), min(lats), max(lons), max(lats)]


def kml_to_geojson(raw: bytes, simplify_epsilon: float = 0.00003) -> dict:
    """Full pipeline: raw KML/KMZ bytes -> simplified GeoJSON FeatureCollection + stats."""
    kml_text = read_kml_bytes(raw)
    parsed = parse_kml_geometries(kml_text)

    merged = merge_segments(parsed["segments"])
    line_features = []
    all_coords: list[list[float]] = []
    stroke_palette: dict[str, int] = {}

    for seg in merged:
        coords = seg["coords"]
        simplified = simplify(coords, simplify_epsilon) if len(coords) > 2 else coords
        if len(simplified) < 2:
            continue
        length = line_length_km(simplified)
        if length < 0.01:
            continue
        all_coords.extend(simplified)

        stroke = seg.get("color") or "#c026d3"
        stroke_palette[stroke] = stroke_palette.get(stroke, 0) + 1

        props: dict = {
            "kind": "alignment",
            "length_km": round(length, 4),
            "stroke": stroke,
        }
        if seg.get("width") is not None:
            props["stroke_width"] = seg["width"]
        if seg.get("name"):
            props["name"] = seg["name"]
        if seg.get("folder"):
            props["folder"] = seg["folder"]

        line_features.append(
            {
                "type": "Feature",
                "properties": props,
                "geometry": {"type": "LineString", "coordinates": simplified},
            }
        )

    point_features = [
        {
            "type": "Feature",
            "properties": {"kind": "marker", "name": p.get("name") or "Point"},
            "geometry": {"type": "Point", "coordinates": p["coordinate"]},
        }
        for p in parsed["points"]
    ]

    features = line_features + point_features
    fc = {"type": "FeatureCollection", "features": features}

    total_length = round(sum(f["properties"]["length_km"] for f in line_features), 3)
    bounds = bounds_of(all_coords) if all_coords else [0, 0, 0, 0]
    center = (
        [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
        if all_coords
        else [0, 0]
    )

    stats = {
        "total_length_km": total_length,
        "line_count": len(line_features),
        "point_count": len(point_features),
        "bounds": bounds,
        "center": center,
        "stroke_palette": stroke_palette,
    }
    return {"geojson": fc, "stats": stats}
