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
    base_clip_ids = {clip["id"] for clip in config["clips"]}
    threshold = int(32768 * (10 ** (config["normalization"]["trim_silence_threshold_dbfs"] / 20)))
    for clip in config["clips"] + config.get("corrections", []):
        path = output / f"{clip['id']}.wav"
        review_path = output / f"{clip['id']}_review.wav"
        checks, metrics = {}, {}
        if not path.is_file():
            failures.append(f"missing: {path.name}")
            results.append({"id": clip["id"], "file": path.name, "status": "FAIL", "checks": {"exists": False}})
            continue
        try:
            audio = read_wav(path)
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
        results.append({"is_base_clip": clip["id"] in base_clip_ids, "single": single_result, "review": {"id": clip["id"], "file": review_path.name, "status": review_status, "checks": review_checks, "metrics": review_metrics}})
    comparison_results = []
    source_file_by_id = {clip["id"]: output / f"{clip['id']}.wav" for clip in config["clips"] + config.get("corrections", [])}
    for sequence in config.get("comparison_sequences", []):
        path = output / f"{sequence['id']}.wav"
        checks, metrics = {}, {}
        if not path.is_file():
            checks = {"exists": False}
        else:
            try:
                source_audios = [read_wav(source_file_by_id[source_id]) for source_id in sequence["source_ids"]]
                sequence_audio = read_wav(path)
                gap_frames = round(config["voice"]["sample_rate_hz"] * config["comparison"]["silence_between_ms"] / 1000)
                cursor = 0
                source_segments_match = True
                silent_gaps = True
                for index, source_audio in enumerate(source_audios):
                    end = cursor + source_audio["frames"]
                    source_segments_match = source_segments_match and sequence_audio["values"][cursor:end] == source_audio["values"]
                    cursor = end
                    if index < len(source_audios) - 1:
                        silent_gaps = silent_gaps and not any(sequence_audio["values"][cursor:cursor + gap_frames])
                        cursor += gap_frames
                metrics = metrics_for(sequence_audio, threshold)
                checks = {
                    "exists": True,
                    "same_format_as_sources": all(sequence_audio["sample_rate_hz"] == item["sample_rate_hz"] and sequence_audio["channels"] == item["channels"] and sequence_audio["bit_depth"] == item["bit_depth"] for item in source_audios),
                    "three_ordered_audio_segments": source_segments_match,
                    "two_600ms_silent_gaps": silent_gaps,
                    "expected_duration": cursor == sequence_audio["frames"] and metrics["duration_ms"] <= config["comparison"]["max_duration_ms"],
                    "not_zero_length": sequence_audio["frames"] > 0,
                    "not_clipped": metrics["peak"] < config["qa"]["clip_peak"]
                }
            except (KeyError, wave.Error, OSError, ValueError) as error:
                checks = {"readable_wav": False}
                metrics = {"error": str(error)}
        status = "PASS" if all(checks.values()) else "FAIL"
        if status == "FAIL":
            failures.append(f"qa: {path.name}")
        comparison_results.append({"id": sequence["id"], "file": path.name, "display": sequence["display"], "status": status, "checks": checks, "metrics": metrics})
    passed = sum(result["single"]["status"] == "PASS" and result["review"]["status"] == "PASS" for result in results if result["is_base_clip"])
    passed_corrections = sum(result["single"]["status"] == "PASS" and result["review"]["status"] == "PASS" for result in results if not result["is_base_clip"])
    passed_comparisons = sum(result["status"] == "PASS" for result in comparison_results)
    report = {"voice": config["voice"], "review": config["review"], "comparison": config["comparison"], "summary": {"expected_clip_pairs": len(config["clips"]), "passed_clip_pairs": passed, "failed_clip_pairs": len(config["clips"]) - passed, "expected_correction_pairs": len(config.get("corrections", [])), "passed_correction_pairs": passed_corrections, "failed_correction_pairs": len(config.get("corrections", [])) - passed_corrections, "expected_comparisons": len(comparison_results), "passed_comparisons": passed_comparisons, "failed_comparisons": len(comparison_results) - passed_comparisons}, "results": results, "comparison_results": comparison_results}
    (output / "qa-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    if failures:
        print("\n".join(failures), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
