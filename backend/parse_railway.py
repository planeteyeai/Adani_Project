"""Parse railway lines, stations, and platforms KMLs into GeoJSON."""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")

SOURCES = [
    {
        "src": r"C:\Users\Kunal.Desale\Downloads\Raiway Lines.kml",
        "out": "railway_lines.json",
        "title": "Railway Lines",
        "description": "Railway track centreline within the project area",
        "geom": "lines",
    },
    {
        "src": r"C:\Users\Kunal.Desale\Downloads\Raiway Stations.kml",
        "out": "railway_stations.json",
        "title": "Railway Stations",
        "description": "Railway station locations",
        "geom": "points",
    },
    {
        "src": r"C:\Users\Kunal.Desale\Downloads\Railway_platforms.kml",
        "out": "railway_platforms.json",
        "title": "Railway Platforms",
        "description": "Railway platform polygons",
        "geom": "polygons",
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
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "id": f"RL-{idx:04d}",
                        "index": idx,
                        "name": props.get("name"),
                        "railway": props.get("railway") or "rail",
                        "usage": props.get("usage"),
                        "electrified": props.get("electrified"),
                        "gauge": props.get("gauge"),
                        "passenger_lines": props.get("passenger_lines"),
                        "maxspeed": props.get("maxspeed"),
                        "osm_id": props.get("osm_id"),
                    },
                    "geometry": {"type": "LineString", "coordinates": ring},
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
                        "id": f"RS-{idx:03d}",
                        "index": idx,
                        "name": props.get("name") or f"Station {idx}",
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
        name = props.get("name") or props.get("ref") or f"Platform {idx}"
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"RP-{idx:03d}",
                    "index": idx,
                    "name": name,
                    "ref": props.get("ref"),
                    "railway": props.get("railway") or "platform",
                    "osm_id": props.get("osm_id"),
                },
                "geometry": {"type": "Polygon", "coordinates": [outer]},
            }
        )
    return features


def parse_kml(path: str, geom: str, title: str, description: str) -> dict:
    root = ET.parse(path).getroot()
    features: list[dict] = []
    for pm in root.iter():
        if _localname(pm.tag) != "Placemark":
            continue
        props = _simple_data(pm)
        if geom == "lines":
            features.extend(_lines(pm, props, len(features)))
        elif geom == "points":
            features.extend(_points(pm, props, len(features)))
        else:
            features.extend(_polygons(pm, props, len(features)))

    return {
        "title": title,
        "description": description,
        "count": len(features),
        "type": "FeatureCollection",
        "features": features,
    }


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for cfg in SOURCES:
        data = parse_kml(cfg["src"], cfg["geom"], cfg["title"], cfg["description"])
        out = os.path.join(OUT_DIR, cfg["out"])
        with open(out, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))
        print(f"{cfg['out']}: {data['count']} features")


if __name__ == "__main__":
    main()
