from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import PIL
from PIL import Image, features


ROOT = Path(__file__).resolve().parents[4]
PNG_DIR = ROOT / "asset-source" / "collection" / "07_vehicle_logo_title" / "png"
WEBP_DIR = ROOT / "asset-source" / "collection" / "07_vehicle_logo_title" / "webp"
DIST_DIR = ROOT / "dist" / "assets" / "collection" / "07_vehicle_logo_title"
MANIFEST = Path(__file__).with_name("formal_webp_manifest.json")

SOURCE_SIZE = (1254, 320)
OUTPUT_SIZE = (640, 163)
RGB_QUALITY = 60
ALPHA_QUALITY = 40


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    sources = sorted(PNG_DIR.glob("*.png"))
    if len(sources) != 20:
        raise RuntimeError(f"expected 20 master PNGs, found {len(sources)}")

    WEBP_DIR.mkdir(parents=True, exist_ok=True)
    DIST_DIR.mkdir(parents=True, exist_ok=True)

    records: list[dict[str, object]] = []
    for source_path in sources:
        with Image.open(source_path) as source:
            if source.size != SOURCE_SIZE or source.mode != "RGBA":
                raise RuntimeError(f"invalid master PNG: {source_path.name} {source.size} {source.mode}")
            if any(source.info.get(key) for key in ("exif", "icc_profile", "xmp", "comment")):
                raise RuntimeError(f"unexpected metadata in {source_path.name}")
            alpha_1_15 = sum(source.getchannel("A").histogram()[1:16])
            if alpha_1_15:
                raise RuntimeError(f"alpha threshold is not clean: {source_path.name} has {alpha_1_15} pixels in alpha 1-15")
            resized = source.resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)

        webp_path = WEBP_DIR / f"{source_path.stem}.webp"
        resized.save(
            webp_path,
            format="WEBP",
            lossless=False,
            quality=RGB_QUALITY,
            alpha_quality=ALPHA_QUALITY,
            method=6,
            exact=False,
        )
        dist_path = DIST_DIR / webp_path.name
        shutil.copyfile(webp_path, dist_path)

        with Image.open(webp_path) as output:
            if output.size != OUTPUT_SIZE or output.mode != "RGBA":
                raise RuntimeError(f"invalid WebP: {webp_path.name} {output.size} {output.mode}")
            if any(output.info.get(key) for key in ("exif", "icc_profile", "xmp", "comment")):
                raise RuntimeError(f"unexpected metadata in {webp_path.name}")
            output.load()

        source_hash = sha256(webp_path)
        dist_hash = sha256(dist_path)
        if source_hash != dist_hash:
            raise RuntimeError(f"SHA-256 mismatch: {webp_path.name}")
        records.append(
            {
                "png": source_path.name,
                "webp": webp_path.name,
                "png_bytes": source_path.stat().st_size,
                "webp_bytes": webp_path.stat().st_size,
                "alpha_1_15": 0,
                "sha256": source_hash,
            }
        )

    expected_webps = {f"{path.stem}.webp" for path in sources}
    for obsolete_png in DIST_DIR.glob("*_vehicle_logo_title.png"):
        obsolete_png.unlink()
    for directory in (WEBP_DIR, DIST_DIR):
        actual = {path.name for path in directory.glob("*.webp")}
        if actual != expected_webps:
            raise RuntimeError(f"unexpected WebP set in {directory}: {sorted(actual ^ expected_webps)}")
    remaining_pngs = sorted(path.name for path in DIST_DIR.glob("*.png"))
    if remaining_pngs:
        raise RuntimeError(f"obsolete dist PNGs remain: {remaining_pngs}")

    manifest = {
        "category": "07_vehicle_logo_title",
        "master_png": {
            "directory": "asset-source/collection/07_vehicle_logo_title/png",
            "count": len(sources),
            "size": list(SOURCE_SIZE),
            "mode": "RGBA",
            "alpha_threshold": "alpha < 16 -> 0",
            "files_with_alpha_1_15": 0,
        },
        "formal_webp": {
            "directory": "asset-source/collection/07_vehicle_logo_title/webp",
            "dist_directory": "dist/assets/collection/07_vehicle_logo_title",
            "count": len(records),
            "size": list(OUTPUT_SIZE),
            "mode": "RGBA",
            "lossless": False,
            "rgb_quality": RGB_QUALITY,
            "alpha_quality": ALPHA_QUALITY,
            "method": 6,
            "resampling": "LANCZOS",
            "exact": False,
            "metadata": "not copied",
            "pillow": PIL.__version__,
            "libwebp": features.version("webp"),
            "total_bytes": sum(record["webp_bytes"] for record in records),
            "asset_source_dist_sha256_matches": len(records),
        },
        "files": records,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"generated and verified {len(records)}/20 WebPs")
    print(f"total WebP bytes: {manifest['formal_webp']['total_bytes']}")


if __name__ == "__main__":
    main()
