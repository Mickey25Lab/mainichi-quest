"""Validate Final collection PNGs without changing 01_source_final/.

Exit 0 if all 20 sources pass; exit 1 and print findings otherwise.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import struct
import sys
import zlib
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "06_specs" / "vehicle_master.csv"
SOURCES = ROOT / "01_source_final" / "collection_complete"
REPORT = ROOT / "04_work" / "logs" / "source_validation.json"
SPEC = ROOT / "06_specs" / "asset_pipeline_v1_6.md"
IDS = {f"{n:02d}" for n in range(1, 21)}
REQUIRED_COLUMNS = {"vehicle_no", "slug", "source_filename"}
SLUG = re.compile(r"[a-z]+(?:_[a-z]+)*\Z")
SOURCE_NAME = re.compile(r"(?P<id>\d{2})_(?P<name>[A-Za-z]+(?:_[A-Za-z]+)*)_complete\.png\Z")


def check_png(path: Path) -> tuple[int, int]:
    """Check PNG chunks and verify every decompressed scanline."""
    with path.open("rb") as file:
        if file.read(8) != b"\x89PNG\r\n\x1a\n":
            raise ValueError("invalid PNG signature")
        seen = set()
        decoder = zlib.decompressobj()
        dimensions = (0, 0)
        pixels = bytearray()
        bit_depth = color_type = interlace = 0
        while True:
            size_bytes = file.read(4)
            if len(size_bytes) != 4:
                raise ValueError("missing IEND")
            size = struct.unpack(">I", size_bytes)[0]
            kind = file.read(4)
            data = file.read(size)
            crc_bytes = file.read(4)
            if len(kind) != 4 or len(data) != size or len(crc_bytes) != 4:
                raise ValueError("truncated PNG chunk")
            crc = struct.unpack(">I", crc_bytes)[0]
            if zlib.crc32(data, zlib.crc32(kind)) & 0xFFFFFFFF != crc:
                raise ValueError(f"invalid checksum in {kind!r}")
            if kind == b"IHDR":
                if seen or size != 13 or not all(struct.unpack(">II", data[:8])):
                    raise ValueError("invalid IHDR")
                dimensions = struct.unpack(">II", data[:8])
                bit_depth, color_type, compression, filter_method, interlace = data[8:13]
                allowed = {0: (1, 2, 4, 8, 16), 2: (8, 16),
                           3: (1, 2, 4, 8), 4: (8, 16), 6: (8, 16)}
                if (bit_depth not in allowed.get(color_type, ()) or
                        compression or filter_method or interlace not in (0, 1)):
                    raise ValueError("unsupported or invalid PNG format")
            elif kind == b"IDAT":
                if b"IHDR" not in seen:
                    raise ValueError("IDAT before IHDR")
                pixels.extend(decoder.decompress(data))
            elif kind == b"IEND":
                if size or b"IHDR" not in seen or b"IDAT" not in seen:
                    raise ValueError("invalid IEND")
                pixels.extend(decoder.flush())
                if not decoder.eof or decoder.unused_data or file.read(1):
                    raise ValueError("incomplete or trailing image data")
                break
            seen.add(kind)
        channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color_type]
        passes = ((0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8),
                  (2, 0, 4, 4), (0, 2, 2, 4), (1, 0, 2, 2),
                  (0, 1, 1, 2)) if interlace else ((0, 0, 1, 1),)
        offset = 0
        width, height = dimensions
        for start_x, start_y, step_x, step_y in passes:
            pass_width = max(0, (width - start_x + step_x - 1) // step_x)
            pass_height = max(0, (height - start_y + step_y - 1) // step_y)
            if not pass_width or not pass_height:
                continue
            row_bytes = (pass_width * channels * bit_depth + 7) // 8
            for _ in range(pass_height):
                if offset >= len(pixels) or pixels[offset] > 4:
                    raise ValueError("invalid or missing PNG scanline filter")
                offset += row_bytes + 1
        if offset != len(pixels):
            raise ValueError("PNG scanline data length does not match dimensions")
        return dimensions


def validate() -> dict:
    errors: list[str] = []
    result = {"spec_file": str(SPEC.relative_to(ROOT)),
              "master_file": str(MASTER.relative_to(ROOT)),
              "source_directory": str(SOURCES.relative_to(ROOT)),
              "expected_count": 20, "file_count": 0,
              "files": [], "errors": errors}
    if not SPEC.is_file():
        errors.append(f"正式仕様書がありません: {SPEC}")
    if not MASTER.is_file():
        errors.append(f"車種マスターがありません: {MASTER}")
    if not SOURCES.is_dir():
        errors.append(f"正本フォルダがありません: {SOURCES}")
    if errors:
        return result

    with MASTER.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames or not REQUIRED_COLUMNS.issubset(reader.fieldnames):
            errors.append(f"車種マスターに必須列がありません: {', '.join(sorted(REQUIRED_COLUMNS))}")
            return result
        rows = list(reader)
    if len(rows) != 20:
        errors.append(f"車種マスターの行数が20ではありません: {len(rows)}")

    numbers = Counter()
    slugs = Counter()
    names = Counter()
    expected = set()
    for line, row in enumerate(rows, 2):
        number = (row.get("vehicle_no") or "").strip()
        slug = (row.get("slug") or "").strip()
        filename = (row.get("source_filename") or "").strip()
        numbers[number] += 1
        slugs[slug] += 1
        names[filename.casefold()] += 1
        expected.add(filename)
        if number not in IDS:
            errors.append(f"CSV {line}行: 不正な車種番号 {number!r}")
        if not SLUG.fullmatch(slug):
            errors.append(f"CSV {line}行: 不正なslug {slug!r}")
        match = SOURCE_NAME.fullmatch(filename)
        if not match or match.group("id") != number or match.group("name").lower() != slug:
            errors.append(f"CSV {line}行: 正本ファイル名が番号・slugと一致しません: {filename!r}")
    for number in sorted(IDS - numbers.keys()):
        errors.append(f"車種マスターの欠番: {number}")
    for label, counts in (("車種番号", numbers), ("slug", slugs), ("正本ファイル名", names)):
        for value, count in counts.items():
            if count > 1:
                errors.append(f"CSV内の{label}の重複: {value!r} ({count}件)")

    files = [path for path in SOURCES.iterdir() if path.is_file()]
    result["file_count"] = len(files)
    if len(files) != 20:
        errors.append(f"正本ファイル数が20ではありません: {len(files)}")
    actual = {path.name for path in files}
    for name in sorted(expected - actual):
        errors.append(f"正本がありません: {name}")
    hashes: dict[str, list[str]] = defaultdict(list)
    physical_numbers = Counter()
    for path in sorted(files):
        item = {"filename": path.name, "status": "PASS", "width": None,
                "height": None, "errors": []}
        result["files"].append(item)
        if path.name not in expected:
            item["errors"].append("車種マスターにないファイル")
        match = SOURCE_NAME.fullmatch(path.name)
        if not match:
            item["errors"].append("不正な正本ファイル名")
        else:
            physical_numbers[match.group("id")] += 1
        if path.suffix.lower() != ".png":
            item["errors"].append("PNGファイルではありません")
        else:
            try:
                item["width"], item["height"] = check_png(path)
                hashes[hashlib.sha256(path.read_bytes()).hexdigest()].append(path.name)
            except (OSError, ValueError, zlib.error) as exc:
                item["errors"].append(f"画像を読み込めません: {exc}")
        if item["errors"]:
            item["status"] = "FAIL"
            errors.extend(f"{path.name}: {issue}" for issue in item["errors"])
    for number, count in physical_numbers.items():
        if count > 1:
            errors.append(f"正本ファイルの車種番号が重複: {number} ({count}件)")
    for duplicates in hashes.values():
        if len(duplicates) > 1:
            errors.append(f"内容が重複した正本: {', '.join(duplicates)}")
    return result


def main() -> int:
    try:
        result = validate()
    except (OSError, csv.Error, UnicodeError) as exc:
        result = {"spec_file": str(SPEC.relative_to(ROOT)),
                  "master_file": str(MASTER.relative_to(ROOT)),
                  "source_directory": str(SOURCES.relative_to(ROOT)),
                  "expected_count": 20, "file_count": 0, "files": [],
                  "errors": [f"読み込みエラー: {exc}"]}
    result["checked_at_utc"] = datetime.now(timezone.utc).isoformat()
    result["status"] = "FAIL" if result["errors"] else "PASS"
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"仕様書: {result['spec_file']}")
    print(f"車種マスター: {result['master_file']}")
    print(f"検証対象: {result['file_count']}ファイル")
    for item in result["files"]:
        size = f"{item['width']}x{item['height']}" if item["width"] else "サイズ取得不可"
        print(f"{item['status']}: {item['filename']} ({size})")
    print(f"結果: {result['status']}")
    if result["errors"]:
        for error in result["errors"]:
            print(f"- {error}")
    print(f"JSON: {REPORT}")
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
