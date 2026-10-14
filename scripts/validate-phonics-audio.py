#!/usr/bin/env python3
"""Validate the review audio set without external Python dependencies."""
import argparse
import json
import math
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=ROOT / "config" / "phonics-speaker-487.json")
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    output = ROOT / "dist" / "assets" / "audio" / "phonics"
    results, failures = [], []
    for clip in config["clips"]:
        path = output / f"{clip['id']}.wav"
        checks, metrics = {}, {}
        if not path.is_file():
            failures.append(f"missing: {path.name}")
            results.append({"id": clip["id"], "file": path.name, "status": "FAIL", "checks": {"exists": False}})
            continue
        try:
            with wave.open(str(path), "rb") as audio:
                frames, rate = audio.getnframes(), audio.getframerate()
                width, channels = audio.getsampwidth(), audio.getnchannels()
                values = list(__import__("array").array("h", audio.readframes(frames)))
            duration_ms = round(frames / rate * 1000, 1)
            peak = max((abs(value) for value in values), default=0)
            threshold = int(32768 * (10 ** (config["normalization"]["trim_silence_threshold_dbfs"] / 20)))
            silence_ratio = round(sum(abs(value) < threshold for value in values) / max(len(values), 1), 4)
            metrics = {"duration_ms": duration_ms, "sample_rate_hz": rate, "channels": channels, "bit_depth": width * 8, "peak": peak, "silence_ratio": silence_ratio}
            checks = {
                "format": channels == 1 and width == 2 and rate == config["voice"]["sample_rate_hz"],
                "duration": config["qa"]["min_duration_ms"] <= duration_ms <= config["qa"]["max_duration_ms"],
                "not_silent": peak > threshold and silence_ratio <= config["qa"]["max_silence_ratio"],
                "not_clipped": peak < config["qa"]["clip_peak"]
            }
        except (wave.Error, OSError, ValueError) as error:
            checks = {"readable_wav": False}
            metrics = {"error": str(error)}
        status = "PASS" if all(checks.values()) else "FAIL"
        if status == "FAIL":
            failures.append(f"qa: {path.name}")
        results.append({"id": clip["id"], "file": path.name, "status": status, "checks": checks, "metrics": metrics})
    report = {"voice": config["voice"], "summary": {"expected": len(config["clips"]), "passed": len(results) - len(failures), "failed": len(failures)}, "results": results}
    (output / "qa-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    if failures:
        print("\n".join(failures), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
