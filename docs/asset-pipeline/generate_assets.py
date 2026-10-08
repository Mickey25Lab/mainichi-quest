"""Prepare or explicitly execute one v1.6 image edit from a read-only Final image.

Default is a free dry run. --execute makes a paid API request and requires
OPENAI_API_KEY. No FIX, WebP conversion, or application update is performed.
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import shutil
from contextlib import ExitStack
from datetime import datetime, timezone
from pathlib import Path

from asset_categories import CATEGORIES, COMMON, MATERIAL, ROOT, asset_filename, category_name

MASTER = ROOT / "06_specs" / "vehicle_master.csv"
SOURCE_DIR = ROOT / "01_source_final" / "collection_complete"
TEMP = ROOT / "04_work" / "temp"
LOGS = ROOT / "04_work" / "logs"
REVIEW = ROOT / "02_review"

INSTRUCTIONS = {
    "01_vehicle": "Only the vehicle form; retain its colors, shape, face and markings.",
    "02_robot": "Only the normal robot form, without special equipment.",
    "03_super_robot": "Only the super robot body, without Stage 4 equipment.",
    "04_super_robot_equipped": "Only the super robot with its actual special equipment attached.",
    "05_equipment": "Only the actual equipment shown in the reference. Do not infer its shape from its name.",
    "06_medal": "Extract only the target vehicle's medal as currently designed. Keep it in review. Do not normalize, redesign, or treat it as FIX until all 20 medals have been compared together.",
    "07_vehicle_logo_title": "Only the vehicle-specific logo and English vehicle name in the upper-left title style. No Japanese text.",
    "08_background": "Create a complete 4:3 background of the vehicle-specific environment. Remove vehicles, robots, equipment, medal, logo, labels, arrows, medal backlight and ground circles. Fill the whole canvas naturally with no transparent areas, blank bands, seams, or unpainted edges.",
    COMMON: "One shared Evolution Material transparent image containing exactly six elements: the three UI labels のりもの, ロボット, スーパーロボット; two blue evolution arrows; and the medal backlight. Keep their relative positions fixed. No vehicle-specific design or ground circles.",
}


def vehicle_row(number: str) -> dict:
    with MASTER.open(encoding="utf-8-sig", newline="") as file:
        matches = [row for row in csv.DictReader(file) if row["vehicle_no"] == number]
    if len(matches) != 1:
        raise ValueError("Vehicle number must occur exactly once in vehicle_master.csv")
    return matches[0]


def prompt_for(row: dict, category: str) -> str:
    if category == "08_background":
        return ("Edit the attached Final collection image as the sole design reference. "
                f"{INSTRUCTIONS[category]} Match its world, palette, lighting and perspective. "
                "Leave safe margins for center cropping to 1400x1050. No text or UI. "
                f"Vehicle theme: {row['vehicle_name_en']}.")
    if category == COMMON:
        return ("Use the attached Final collection image as a placement and style reference. "
                f"{INSTRUCTIONS[category]} One transparent overlay for all 20 vehicles. "
                "No background or other objects.")
    return ("Edit the attached Final collection image as the sole design reference. "
            f"Extract or reconstruct this asset: {INSTRUCTIONS[category]} "
            "Match the visible colors, face, shape and distinctive details. "
            "One isolated asset, centered, fully visible. No added decoration, background objects, "
            "UI frame, watermark or unrelated text. Transparent background where applicable. "
            f"Vehicle: {row['vehicle_name_en']}. Category: {category_name(category) if category != COMMON else COMMON}.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("vehicle_no", help="01 through 20")
    parser.add_argument("category", choices=(*CATEGORIES, COMMON))
    parser.add_argument("--execute", action="store_true", help="Make one paid API image edit")
    parser.add_argument("--size", help="API size; default 1264x1264, or 1408x1056 for background")
    args = parser.parse_args()
    row = vehicle_row(args.vehicle_no)
    source = SOURCE_DIR / row["source_filename"]
    if not source.is_file():
        parser.error(f"Source Final not found: {source}")
    name = MATERIAL if args.category == COMMON else asset_filename(args.vehicle_no, row["slug"], args.category)
    prompt = prompt_for(row, args.category)
    reference_paths = [source]
    api_size = args.size or ("1408x1056" if args.category == "08_background" else "1264x1264")
    plan = {"spec": "06_specs/asset_pipeline_v1_6.md", "source": str(source),
            "reference_images": [str(path) for path in reference_paths],
            "category": args.category, "output_name": name, "prompt": prompt,
            "api_size": api_size, "model": "gpt-image-2.5-sunburst"}
    if not args.execute:
        print(json.dumps({**plan, "status": "DRY_RUN_NO_API_CALL"}, ensure_ascii=False, indent=2))
        return 0
    if not os.environ.get("OPENAI_API_KEY"):
        parser.error("OPENAI_API_KEY is not set")

    from openai import OpenAI
    from PIL import Image
    from validate_assets import validate

    raw_path = TEMP / f"{Path(name).stem}_api_raw.png"
    final_path = TEMP / name
    review_path = REVIEW / args.category / name
    if any(path.exists() for path in (raw_path, final_path, review_path)):
        parser.error("A temp or review destination already exists; refusing overwrite")
    TEMP.mkdir(parents=True, exist_ok=True)
    LOGS.mkdir(parents=True, exist_ok=True)
    response = None
    try:
        with ExitStack() as stack:
            inputs = [stack.enter_context(path.open("rb")) for path in reference_paths]
            response = OpenAI().images.edit(
                model=plan["model"], image=inputs, prompt=prompt, size=api_size,
                background="opaque" if args.category == "08_background" else "transparent",
                output_format="png", n=1,
            )
        if not response.data or not response.data[0].b64_json:
            raise ValueError("API returned no image data")
        raw_path.write_bytes(base64.b64decode(response.data[0].b64_json, validate=True))
        with Image.open(raw_path) as opened:
            opened.load()
            image = opened.convert("RGBA")
            if args.category == "08_background":
                if image.width < 1400 or image.height < 1050:
                    raise ValueError("API background is smaller than 1400x1050")
                left = (image.width - 1400) // 2
                top = (image.height - 1050) // 2
                image = image.crop((left, top, left + 1400, top + 1050))
            elif args.category != COMMON:
                image = image.resize((1254, 1254), Image.Resampling.LANCZOS)
            with final_path.open("xb") as output:
                image.save(output, format="PNG")
        result = validate(final_path, args.category)
        if result["technical_pass"]:
            review_path.parent.mkdir(parents=True, exist_ok=True)
            with final_path.open("rb") as incoming, review_path.open("xb") as outgoing:
                shutil.copyfileobj(incoming, outgoing)
        report = {**plan, "status": "REVIEW" if result["technical_pass"] else "FAIL",
                  "raw": str(raw_path), "temp": str(final_path),
                  "review": str(review_path) if result["technical_pass"] else None,
                  "validation": result, "checked_at_utc": datetime.now(timezone.utc).isoformat()}
    except Exception as exc:
        report = {**plan, "status": "FAIL", "error": str(exc),
                  "checked_at_utc": datetime.now(timezone.utc).isoformat()}
    log = LOGS / f"{Path(name).stem}_generation.json"
    log.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "REVIEW" else 1


if __name__ == "__main__":
    raise SystemExit(main())
