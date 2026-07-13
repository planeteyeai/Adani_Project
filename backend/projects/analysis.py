"""
Engineering intelligence derivations for a project.

These functions turn raw alignment geometry into the planning metrics the
dashboard and reports consume: earthwork balance, slope distribution, structure
counts, land-use split and a composite risk score.

The heuristics are deterministic (seeded from geometry) so the same project always
produces the same numbers. In production these would be replaced by real DEM /
raster / remote-sensing analysis, but the shapes of the outputs match what the
frontend expects.
"""
from __future__ import annotations

import hashlib
import math


def _seed_from_stats(stats: dict) -> float:
    key = f"{stats.get('total_length_km')}-{stats.get('center')}"
    h = hashlib.sha256(key.encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def derive_metrics(stats: dict) -> dict:
    schedule_b = stats.get("schedule_b") or {}
    summary = schedule_b.get("summary") or {}
    counts = summary.get("counts") or {}

    length = float(stats.get("design_length_km") or summary.get("centreline_km") or 0)
    if not length:
        length = float(stats.get("total_length_km") or 0) or 1.0
    # Use the drawn-line total as a proxy for design complexity but base primary
    # figures on a realistic centreline length.
    drawn = float(stats.get("total_length_km") or 0) or length
    centreline = length if length <= 60 else min(length, 40.0)
    seed = _seed_from_stats(stats)

    avg_slope = round(1.5 + seed * 6.5, 2)  # % — plains to rolling terrain
    max_elev = round(55 + seed * 40, 1)
    min_elev = round(38 + seed * 8, 1)

    # Earthwork (cubic metres) scaled by centreline.
    cut = round(centreline * (48000 + seed * 22000))
    fill = round(centreline * (52000 + (1 - seed) * 20000))
    borrow = max(0, round(fill - cut * 0.85))
    waste = max(0, round(cut - fill * 0.85))
    balance = cut - fill

    # Structures — use Schedule-B counts when available.
    if counts:
        structures = {
            "underpasses": counts.get("underpasses", 0),
            "overpasses": counts.get("overpasses", 0),
            "interchanges": counts.get("interchanges", 0),
            "culverts": counts.get("culverts", 0),
            "retaining_walls": counts.get("re_walls", 0),
            "elevated_sections": counts.get("elevated_sections", 0),
            "drain_sections": counts.get("drain_sections", 0),
        }
        total_structures = counts.get("total_structures") or sum(structures.values())
    else:
        structures = {
            "bridges": max(1, round(centreline * 0.17)),
            "culverts": max(2, round(centreline * 0.9)),
            "underpasses": max(1, round(centreline * 0.28)),
            "interchanges": max(1, round(centreline * 0.14)),
            "retaining_walls": max(2, round(centreline * 0.6)),
        }
        total_structures = sum(structures.values())

    slope_bands = _normalise(
        {
            "0-5% (Easy)": 0.42 + seed * 0.1,
            "5-10% (Moderate)": 0.3,
            "10-20% (Difficult)": 0.18 - seed * 0.05,
            ">20% (Severe)": 0.1 - seed * 0.05,
        }
    )

    land_use = _normalise(
        {
            "Agriculture": 0.38,
            "Built-up / Urban": 0.22,
            "Barren": 0.14,
            "Water": 0.09,
            "Forest": 0.08,
            "Road / Rail": 0.09,
        }
    )

    risks = {
        "Flood": round(30 + seed * 45),
        "Landslide": round(8 + seed * 20),
        "Water Logging": round(20 + seed * 40),
        "River Crossing": round(15 + (1 - seed) * 35),
        "Utility Conflict": round(25 + seed * 30),
        "Land Acquisition": round(35 + seed * 40),
    }
    risk_score = round(sum(risks.values()) / len(risks))

    cost_cr = round(centreline * (28 + seed * 12), 1)  # INR crore per km ~ elevated corridor

    return {
        "length_km": round(centreline, 2),
        "drawn_line_km": round(drawn, 1),
        "avg_slope_pct": avg_slope,
        "max_elevation_m": max_elev,
        "min_elevation_m": min_elev,
        "earthwork": {
            "cut_m3": cut,
            "fill_m3": fill,
            "borrow_m3": borrow,
            "waste_m3": waste,
            "balance_m3": balance,
        },
        "structures": structures,
        "total_structures": total_structures,
        "slope_bands": slope_bands,
        "land_use": land_use,
        "risks": risks,
        "risk_score": risk_score,
        "estimated_cost_cr": cost_cr,
        "elevation_profile": _elevation_profile(centreline, min_elev, max_elev, seed),
        "schedule_b": schedule_b if schedule_b else None,
    }


def _normalise(d: dict) -> dict:
    total = sum(max(0.0, v) for v in d.values()) or 1.0
    return {k: round(max(0.0, v) / total * 100, 1) for k, v in d.items()}


def _elevation_profile(length_km: float, lo: float, hi: float, seed: float) -> list:
    pts = []
    n = 60
    for i in range(n + 1):
        ch = round(length_km * i / n, 3)
        wave = math.sin(i / 5 + seed * 6) * 0.5 + math.sin(i / 11 + seed * 3) * 0.5
        elev = round(lo + (hi - lo) * (0.5 + 0.4 * wave), 2)
        pts.append({"chainage_km": ch, "ground_level_m": elev})
    return pts
