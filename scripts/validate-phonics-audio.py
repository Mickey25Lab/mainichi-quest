#!/usr/bin/env python3
"""Validate the review audio set without external Python dependencies."""
import argparse
import array
import json
import math
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_wav(path):
    with wave.open(str(path), "rb") as audio:
        frames, rate = audio.getnframes(), audio.getframerate()
        width, channels = audio.getsampwidth(), audio.getnchannels()
        values = array.array("h", audio.readframes(frames))
    return {"frames": frames, "sample_rate_hz": rate, "bit_depth": width * 8, "channels": channels, "values": values}


def metrics_for(audio, threshold):
    values = audio["values"]
    peak = max((abs(value) for value in values), default=0)
    return {
        "duration_ms": round(audio["frames"] / audio["sample_rate_hz"] * 1000, 1),
        "sample_rate_hz": audio["sample_rate_hz"], "channels": audio["channels"],
        "bit_depth": audio["bit_depth"], "peak": peak,
        "silence_ratio": round(sum(abs(value) < threshold for value in values) / max(len(values), 1), 4)
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=ROOT / "config" / "phonics-speaker-487.json")
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    output = ROOT / "dist" / "assets" / "audio" / "phonics"
    results, failures = [], []
    for clip in config["clips"]:
        path = output / f"{clip['id']}.wav"
        review_path = output / f"{clip['id']}_review.wav"
        checks, metrics = {}, {}
        if not path.is_file():
            failures.append(f"missing: {path.name}")
            results.append({"id": clip["id"], "file": path.name, "status": "FAIL", "checks": {"exists": False}})
            continue
        try:
            audio = read_wav(path)
            threshold = int(32768 * (10 ** (config["normalization"]["trim_silence_threshold_dbfs"] / 20)))
            metrics = metrics_for(audio, threshold)
            checks = {
                "format": audio["channels"] == 1 and audio["bit_depth"] == 16 and audio["sample_rate_hz"] == config["voice"]["sample_rate_hz"],
                "duration": config["qa"]["min_duration_ms"] <= metrics["duration_ms"] <= config["qa"]["max_duration_ms"],
                "not_silent": metrics["peak"] > threshold and metrics["silence_ratio"] <= config["qa"]["max_silence_ratio"],
                "not_clipped": metrics["peak"] < config["qa"]["clip_peak"]
            }
        except (wave.Error, OSError, ValueError) as error:
            checks = {"readable_wav": False}
            metrics = {"error": str(error)}
        status = "PASS" if all(checks.values()) else "FAIL"
        if status == "FAIL":
            failures.append(f"qa: {path.name}")
        single_result = {"id": clip["id"], "file": path.name, "status": status, "checks": checks, "metrics": metrics}
        review_checks, review_metrics = {}, {}
        if not review_path.is_file():
            review_checks = {"exists": False}
            failures.append(f"missing: {review_path.name}")
        else:
            try:
                review_audio = read_wav(review_path)
                review_metrics = metrics_for(review_audio, threshold)
                repetitions = config["review"]["repetitions"]
                gap_frames = round(config["voice"]["sample_rate_hz"] * config["review"]["silence_between_ms"] / 1000)
                expected_frames = audio["frames"] * repetitions + gap_frames * (repetitions - 1)
                segments_match = all(
                    review_audio["values"][index * (audio["frames"] + gap_frames): index * (audio["frames"] + gap_frames) + audio["frames"]] == audio["values"]
                    for index in range(repetitions)
                )
                silent_gaps = all(
                    not any(review_audio["values"][audio["frames"] + index * (audio["frames"] + gap_frames): (index + 1) * (audio["frames"] + gap_frames)])
                    for index in range(repetitions - 1)
                )
                review_checks = {
                    "exists": True,
                    "same_format_as_single": review_audio["sample_rate_hz"] == audio["sample_rate_hz"] and review_audio["channels"] == audio["channels"] and review_audio["bit_depth"] == audio["bit_depth"],
                    "three_audio_plays": segments_match,
                    "two_one_second_silent_gaps": silent_gaps,
                    "expected_duration": review_audio["frames"] == expected_frames and review_metrics["duration_ms"] <= config["review"]["max_duration_ms"],
                    "not_zero_length": review_audio["frames"] > 0,
                    "not_clipped": review_metrics["peak"] < config["qa"]["clip_peak"]
                }
            except (wave.Error, OSError, ValueError) as error:
                review_checks = {"readable_wav": False}
                review_metrics = {"error": str(error)}
        review_status = "PASS" if all(review_checks.values()) else "FAIL"
        if review_status == "FAIL":
            failures.append(f"qa: {review_path.name}")
        results.append({"single": single_result, "review": {"id": clip["id"], "file": review_path.name, "status": review_status, "checks": review_checks, "metrics": review_metrics}})
    passed = sum(result["single"]["status"] == "PASS" and result["review"]["status"] == "PASS" for result in results)
    report = {"voice": config["voice"], "review": config["review"], "summary": {"expected_clip_pairs": len(config["clips"]), "passed_clip_pairs": passed, "failed_clip_pairs": len(config["clips"]) - passed}, "results": results}
    (output / "qa-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    if failures:
        print("\n".join(failures), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
