"""Validate a v1.6 PNG asset and optionally copy it to review."""

import argparse
import json
import shutil
import zlib
from datetime import datetime, timezone
from pathlib import Path

from asset_categories import COMMON, MATERIAL, ROOT, parse_asset
from png_inspect import inspect_png


def validate(path: Path, category: str) -> dict:
    checks = {
        "dimensions": False,
        "png": False,
        "rgba": False,
        "alpha_channel": False,
        "transparency": False,
        "file_intact": False,
        "filename": False,
    }
    details = {}
    parsed = parse_asset(path)
    checks["filename"] = (path.name == MATERIAL if category == COMMON else
                          parsed is not None and parsed[2] == category)
    try:
        details = inspect_png(path)
        checks["png"] = True
        width, height = details["size"]
        checks["dimensions"] = ((width, height) == (1400, 1050) if category == "08_background"
                                 else width > 0 and height > 0 if category == COMMON
                                 else (width, height) == (1254, 1254))
        checks["rgba"] = details["mode"] == "RGBA" if category != "08_background" else True
        checks["alpha_channel"] = details["mode"] == "RGBA" if category != "08_background" else True
        checks["file_intact"] = True
        if category == "08_background":
            checks["transparency"] = (details["alpha_range"] is None or
                                       details["alpha_range"] == [255, 255])
        else:
            checks["transparency"] = (details["alpha_range"] is not None and
                                       details["alpha_range"][0] < 255)
    except (OSError, ValueError, zlib.error) as exc:
        details["error"] = str(exc)
    return {"checks": checks, "details": details, "technical_pass": all(checks.values())}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="PNG file to validate")
    parser.add_argument("--category", required=True,
                        choices=("01_vehicle", "02_robot", "03_super_robot",
                                 "04_super_robot_equipped", "05_equipment", "06_medal",
                                 "07_vehicle_logo_title", "08_background", COMMON))
    parser.add_argument("--review", type=Path, help="Copy destination, only if validation passes")
    parser.add_argument("--log", type=Path, required=True, help="JSON validation report")
    args = parser.parse_args()

    result = validate(args.source, args.category)
    if args.review:
        intended = ROOT / "02_review" / args.category / args.source.name
        if args.review.resolve() != intended.resolve():
            parser.error(f"Review destination must be {intended}")
    result.update(
        category=args.category,
        source=str(args.source.resolve()),
        review_destination=str(args.review.resolve()) if args.review else None,
        reviewed=False,
        checked_at=datetime.now(timezone.utc).isoformat(),
    )
    if result["technical_pass"] and args.review:
        try:
            args.review.parent.mkdir(parents=True, exist_ok=True)
            with args.source.open("rb") as source, args.review.open("xb") as target:
                shutil.copyfileobj(source, target)
            result["reviewed"] = True
        except FileExistsError:
            result["copy_error"] = "Review destination already exists; no overwrite performed"
        except OSError as exc:
            result["copy_error"] = str(exc)

    result["status"] = "PASS" if result["technical_pass"] and (not args.review or result["reviewed"]) else "FAIL"
    args.log.parent.mkdir(parents=True, exist_ok=True)
    args.log.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
