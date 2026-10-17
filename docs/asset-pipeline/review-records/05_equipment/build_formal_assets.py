from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, features
import PIL


ROOT = Path(__file__).resolve().parents[4]
PNG_DIR = ROOT / "asset-source" / "collection" / "05_equipment" / "png"
WEBP_DIR = ROOT / "asset-source" / "collection" / "05_equipment" / "webp"
DIST_DIR = ROOT / "dist" / "assets" / "collection" / "05_equipment"
MANIFEST = Path(__file__).with_name("formal_webp_manifest.json")

SOURCE_SIZE = (1254, 1254)
OUTPUT_SIZE = (640, 640)
RGB_QUALITY = 70
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
                "sha256": source_hash,
            }
        )

    expected_webps = {f"{path.stem}.webp" for path in sources}
    for directory in (WEBP_DIR, DIST_DIR):
        actual = {path.name for path in directory.glob("*.webp")}
        if actual != expected_webps:
            raise RuntimeError(f"unexpected WebP set in {directory}: {sorted(actual ^ expected_webps)}")

    manifest = {
        "category": "05_equipment",
        "master_png": {
            "directory": "asset-source/collection/05_equipment/png",
            "count": len(sources),
            "size": list(SOURCE_SIZE),
            "mode": "RGBA",
        },
        "formal_webp": {
            "directory": "asset-source/collection/05_equipment/webp",
            "dist_directory": "dist/assets/collection/05_equipment",
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
