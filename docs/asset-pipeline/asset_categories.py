"""Shared v1.6 category and filename rules."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATEGORIES = (
    "01_vehicle", "02_robot", "03_super_robot", "04_super_robot_equipped",
    "05_equipment", "06_medal", "07_vehicle_logo_title", "08_background",
)
COMMON = "common"
MATERIAL = "evolution_material.png"
SLUG = re.compile(r"[a-z]+(?:_[a-z]+)*\Z")


def category_name(folder: str) -> str:
    if folder not in CATEGORIES:
        raise ValueError(f"Unknown category: {folder}")
    return folder[3:]


def asset_filename(number: str, slug: str, folder: str, suffix: str = ".png") -> str:
    if not re.fullmatch(r"(?:0[1-9]|1[0-9]|20)", number) or not SLUG.fullmatch(slug):
        raise ValueError("Invalid vehicle number or slug")
    if suffix not in (".png", ".webp"):
        raise ValueError("Invalid asset suffix")
    return f"{number}_{slug}_{category_name(folder)}{suffix}"


def parse_asset(path: Path) -> tuple[str, str, str] | None:
    name = path.name
    # Match the most specific suffix first (super_robot_equipped before robot).
    for folder in sorted(CATEGORIES, key=lambda item: len(category_name(item)), reverse=True):
        category = category_name(folder)
        match = re.fullmatch(rf"(0[1-9]|1[0-9]|20)_([a-z]+(?:_[a-z]+)*)_{category}\.(?:png|webp)", name)
        if match:
            return match.group(1), match.group(2), folder
    return None
