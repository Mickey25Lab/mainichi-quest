"""Dependency-free decoder for 8-bit non-interlaced RGB/RGBA PNG validation."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

SIGNATURE = b"\x89PNG\r\n\x1a\n"


def inspect_png(path: Path) -> dict:
    with path.open("rb") as file:
        if file.read(8) != SIGNATURE:
            raise ValueError("Invalid PNG signature")
        chunks: list[bytes] = []
        width = height = color_type = None
        saw_end = False
        while not saw_end:
            raw_length = file.read(4)
            if len(raw_length) != 4:
                raise ValueError("PNG is missing IEND")
            length = struct.unpack(">I", raw_length)[0]
            kind = file.read(4)
            data = file.read(length)
            checksum = file.read(4)
            if len(kind) != 4 or len(data) != length or len(checksum) != 4:
                raise ValueError("Truncated PNG chunk")
            if (zlib.crc32(data, zlib.crc32(kind)) & 0xFFFFFFFF) != struct.unpack(">I", checksum)[0]:
                raise ValueError(f"Invalid PNG checksum in {kind!r}")
            if kind == b"IHDR":
                if width is not None or length != 13:
                    raise ValueError("Invalid IHDR")
                width, height, depth, color_type, compression, filtering, interlace = struct.unpack(">IIBBBBB", data)
                if (width <= 0 or height <= 0 or depth != 8 or color_type not in (2, 6)
                        or compression or filtering or interlace):
                    raise ValueError("Unsupported PNG format; expected 8-bit RGB/RGBA")
            elif kind == b"IDAT":
                if width is None:
                    raise ValueError("IDAT before IHDR")
                chunks.append(data)
            elif kind == b"IEND":
                if length or not chunks:
                    raise ValueError("Invalid IEND or missing IDAT")
                saw_end = True
        if file.read(1):
            raise ValueError("Data after IEND")

    compressed = b"".join(chunks)
    decoder = zlib.decompressobj()
    raw = decoder.decompress(compressed) + decoder.flush()
    if not decoder.eof or decoder.unused_data:
        raise ValueError("Incomplete or trailing compressed image data")
    channels = 4 if color_type == 6 else 3
    stride = width * channels
    if len(raw) != height * (stride + 1):
        raise ValueError("PNG pixel data length does not match dimensions")

    previous = bytearray(stride)
    alpha_min, alpha_max = 255, 0
    for y in range(height):
        offset = y * (stride + 1)
        filter_type = raw[offset]
        if filter_type > 4:
            raise ValueError("Invalid PNG scanline filter")
        row = bytearray(raw[offset + 1:offset + 1 + stride])
        for i in range(stride):
            left = row[i - channels] if i >= channels else 0
            above = previous[i]
            upper_left = previous[i - channels] if i >= channels else 0
            if filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = above
            elif filter_type == 3:
                predictor = (left + above) // 2
            elif filter_type == 4:
                estimate = left + above - upper_left
                distances = (abs(estimate - left), abs(estimate - above), abs(estimate - upper_left))
                predictor = (left, above, upper_left)[distances.index(min(distances))]
            else:
                predictor = 0
            row[i] = (row[i] + predictor) & 255
        if channels == 4:
            alpha = row[3::4]
            alpha_min = min(alpha_min, min(alpha))
            alpha_max = max(alpha_max, max(alpha))
        previous = row
    return {"format": "PNG", "mode": "RGBA" if channels == 4 else "RGB",
            "size": [width, height],
            "alpha_range": [alpha_min, alpha_max] if channels == 4 else None}
