"""Merge Schedule-B data into bundled demo project JSON."""
import json
import os

from projects.schedule_b_parser import parse_schedule_b

sb = parse_schedule_b(os.path.join(os.path.dirname(__file__), "data", "schedule_b.xlsx"))
print("summary:", json.dumps(sb["summary"], indent=2))
print("structures:", len(sb["structures"]))

for target in [
    os.path.join(os.path.dirname(__file__), "projects", "fixtures", "demo_project.json"),
    os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "data", "demo_project.json"),
]:
    with open(target, encoding="utf-8") as f:
        payload = json.load(f)
    payload["stats"]["schedule_b"] = sb
    payload["stats"]["design_length_km"] = sb["summary"]["centreline_km"]
    with open(target, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"))
    print("updated", target)
