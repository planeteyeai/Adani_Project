"""Generate the bundled demo project GeoJSON from the Digha-Koilwar KML/KMZ."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from projects.kml_utils import kml_to_geojson  # noqa: E402
from projects.schedule_b_parser import parse_schedule_b  # noqa: E402

SRC = os.environ.get(
    "KML_SRC",
    os.path.join(
        os.path.expanduser("~"),
        "Desktop",
        "Adani",
        "kmz_extracted",
        "DIGHA TO KOILWAR P&P FINAL SET TO PRINT 02.07.2025...kml",
    ),
)

SCHEDULE_B = os.environ.get(
    "SCHEDULE_B_SRC",
    os.path.join(os.path.dirname(__file__), "data", "schedule_b.xlsx"),
)


def main() -> None:
    with open(SRC, "rb") as f:
        raw = f.read()
    result = kml_to_geojson(raw, simplify_epsilon=0.00004)

    stats = result["stats"]
    if os.path.exists(SCHEDULE_B):
        schedule_b = parse_schedule_b(SCHEDULE_B)
        stats["schedule_b"] = schedule_b
        stats["design_length_km"] = schedule_b["summary"]["centreline_km"]
        print("schedule_b summary:", json.dumps(schedule_b["summary"], indent=2))
    else:
        print("schedule_b workbook not found — skipping:", SCHEDULE_B)

    out_dirs = [
        os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "data"),
        os.path.join(os.path.dirname(__file__), "projects", "fixtures"),
    ]
    payload = {
        "name": "Digha \u2013 Sherpur \u2013 Koilwar 4-Lane Ganga Path",
        "location": "Patna, Bihar, India",
        "industry": "Highways",
        "geojson": result["geojson"],
        "stats": stats,
    }
    for d in out_dirs:
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, "demo_project.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, separators=(",", ":"))
        size_kb = os.path.getsize(path) / 1024
        print(f"wrote {path}  ({size_kb:.0f} KB)")

    print("stats:", json.dumps({k: v for k, v in stats.items() if k != "schedule_b"}, indent=2))


if __name__ == "__main__":
    main()
