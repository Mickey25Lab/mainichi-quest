"""Copy legacy five-category assets into v1.6 numbered folders.

Only a manifest entry already marked fixed may become a FIX asset. Review
files stay in review. Originals and 01_source_final/ are never modified.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

from asset_categories import ROOT, asset_filename
from update_asset_progress import update as update_progress

MASTER = ROOT / "06_specs" / "vehicle_master.csv"
MANIFEST = ROOT / "06_specs" / "asset_manifest.json"
LEGACY = {
    "vehicle": "01_vehicle",
    "robot": "02_robot",
    "super_robot": "03_super_robot",
    "equipment": "05_equipment",
    "medal": "06_medal",
}


def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            sha.update(block)
    return sha.hexdigest()


def copy_unchanged(source: Path, destination: Path) -> bool:
    """Copy only to a new destination; accept an identical existing copy."""
    if not source.is_file():
        raise FileNotFoundError(source)
    if destination.exists():
        if not destination.is_file() or digest(source) != digest(destination):
            raise FileExistsError(f"Different destination already exists: {destination}")
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    with source.open("rb") as incoming, destination.open("xb") as outgoing:
        shutil.copyfileobj(incoming, outgoing)
    if digest(source) != digest(destination):
        raise ValueError(f"Copy checksum mismatch: {destination}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vehicle", required=True, help="Two-digit vehicle number")
    args = parser.parse_args()
    with MASTER.open(encoding="utf-8-sig", newline="") as file:
        rows = [row for row in csv.DictReader(file) if row["vehicle_no"] == args.vehicle]
    if len(rows) != 1:
        parser.error("Vehicle must occur exactly once in vehicle_master.csv")
    row = rows[0]
    key = f"{args.vehicle}_{row['slug']}"
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    entries = manifest.get(key, {})
    changes: list[str] = []

    for old_category, new_category in LEGACY.items():
        name = asset_filename(args.vehicle, row["slug"], new_category)
        old_review = ROOT / "02_review" / old_category / name
        new_review = ROOT / "02_review" / new_category / name
        if old_review.is_file() and copy_unchanged(old_review, new_review):
            changes.append(new_review.relative_to(ROOT).as_posix())

        entry = entries.get(old_category)
        if old_category == "medal":
            # v1.6 keeps all medals in review until 20-way comparison.
            continue
        if not isinstance(entry, dict) or entry.get("status") != "fixed":
            continue
        old_png = ROOT / "03_assets/png" / old_category / name
        old_webp = ROOT / "03_assets/webp" / old_category / Path(name).with_suffix(".webp")
        if (entry.get("png") != old_png.relative_to(ROOT).as_posix() or
                entry.get("webp") != old_webp.relative_to(ROOT).as_posix()):
            # Already migrated or nonstandard entry: do not infer FIX status.
            continue
        if not old_png.is_file() or not old_webp.is_file():
            raise FileNotFoundError(f"Manifest says fixed but PNG/WebP is missing: {name}")
        new_png = ROOT / "03_assets/png" / new_category / name
        new_webp = ROOT / "03_assets/webp" / new_category / old_webp.name
        for source, destination in ((old_png, new_png), (old_webp, new_webp)):
            if copy_unchanged(source, destination):
                changes.append(destination.relative_to(ROOT).as_posix())
        entry["png"] = new_png.relative_to(ROOT).as_posix()
        entry["webp"] = new_webp.relative_to(ROOT).as_posix()

    if manifest != json.loads(MANIFEST.read_text(encoding="utf-8")):
        backup_dir = ROOT / "08_backup" / datetime.now().strftime("%Y-%m-%d")
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup = backup_dir / f"asset_manifest_before_v1_6_{args.vehicle}.json"
        if not backup.exists():
            shutil.copy2(MANIFEST, backup)
        temp_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".json",
                                             prefix="asset_manifest_", dir=MANIFEST.parent,
                                             delete=False) as file:
                temp_path = Path(file.name)
                json.dump(manifest, file, ensure_ascii=False, indent=2)
                file.write("\n")
            os.replace(temp_path, MANIFEST)
        finally:
            if temp_path is not None and temp_path.exists():
                temp_path.unlink()
        changes.append(MANIFEST.relative_to(ROOT).as_posix())

    progress, changed_rows = update_progress()
    current = next(row for row in progress if row["vehicle_no"] == args.vehicle)
    print(json.dumps({"vehicle": key, "copied_or_updated": changes,
                      "progress_rows_changed": changed_rows,
                      "statuses": {column: value for column, value in current.items()
                                   if column.endswith("_status") or column == "all_assets_complete"}},
                     ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
