"""Parse transmission line, substation, and tower KMLs into GeoJSON."""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")

SOURCES = [
    {
        "src": r"C:\Users\Kunal.Desale\Downloads\Transmition Line.kml",
        "out": "transmission_lines.json",
        "title": "Transmission Lines",
        "description": "High-voltage transmission lines",
        "geom": "lines",
    },
    {
        "src": os.path.join(os.path.dirname(__file__), "data", "11kv_line.kml"),
        "out": "transmission_11kv.json",
        "title": "11 kV Transmission Line",
        "description": "11 kV distribution line along the corridor",
        "geom": "lines_and_poles",
        "defaults": {"voltage": "11", "power": "line"},
    },
    {
        "src": r"C:\Users\Kunal.Desale\Downloads\substaion.kml",
        "out": "substations.json",
        "title": "Substations",
        "description": "Electrical substation footprints",
        "geom": "polygons",
    },
    {
        "src": r"C:\Users\Kunal.Desale\Downloads\transmition towers.kml",
        "out": "transmission_towers.json",
        "title": "Transmission Towers",
        "description": "Transmission tower locations",
        "geom": "points",
    },
]

_NS_RE = re.compile(r"\{.*?\}")
_WS_RE = re.compile(r"\s+")


def _localname(tag: str) -> str:
    return _NS_RE.sub("", tag)


def _simple_data(pm: ET.Element) -> dict[str, str]:
    props: dict[str, str] = {}
    for d in pm.iter():
        if _localname(d.tag) != "SimpleData":
            continue
        key = d.get("name")
        if key and d.text:
            props[key] = d.text.strip()
    for child in pm:
        if _localname(child.tag) == "name" and child.text:
            props.setdefault("name", child.text.strip())
    return props


def _parse_coords(text: str) -> list[list[float]]:
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


def _lines(pm: ET.Element, props: dict[str, str], start_idx: int) -> list[dict]:
    features: list[dict] = []
    idx = start_idx
    for geom in pm.iter():
        if _localname(geom.tag) != "LineString":
            continue
        for child in geom:
            if _localname(child.tag) != "coordinates" or not child.text:
                continue
            ring = _parse_coords(child.text)
            if len(ring) < 2:
                continue
            idx += 1
            voltage = props.get("voltage")
            label = f"{voltage} kV line" if voltage else "Transmission line"
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "id": f"TL-{idx:03d}",
                        "index": idx,
                        "name": props.get("name") or label,
                        "power": props.get("power") or "line",
                        "kind": "line",
                        "voltage": voltage,
                        "circuits": props.get("circuits"),
                        "cables": props.get("cables"),
                        "osm_id": props.get("osm_id") or props.get("full_id"),
                    },
                    "geometry": {"type": "LineString", "coordinates": ring},
                }
            )
    return features


def _poles(pm: ET.Element, props: dict[str, str], start_idx: int) -> list[dict]:
    """11 kV pole / DP points from the distribution KML."""
    features: list[dict] = []
    idx = start_idx
    for geom in pm.iter():
        if _localname(geom.tag) != "Point":
            continue
        for child in geom:
            if _localname(child.tag) != "coordinates" or not child.text:
                continue
            ring = _parse_coords(child.text)
            if not ring:
                continue
            lon, lat = ring[0]
            idx += 1
            raw_name = (props.get("name") or "").strip()
            label = raw_name if raw_name else f"Pole {idx}"
            if raw_name.upper() in {"P", "POLE"}:
                label = f"Pole {idx}"
            elif raw_name.upper() in {"DP", "D.P."}:
                label = f"DP {idx}"
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "id": f"P11-{idx:03d}",
                        "index": idx,
                        "name": label,
                        "power": "pole",
                        "kind": "pole",
                        "voltage": props.get("voltage") or "11",
                        "osm_id": props.get("osm_id") or props.get("full_id"),
                    },
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                }
            )
    return features


