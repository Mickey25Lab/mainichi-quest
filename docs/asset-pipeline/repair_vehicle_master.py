"""One-time v1.6 master repair from the official table and source filenames."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from asset_categories import ROOT
from update_asset_progress import FIELDNAMES, MASTER, SOURCE_DIR, status_for, write_validated, PROGRESS_COLUMNS
from asset_categories import CATEGORIES, category_name

SPEC = ROOT / "06_specs" / "asset_pipeline_v1_6.md"
BACKUP = ROOT / "08_backup" / "2026-09-22" / "vehicle_master_before_repair.csv"


def main() -> int:
    if not BACKUP.is_file():
        raise FileNotFoundError(f"Repair requires an untouched backup: {BACKUP}")
    text = SPEC.read_text(encoding="utf-8-sig")
    section = text.split("# 15. 20車種一覧", 1)[1].split("# 16.", 1)[0]
    entries = []
    for line in section.splitlines():
        match = re.fullmatch(r"\|\s*(\d{1,2})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|", line)
        if match:
            entries.append((int(match[1]), match[2].strip(), match[3].strip(), match[4].strip()))
    if len(entries) != 20 or [entry[0] for entry in entries] != list(range(1, 21)):
        raise ValueError("The v1.6 official vehicle table must contain entries 1 through 20")
    sources = sorted(SOURCE_DIR.glob("*_complete.png"))
    if len(sources) != 20:
        raise ValueError(f"Expected 20 source PNGs; found {len(sources)}")
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = []
    for number, ja, en, equipment in entries:
        vehicle_no = f"{number:02d}"
        slug = en.lower().replace(" ", "_")
        filename = f"{vehicle_no}_{en.replace(' ', '_')}_complete.png"
        if not (SOURCE_DIR / filename).is_file():
            raise ValueError(f"Missing source matching official name: {filename}")
        row = dict.fromkeys(FIELDNAMES, "")
        row.update({
            "vehicle_no": vehicle_no, "slug": slug,
            "vehicle_name_ja_reference_only": ja, "vehicle_name_en": en,
            "equipment_name_ja": equipment, "source_filename": filename,
            "status": "not_started", "last_updated": timestamp,
        })
        for folder in CATEGORIES:
            row[f"{category_name(folder)}_status"] = status_for(vehicle_no, slug, folder)
        row["all_assets_complete"] = "YES" if all(row[column] == "fixed" for column in PROGRESS_COLUMNS) else "NO"
        rows.append(row)
    if {path.name for path in sources} != {row["source_filename"] for row in rows}:
        raise ValueError("The 20 source PNGs do not exactly match the official table")
    write_validated(MASTER, rows)
    print(f"Repaired and verified {len(rows)} vehicles: {MASTER}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
