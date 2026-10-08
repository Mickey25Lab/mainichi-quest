"""Build a contact sheet from v1.6 review or FIX PNGs without changing them."""

from __future__ import annotations

import argparse
from pathlib import Path

from asset_categories import CATEGORIES, COMMON, ROOT


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("category", choices=(*CATEGORIES, COMMON))
    parser.add_argument("--fixed", action="store_true", help="Read FIX PNGs for final comparison")
    parser.add_argument("--allow-partial-medals", action="store_true",
                        help="Allow an interim medal sheet with fewer than 20 images")
    parser.add_argument("--output", type=Path, help="New PNG output; never overwritten")
    args = parser.parse_args()
    from PIL import Image, ImageDraw

    base = ROOT / ("03_assets/png" if args.fixed else "02_review") / args.category
    paths = sorted(base.glob("*.png"))
    if not paths:
        parser.error(f"No PNGs in {base}")
    if args.category == "06_medal" and len(paths) != 20 and not args.allow_partial_medals:
        parser.error("Medal comparison requires 20 PNGs; use --allow-partial-medals for an interim sheet")
    output = args.output or (ROOT / "02_review/contact_sheets" /
                             f"{args.category}_{'fixed' if args.fixed else 'review'}.png")
    if output.exists() or output.resolve().is_relative_to((ROOT / "01_source_final").resolve()):
        parser.error("Output already exists or is inside 01_source_final/")
    columns = 5 if args.category in ("01_vehicle", "05_equipment", "06_medal") else 4
    cell_width, cell_height, thumb = 260, 290, 230
    rows = (len(paths) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), "#e7edf5")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(paths):
        with Image.open(path) as opened:
            opened.load()
            item = opened.convert("RGBA")
            item.thumbnail((thumb, thumb), Image.Resampling.LANCZOS)
        x = (index % columns) * cell_width + (cell_width - item.width) // 2
        y = (index // columns) * cell_height + 8
        sheet.alpha_composite(item, (x, y))
        draw.text(((index % columns) * cell_width + 10,
                   (index // columns) * cell_height + 245), path.stem, fill="black")
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("xb") as file:
        sheet.convert("RGB").save(file, "PNG")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
