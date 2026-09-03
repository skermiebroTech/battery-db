#!/usr/bin/env python3
"""Rebuild data/batteries.js from data/batteries.csv.

Run this after you edit the CSV:  python3 scripts/build_data.py
The page loads batteries.js as a plain script, so the site works from
GitHub Pages and also when index.html is opened straight from disk.
"""
import csv, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
rows = list(csv.DictReader(open(root / "data" / "batteries.csv", newline="", encoding="utf-8")))
for r in rows:
    r["part_numbers"] = [p.strip() for p in r["part_numbers"].split(";") if p.strip()]
    r["battery_type"] = [p.strip() for p in r["battery_type"].split(";") if p.strip()]
    r["alias"] = [p.strip() for p in r["alias"].split("|") if p.strip()]
    for k in ("wh", "cells"):
        try:
            r[k] = float(r[k]) if "." in r[k] else int(r[k])
        except ValueError:
            r[k] = r[k] or None
js = "window.BATTERIES = " + json.dumps(rows, ensure_ascii=False, indent=1) + ";\n"
(root / "data" / "batteries.js").write_text(js, encoding="utf-8")
print(f"wrote {len(rows)} rows to data/batteries.js")
