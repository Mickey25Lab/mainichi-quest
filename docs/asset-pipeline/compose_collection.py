"""Compose a v1.6 collection image from FIX PNG layers using a shared layout.

This command is read-only unless --output is supplied. It refuses a draft layout,
missing layers, and any source/output path inside 01_source_final/.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from asset_categories import CATEGORIES, COMMON, MATERIAL, ROOT, asset_filename

LAYOUT = ROOT / "06_specs" / "composition_layout.json"
MASTER = ROOT / "06_specs" / "vehicle_master.csv"
FIXED = ROOT / "03_assets" / "png"
SOURCE_ROOT = ROOT / "01_source_final"
REQUIRED_LAYERS = ("08_background", COMMON, "07_vehicle_logo_title", "06_medal",
                   "01_vehicle", "02_robot", "03_super_robot")


def inside(path: Path, folder: Path) -> bool:
    return path.resolve().is_relative_to(folder.resolve())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("vehicle_no", help="Two-digit vehicle number, e.g. 01")
    parser.add_argument("--output", type=Path, required=True,
                        help="New composition PNG path outside 01_source_final/")
    parser.add_argument("--layout", type=Path, default=LAYOUT)
    args = parser.parse_args()

    with MASTER.open(encoding="utf-8-sig", newline="") as file:
        rows = [row for row in csv.DictReader(file) if row["vehicle_no"] == args.vehicle_no]
    if len(rows) != 1:
        parser.error("Vehicle number is absent or duplicated in vehicle_master.csv")
    slug = rows[0]["slug"]
    config = json.loads(args.layout.read_text(encoding="utf-8"))
    if config.get("schema_version") != "1.6" or config.get("status") != "fixed":
        parser.error("composition_layout.json must be reviewed and status set to fixed")
    canvas_config = config.get("canvas", {})
    if (canvas_config.get("width"), canvas_config.get("height")) != (1400, 1050):
        parser.error("v1.6 collection canvas must be 1400x1050")
    layers = config.get("layers", [])
    if tuple(layer.get("category") for layer in layers) != REQUIRED_LAYERS:
        parser.error("Layer order does not match v1.6")
    if inside(args.output, SOURCE_ROOT) or args.output.exists():
        parser.error("Output must be a new file outside 01_source_final/")

    from PIL import Image

    canvas = Image.new("RGBA", (canvas_config["width"], canvas_config["height"]), (0, 0, 0, 0))
    for layer in layers:
        category = layer["category"]
        for key in ("x", "y", "max_width", "max_height"):
            if not isinstance(layer.get(key), int):
                parser.error(f"{category}: {key} is not configured")
        if layer["max_width"] <= 0 or layer["max_height"] <= 0:
            parser.error(f"{category}: maximum size must be positive")
        path = (FIXED / COMMON / MATERIAL if category == COMMON else
                FIXED / category / asset_filename(args.vehicle_no, slug, category))
        if inside(path, SOURCE_ROOT) or not path.is_file():
            parser.error(f"Missing FIX layer: {path}")
        with Image.open(path) as opened:
            if category == "08_background":
                if opened.size != (1400, 1050):
                    parser.error("FIX background must be 1400x1050")
                if "A" in opened.getbands() and opened.getchannel("A").getextrema() != (255, 255):
                    parser.error("FIX background has transparent pixels")
            image = opened.convert("RGBA")
            image.thumbnail((layer["max_width"], layer["max_height"]), Image.Resampling.LANCZOS)
        x, y = layer["x"], layer["y"]
        if x < 0 or y < 0 or x + image.width > canvas.width or y + image.height > canvas.height:
            parser.error(f"{category}: layer is outside the canvas")
        canvas.alpha_composite(image, (x, y))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("xb") as file:
        canvas.save(file, format="PNG")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
