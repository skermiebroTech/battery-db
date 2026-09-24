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
    r["charger_part_numbers"] = [p.strip() for p in r.get("charger_part_numbers", "").split(";") if p.strip()]
    # "Keyboard: A, B | Fan: C" -> {"Keyboard": ["A", "B"], "Fan": ["C"]}
    r["replaceable_part_numbers"] = {
        k.strip(): [p.strip() for p in v.split(",") if p.strip()]
        for k, _, v in (x.partition(":") for x in r.get("replaceable_part_numbers", "").split("|") if ":" in x)
    }
    for k in ("wh", "cells", "charger_watts", "ram_slots", "storage_slots"):
        v = r.get(k, "")
        try:
            r[k] = float(v) if "." in v else int(v)
        except ValueError:
            r[k] = v or None
js = "window.BATTERIES = " + json.dumps(rows, ensure_ascii=False, indent=1) + ";\n"
(root / "data" / "batteries.js").write_text(js, encoding="utf-8")
print(f"wrote {len(rows)} rows to data/batteries.js")

# Stamp a content hash on the script URLs in index.html so browsers fetch new
# versions after a deploy instead of serving a cached copy.
import hashlib, re
html_path = root / "index.html"
html = html_path.read_text(encoding="utf-8")
for rel in ("data/batteries.js", "app.js", "styles.css"):
    digest = hashlib.sha1((root / rel).read_bytes()).hexdigest()[:8]
    html = re.sub(r'(["\'])' + re.escape(rel) + r'(\?v=[0-9a-f]+)?(["\'])', r'\g<1>' + rel + "?v=" + digest + r"\g<3>", html)
html_path.write_text(html, encoding="utf-8")
print("stamped script versions in index.html")
