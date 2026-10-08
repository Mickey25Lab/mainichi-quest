"""Mechanically convert a FIX PNG into a same-size WebP with alpha preserved."""

from __future__ import annotations

import argparse
from pathlib import Path

from asset_categories import CATEGORIES, COMMON, MATERIAL, ROOT, parse_asset


def convert(source: Path, destination: Path) -> None:
    from PIL import Image

    if destination.exists() or destination.resolve().is_relative_to((ROOT / "01_source_final").resolve()):
        raise ValueError("Destination exists or is inside 01_source_final/")
    with Image.open(source) as opened:
        if opened.format != "PNG":
            raise ValueError("Source must be a PNG")
        image = opened.convert("RGBA")
        image.load()
    has_transparency = image.getchannel("A").getextrema()[0] < 255
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("xb") as file:
        image.save(file, format="WEBP", lossless=True, exact=True)
    with Image.open(destination) as check:
        check.load()
        output_transparency = ("A" in check.getbands() and
                               check.getchannel("A").getextrema()[0] < 255)
        valid = check.size == image.size and output_transparency == has_transparency
    if not valid:
        destination.unlink()
        raise ValueError("WebP size or transparency verification failed")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("category", choices=(*CATEGORIES, COMMON))
    parser.add_argument("filename", help="FIX PNG filename")
    args = parser.parse_args()
    if args.category == COMMON:
        valid_name = args.filename == MATERIAL
    else:
        parsed = parse_asset(Path(args.filename))
        valid_name = parsed is not None and parsed[2] == args.category
    if not valid_name:
        parser.error("Filename does not match category")
    source = ROOT / "03_assets/png" / args.category / args.filename
    if not source.is_file():
        parser.error(f"FIX PNG missing: {source}")
    destination = ROOT / "03_assets/webp" / args.category / Path(args.filename).with_suffix(".webp")
    convert(source, destination)
    print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
