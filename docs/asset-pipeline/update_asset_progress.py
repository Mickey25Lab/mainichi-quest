"""Refresh only progress columns in the v1.6 vehicle master CSV."""

from __future__ import annotations

import csv
import hashlib
import os
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from asset_categories import CATEGORIES, ROOT, SLUG, asset_filename, category_name

MASTER = ROOT / "06_specs" / "vehicle_master.csv"
BASE_COLUMNS = (
    "vehicle_no", "slug", "vehicle_name_ja_reference_only", "vehicle_name_en",
    "equipment_name_ja", "source_filename", "status",
)
PROGRESS_COLUMNS = tuple(f"{category_name(folder)}_status" for folder in CATEGORIES)
FIELDNAMES = (*BASE_COLUMNS, *PROGRESS_COLUMNS, "all_assets_complete", "last_updated")
SOURCE_DIR = ROOT / "01_source_final" / "collection_complete"


def read_and_validate(path: Path, *, expected_base: list[tuple[str, ...]] | None = None) -> list[dict[str, str]]:
    # csv.reader preserves malformed row widths, which DictReader would conceal.
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.reader(file, strict=True)
        header = next(reader, None)
        if header != list(FIELDNAMES):
            raise ValueError(f"Unexpected CSV header or order in {path}")
        values = list(reader)
    if len(values) != 20:
        raise ValueError(f"Expected 20 vehicle rows; found {len(values)}")
    if any(len(value) != len(FIELDNAMES) for value in values):
        raise ValueError("CSV row width differs from the header")
    rows = [dict(zip(FIELDNAMES, value)) for value in values]
    numbers = [row["vehicle_no"] for row in rows]
    if numbers != [f"{number:02d}" for number in range(1, 21)]:
        raise ValueError("vehicle_no must be unique, ordered, two-digit strings 01 through 20")
    slugs = [row["slug"] for row in rows]
    if len(set(slugs)) != 20 or any(not SLUG.fullmatch(slug) for slug in slugs):
        raise ValueError("Duplicate or invalid slug")
    for row in rows:
        for column in ("vehicle_name_ja_reference_only", "vehicle_name_en", "equipment_name_ja", "source_filename"):
            if not row[column].strip():
                raise ValueError(f"{row['vehicle_no']}: empty {column}")
        source = row["source_filename"]
        if Path(source).name != source or not (SOURCE_DIR / source).is_file():
            raise ValueError(f"{row['vehicle_no']}: missing or invalid source_filename: {source}")
        if not source.startswith(row["vehicle_no"] + "_") or not source.endswith("_complete.png"):
            raise ValueError(f"{row['vehicle_no']}: source_filename does not match vehicle_no")
        if any(row[column] not in {"fixed", "review", "missing"} for column in PROGRESS_COLUMNS):
            raise ValueError(f"{row['vehicle_no']}: invalid progress status")
        expected_complete = "YES" if all(row[column] == "fixed" for column in PROGRESS_COLUMNS) else "NO"
        if row["all_assets_complete"] != expected_complete:
            raise ValueError(f"{row['vehicle_no']}: invalid all_assets_complete")
    if expected_base is not None and [tuple(row[column] for column in BASE_COLUMNS) for row in rows] != expected_base:
        raise ValueError("Basic vehicle information changed during progress update")
    return rows


def write_validated(path: Path, rows: list[dict[str, str]], *, expected_base: list[tuple[str, ...]] | None = None) -> None:
    """Write beside the destination, validate the exact bytes, then atomically replace."""
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8-sig", newline="", suffix=".csv",
            prefix="vehicle_master_", dir=path.parent, delete=False,
        ) as file:
            temp_path = Path(file.name)
            writer = csv.DictWriter(file, fieldnames=FIELDNAMES, lineterminator="\r\n", extrasaction="raise")
            writer.writeheader()
            writer.writerows(rows)
        if temp_path.read_bytes()[:3] != b"\xef\xbb\xbf":
            raise ValueError("Temporary CSV lacks UTF-8 BOM")
        read_and_validate(temp_path, expected_base=expected_base)
        os.replace(temp_path, path)
        temp_path = None
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def status_for(number: str, slug: str, folder: str) -> str:
    filename = asset_filename(number, slug, folder)
    fixed = ROOT / "03_assets" / "png" / folder / filename
    review = ROOT / "02_review" / folder / filename
    if fixed.is_file() and review.is_file():
        # A differing review file is a pending revision of the fixed asset.
        if hashlib.sha256(fixed.read_bytes()).digest() != hashlib.sha256(review.read_bytes()).digest():
            return "review"
    if fixed.is_file():
        return "fixed"
    if review.is_file():
        return "review"
    return "missing"


def update() -> tuple[list[dict[str, str]], int]:
    rows = read_and_validate(MASTER)
    base = [tuple(row[column] for column in BASE_COLUMNS) for row in rows]
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    changed = 0
    for row in rows:
        before = tuple(row[column] for column in (*PROGRESS_COLUMNS, "all_assets_complete"))
        for folder in CATEGORIES:
            row[f"{category_name(folder)}_status"] = status_for(row["vehicle_no"], row["slug"], folder)
        row["all_assets_complete"] = "YES" if all(row[column] == "fixed" for column in PROGRESS_COLUMNS) else "NO"
        after = tuple(row[column] for column in (*PROGRESS_COLUMNS, "all_assets_complete"))
        if before != after or not row["last_updated"]:
            row["last_updated"] = timestamp
            changed += 1
    write_validated(MASTER, rows, expected_base=base)
    return read_and_validate(MASTER, expected_base=base), changed


def main() -> int:
    rows, changed = update()
    print(f"vehicles={len(rows)}, rows_changed={changed}")
    for column in PROGRESS_COLUMNS:
        counts = Counter(row[column] for row in rows)
        print(f"{column}: fixed={counts['fixed']}, review={counts['review']}, missing={counts['missing']}")
    complete = sum(row["all_assets_complete"] == "YES" for row in rows)
    print(f"all_assets_complete: YES={complete}, NO={len(rows) - complete}")
    print(f"CSV: {MASTER.relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