def _points(pm: ET.Element, props: dict[str, str], start_idx: int) -> list[dict]:
    features: list[dict] = []
    idx = start_idx
    for geom in pm.iter():
        if _localname(geom.tag) != "Point":
            continue
        for child in geom:
            if _localname(child.tag) != "coordinates" or not child.text:
                continue
            ring = _parse_coords(child.text)
            if not ring:
                continue
            lon, lat = ring[0]
            idx += 1
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "id": f"TT-{idx:03d}",
                        "index": idx,
                        "name": props.get("name") or f"Tower {idx}",
                        "power": props.get("power") or "tower",
                        "osm_id": props.get("osm_id") or props.get("full_id"),
                    },
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                }
            )
    return features


def _polygons(pm: ET.Element, props: dict[str, str], start_idx: int) -> list[dict]:
    features: list[dict] = []
    idx = start_idx
    for geom in pm.iter():
        if _localname(geom.tag) != "Polygon":
            continue
        outer: list[list[float]] | None = None
        for child in geom:
            if _localname(child.tag) == "outerBoundaryIs":
                for ring_el in child.iter():
                    if _localname(ring_el.tag) == "coordinates" and ring_el.text:
                        outer = _parse_coords(ring_el.text)
                        break
                break
        if outer is None:
            for child in geom.iter():
                if _localname(child.tag) == "coordinates" and child.text:
                    outer = _parse_coords(child.text)
                    break
        if not outer or len(outer) < 3:
            continue
        idx += 1
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"SS-{idx:03d}",
                    "index": idx,
                    "name": props.get("name") or f"Substation {idx}",
                    "power": props.get("power") or "substation",
                    "osm_id": props.get("osm_id") or props.get("full_id"),
                },
                "geometry": {"type": "Polygon", "coordinates": [outer]},
            }
        )
    return features


def parse_kml(
    path: str,
    geom: str,
    title: str,
    description: str,
    defaults: dict[str, str] | None = None,
) -> dict:
    root = ET.parse(path).getroot()
    features: list[dict] = []
    defaults = defaults or {}
    for pm in root.iter():
        if _localname(pm.tag) != "Placemark":
            continue
        props = {**defaults, **_simple_data(pm)}
        if geom == "lines":
            features.extend(_lines(pm, props, len(features)))
        elif geom == "lines_and_poles":
            # Lines first, then poles — separate id prefixes keep counts stable
            line_feats = _lines(pm, props, sum(1 for f in features if f["properties"].get("kind") == "line"))
            features.extend(line_feats)
            pole_start = sum(1 for f in features if f["properties"].get("kind") == "pole")
            features.extend(_poles(pm, props, pole_start))
        elif geom == "points":
            features.extend(_points(pm, props, len(features)))
        else:
            features.extend(_polygons(pm, props, len(features)))

    line_count = sum(1 for f in features if f["geometry"]["type"] == "LineString")
    pole_count = sum(1 for f in features if f["geometry"]["type"] == "Point")
    payload: dict = {
        "title": title,
        "description": description,
        "count": len(features),
        "type": "FeatureCollection",
        "features": features,
    }
    if geom == "lines_and_poles":
        payload["line_count"] = line_count
        payload["pole_count"] = pole_count
        payload["voltage_kv"] = 11
    return payload


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for cfg in SOURCES:
        src = cfg["src"]
        if not os.path.isfile(src):
            print(f"skip {cfg['out']}: missing {src}")
            continue
        data = parse_kml(
            src,
            cfg["geom"],
            cfg["title"],
            cfg["description"],
            cfg.get("defaults"),
        )
        out = os.path.join(OUT_DIR, cfg["out"])
        with open(out, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))
        extra = ""
        if "line_count" in data:
            extra = f" (lines={data['line_count']}, poles={data['pole_count']})"
        print(f"{cfg['out']}: {data['count']} features{extra}")


if __name__ == "__main__":
    main()
