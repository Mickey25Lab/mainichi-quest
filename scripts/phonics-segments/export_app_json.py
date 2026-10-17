#!/usr/bin/env python3
"""Turn reviewed/fixed segment JSON into the minimal app playback contract."""
from __future__ import annotations
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--input", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
review = json.loads(args.input.read_text(encoding="utf-8"))
unfixed = [segment["id"] for letter in review["letters"] for segment in letter["segments"] if not segment.get("fixed")]
if unfixed:
    raise SystemExit(f"Refusing app export: not FIXed: {', '.join(unfixed)}")
payload = {
    "lessonId": review["lessonId"], "repeatVolume": review["repeatVolume"],
    "sourceId": review["sourceId"],
    "letters": [{"letter": letter["letter"], "segments": [
        {"id": segment["id"], "start": segment["start"], "end": segment["end"]}
        for segment in letter["segments"]
    ]} for letter in review["letters"]],
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(args.output)
