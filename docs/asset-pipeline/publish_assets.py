"""Publish one explicitly FIXed v1.6 review PNG and update its manifest entry.

Existing FIX destinations are never overwritten automatically.
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from asset_categories import CATEGORIES, COMMON, MATERIAL, ROOT, parse_asset
from convert_webp import convert
from validate_assets import validate

MANIFEST = ROOT / "06_specs" / "asset_manifest.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("category", choices=(*CATEGORIES, COMMON))
    parser.add_argument("filename", help="Review PNG filename")
    parser.add_argument("--fix", action="store_true", required=True,
                        help="Explicitly authorize FIX publication")
    parser.add_argument("--medal-final-review-approved", action="store_true",
                        help="Confirm all 20 medals received final comparison and normalization review")
    args = parser.parse_args()
    parsed = parse_asset(Path(args.filename))
    if args.category == COMMON:
        if args.filename != MATERIAL:
            parser.error("Common asset must be evolution_material.png")
    elif not parsed or parsed[2] != args.category:
        parser.error("Filename does not match the v1.6 category")
    if args.category == "06_medal":
        from asset_categories import asset_filename
        import csv

        with (ROOT / "06_specs/vehicle_master.csv").open(encoding="utf-8-sig", newline="") as file:
            expected = {asset_filename(row["vehicle_no"], row["slug"], "06_medal")
                        for row in csv.DictReader(file)}
        available = {path.name for path in (ROOT / "02_review/06_medal").glob("*.png")}
        if len(expected) != 20 or not expected.issubset(available):
            parser.error("Keep medals in review until all 20 review PNGs exist")
        if not args.medal_final_review_approved:
            parser.error("Medal publication requires --medal-final-review-approved after 20-medal review")

    review = ROOT / "02_review" / args.category / args.filename
    png = ROOT / "03_assets/png" / args.category / args.filename
    webp = ROOT / "03_assets/webp" / args.category / Path(args.filename).with_suffix(".webp")
    if not review.is_file():
        parser.error(f"Review file missing: {review}")
    if png.exists() or webp.exists():
        parser.error("FIX destination already exists; review and back up before replacement")
    result = validate(review, args.category)
    if not result["technical_pass"]:
        parser.error(f"Review file failed technical validation: {result['checks']}")

    data = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    if not isinstance(data, dict):
        parser.error("Manifest must be a JSON object")
    png.parent.mkdir(parents=True, exist_ok=True)
    with review.open("rb") as incoming, png.open("xb") as outgoing:
        shutil.copyfileobj(incoming, outgoing)
    try:
        convert(png, webp)
        entry = {"status": "fixed", "png": png.relative_to(ROOT).as_posix(),
                 "webp": webp.relative_to(ROOT).as_posix(),
                 "fixed_at_utc": datetime.now(timezone.utc).isoformat()}
        if args.category == COMMON:
            data.setdefault("common", {})["evolution_material"] = entry
        else:
            vehicle_key = f"{parsed[0]}_{parsed[1]}"
            data.setdefault(vehicle_key, {})[args.category[3:]] = entry
        backup = ROOT / "08_backup" / datetime.now().strftime("%Y-%m-%d")
        backup.mkdir(parents=True, exist_ok=True)
        if MANIFEST.exists():
            stamp = datetime.now().strftime("%H%M%S%f")
            shutil.copy2(MANIFEST, backup / f"asset_manifest_{stamp}.json")
        updated = MANIFEST.with_suffix(".json.tmp")
        updated.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        updated.replace(MANIFEST)
    except Exception:
        if png.exists():
            png.unlink()
        if webp.exists():
            webp.unlink()
        raise
    print(json.dumps(entry, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
