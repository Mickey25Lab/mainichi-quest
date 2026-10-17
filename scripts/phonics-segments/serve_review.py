#!/usr/bin/env python3
"""Serve the repository root so review.html can load the source MP4 safely."""
from __future__ import annotations
import argparse
import http.server
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=4180)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
handler = lambda *items, **kwargs: http.server.SimpleHTTPRequestHandler(*items, directory=root, **kwargs)
print(f"Open http://127.0.0.1:{args.port}/review/phonics-segments/abc-phonics-chant-az-tora-teacher/review.html")
http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler).serve_forever()
