#!/usr/bin/env python3
"""Losslessly recompress PNG IDAT streams while preserving every other chunk."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import zlib
from pathlib import Path

from PIL import Image


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
STRATEGIES = {
    "default": zlib.Z_DEFAULT_STRATEGY,
    "filtered": zlib.Z_FILTERED,
    "rle": zlib.Z_RLE,
    "fixed": zlib.Z_FIXED,
}


def read_chunks(path: Path) -> list[tuple[bytes, bytes, bytes]]:
    data = path.read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError(f"Not a PNG: {path}")
    chunks: list[tuple[bytes, bytes, bytes]] = []
    offset = len(PNG_SIGNATURE)
    while offset < len(data):
        if offset + 12 > len(data):
            raise ValueError(f"Truncated PNG chunk: {path}")
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        chunk_type = data[offset + 4 : offset + 8]
        end = offset + 12 + length
        if end > len(data):
            raise ValueError(f"Truncated PNG payload: {path}")
        payload = data[offset + 8 : offset + 8 + length]
        crc = data[offset + 8 + length : end]
        expected = struct.pack(">I", zlib.crc32(chunk_type + payload) & 0xFFFFFFFF)
        if crc != expected:
            raise ValueError(f"CRC mismatch in {chunk_type!r}: {path}")
        chunks.append((chunk_type, payload, crc))
        offset = end
        if chunk_type == b"IEND":
            break
    if offset != len(data):
        raise ValueError(f"Trailing bytes after IEND: {path}")
    return chunks


def make_chunk(chunk_type: bytes, payload: bytes) -> bytes:
    crc = zlib.crc32(chunk_type + payload) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + chunk_type + payload + struct.pack(">I", crc)


def compress_best(filtered: bytes) -> tuple[bytes, dict[str, int | str]]:
    candidates: list[tuple[int, bytes, int, str]] = []
    for level in range(1, 10):
        for strategy_name, strategy in STRATEGIES.items():
            compressor = zlib.compressobj(
                level=level,
                method=zlib.DEFLATED,
                wbits=zlib.MAX_WBITS,
                memLevel=9,
                strategy=strategy,
            )
            result = compressor.compress(filtered) + compressor.flush()
            candidates.append((len(result), result, level, strategy_name))
    size, result, level, strategy_name = min(candidates, key=lambda item: item[0])
    return result, {"level": level, "strategy": strategy_name, "idat_bytes": size}


def non_idat_signature(chunks: list[tuple[bytes, bytes, bytes]]) -> list[tuple[str, str]]:
    return [
        (chunk_type.decode("ascii"), hashlib.sha256(payload).hexdigest())
        for chunk_type, payload, _ in chunks
        if chunk_type != b"IDAT"
    ]


def optimize(source: Path, destination: Path) -> dict[str, object]:
    before_chunks = read_chunks(source)
    original_idat = b"".join(payload for chunk_type, payload, _ in before_chunks if chunk_type == b"IDAT")
    filtered = zlib.decompress(original_idat)
    optimized_idat, settings = compress_best(filtered)

    output = bytearray(PNG_SIGNATURE)
    wrote_idat = False
    for chunk_type, payload, crc in before_chunks:
        if chunk_type == b"IDAT":
            if not wrote_idat:
                output.extend(make_chunk(b"IDAT", optimized_idat))
                wrote_idat = True
        else:
            output.extend(struct.pack(">I", len(payload)))
            output.extend(chunk_type)
            output.extend(payload)
            output.extend(crc)

    if len(output) >= source.stat().st_size:
        raise RuntimeError(f"Optimization did not reduce size: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(output)

    after_chunks = read_chunks(destination)
    new_idat = b"".join(payload for chunk_type, payload, _ in after_chunks if chunk_type == b"IDAT")
    if zlib.decompress(new_idat) != filtered:
        raise AssertionError("Decompressed PNG scanline bytes changed")
    if non_idat_signature(after_chunks) != non_idat_signature(before_chunks):
        raise AssertionError("Non-IDAT PNG chunks changed")

    with Image.open(source) as before_image, Image.open(destination) as after_image:
        before_rgba = before_image.convert("RGBA")
        after_rgba = after_image.convert("RGBA")
        if before_rgba.size != after_rgba.size:
            raise AssertionError("Image dimensions changed")
        if before_rgba.tobytes() != after_rgba.tobytes():
            raise AssertionError("RGBA pixels changed")
        dimensions = list(before_rgba.size)

    before_size = source.stat().st_size
    after_size = destination.stat().st_size
    return {
        "source": str(source.as_posix()),
        "destination": str(destination.as_posix()),
        "dimensions": dimensions,
        "before_bytes": before_size,
        "after_bytes": after_size,
        "saved_bytes": before_size - after_size,
        "saved_percent": round((before_size - after_size) * 100 / before_size, 2),
        "rgba_identical": True,
        "decompressed_scanlines_identical": True,
        "non_idat_chunks_identical": True,
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "destination_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "compression": settings,
        "chunk_types": [chunk_type.decode("ascii") for chunk_type, _, _ in before_chunks],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    report = optimize(args.source, args.destination)
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
