#!/usr/bin/env python3
"""Place the reusable local review UI next to an analysis.json output."""
from __future__ import annotations
import argparse
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--analysis-dir", type=Path, required=True)
args = parser.parse_args()
template = Path(__file__).with_name("review-template.html")
if not (args.analysis_dir / "analysis.json").exists():
    raise SystemExit("analysis.json is required; run analyze_video.py first")
shutil.copyfile(template, args.analysis_dir / "review.html")
print(args.analysis_dir / "review.html")
