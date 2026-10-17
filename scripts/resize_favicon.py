#!/usr/bin/env python3
"""Create the small, premultiplied-alpha favicon used by the deployed app."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


def resize_rgba(image: Image.Image, size: int) -> Image.Image:
    """Resize without introducing dark/bright halos around transparent pixels."""
    rgba = image.convert("RGBA")
    # Pillow handles RGBA resampling with associated alpha, avoiding color
    # fringes that occur when RGB and alpha are resized independently.
    return rgba.resize((size, size), Image.Resampling.LANCZOS)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--size", type=int, default=64)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    if args.size <= 0:
        raise ValueError("size must be positive")
    with Image.open(args.source) as source:
        output = resize_rgba(source, args.size)
        source_size = list(source.size)
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(args.destination, format="PNG", optimize=True, compress_level=9)

    alpha = output.getchannel("A")
    alpha_values = alpha.get_flattened_data()
    report = {
        "source": args.source.as_posix(),
        "destination": args.destination.as_posix(),
        "source_dimensions": source_size,
        "destination_dimensions": list(output.size),
        "resample": "LANCZOS",
        "mode": output.mode,
        "source_sha256": sha256(args.source),
        "destination_sha256": sha256(args.destination),
        "destination_bytes": args.destination.stat().st_size,
        "has_transparent_pixels": any(value == 0 for value in alpha_values),
        "has_opaque_pixels": any(value == 255 for value in alpha_values),
        "has_partial_alpha": any(0 < value < 255 for value in alpha_values),
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
