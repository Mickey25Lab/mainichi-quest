#!/usr/bin/env python3
"""Generate the first phonics review set with a locked local Piper voice."""
import argparse
import array
import json
import math
import os
import shutil
import subprocess
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def dbfs(value):
    return 20 * math.log10(max(value, 1) / 32768)


def pcm_samples(path):
    with wave.open(str(path), "rb") as source:
        if source.getnchannels() != 1 or source.getsampwidth() != 2:
            raise ValueError(f"{path} must be 16-bit mono WAV before normalization")
        return source.getframerate(), array.array("h", source.readframes(source.getnframes()))


def normalize(source_path, destination_path, sample_rate, normalization, minimum_duration_ms):
    source_rate, samples = pcm_samples(source_path)
    if source_rate != sample_rate:
        raise ValueError(f"{source_path} has {source_rate}Hz; expected {sample_rate}Hz")
    if not samples:
        raise ValueError(f"{source_path} has no samples")
    threshold = int(32768 * (10 ** (normalization["trim_silence_threshold_dbfs"] / 20)))
    audible = [index for index, value in enumerate(samples) if abs(value) >= threshold]
    if not audible:
        raise ValueError(f"{source_path} is silent")
    pad = round(sample_rate * normalization["edge_padding_ms"] / 1000)
    start = max(0, audible[0] - pad)
    end = min(len(samples), audible[-1] + pad + 1)
    trimmed = samples[start:end]
    # Very short stop consonants can begin at frame zero.  Keep a reviewable
    # amount of silence around them rather than failing the duration QA.
    minimum_frames = round(sample_rate * minimum_duration_ms / 1000)
    if len(trimmed) < minimum_frames:
        extra = minimum_frames - len(trimmed)
        leading = extra // 2
        trimmed = array.array("h", [0] * leading) + trimmed + array.array("h", [0] * (extra - leading))
    peak = max(abs(value) for value in trimmed)
    gain = (32768 * (10 ** (normalization["target_peak_dbfs"] / 20))) / peak
    normalized = array.array("h", (max(-32768, min(32767, round(value * gain))) for value in trimmed))
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destination_path), "wb") as destination:
        destination.setnchannels(1)
        destination.setsampwidth(2)
        destination.setframerate(sample_rate)
        destination.writeframes(normalized.tobytes())
    return {"source_peak_dbfs": round(dbfs(peak), 2), "normalized_peak_dbfs": round(dbfs(max(abs(v) for v in normalized)), 2)}


def create_review_clip(single_path, review_path, sample_rate, review):
    """Write the normalized single clip three times, with exact silent gaps."""
    source_rate, single = pcm_samples(single_path)
    if source_rate != sample_rate:
        raise ValueError(f"{single_path} has {source_rate}Hz; expected {sample_rate}Hz")
    repetitions = review["repetitions"]
    gap_frames = round(sample_rate * review["silence_between_ms"] / 1000)
    silence = array.array("h", [0] * gap_frames)
    combined = array.array("h")
    for index in range(repetitions):
        combined.extend(single)
        if index < repetitions - 1:
            combined.extend(silence)
    with wave.open(str(review_path), "wb") as destination:
        destination.setnchannels(1)
        destination.setsampwidth(2)
        destination.setframerate(sample_rate)
        destination.writeframes(combined.tobytes())
    return {"review_file": review_path.name, "review_duration_ms": round(len(combined) / sample_rate * 1000, 1)}


def create_sequence(source_paths, destination_path, sample_rate, comparison):
    """Concatenate distinct clips with a fixed, review-friendly gap."""
    gap_frames = round(sample_rate * comparison["silence_between_ms"] / 1000)
    silence = array.array("h", [0] * gap_frames)
    combined = array.array("h")
    for index, source_path in enumerate(source_paths):
        source_rate, samples = pcm_samples(source_path)
        if source_rate != sample_rate:
            raise ValueError(f"{source_path} has {source_rate}Hz; expected {sample_rate}Hz")
        combined.extend(samples)
        if index < len(source_paths) - 1:
            combined.extend(silence)
    with wave.open(str(destination_path), "wb") as destination:
        destination.setnchannels(1)
        destination.setsampwidth(2)
        destination.setframerate(sample_rate)
        destination.writeframes(combined.tobytes())
    return {"file": destination_path.name, "duration_ms": round(len(combined) / sample_rate * 1000, 1)}


def synthesize_and_normalize(clip, raw, output, piper, model, voice, config):
    command = [piper, "--model", str(model), "--speaker", str(voice["speaker_id"]), "--output_file", str(raw)]
    if "length_scale" in clip:
        command.extend(["--length_scale", str(clip["length_scale"])])
    environment = os.environ.copy()
    # Piper on Windows otherwise inherits cp932 for piped IPA input.
    environment["PYTHONUTF8"] = "1"
    completed = subprocess.run(
        command,
        input=clip["text"] + "\n",
        text=True,
        encoding="utf-8",
        capture_output=True,
        env=environment,
    )
    if completed.returncode:
        raise RuntimeError(f"Piper failed for {clip['id']}: {completed.stderr.strip()}")
    return normalize(raw, output, voice["sample_rate_hz"], config["normalization"], config["qa"]["min_duration_ms"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=ROOT / "config" / "phonics-speaker-487.json")
    parser.add_argument("--piper", default="piper", help="Piper executable or command on PATH")
    parser.add_argument("--model", type=Path, help="Override model path (never downloads a voice automatically)")
    parser.add_argument("--review-only", action="store_true", help="Keep existing normalized single clips and rebuild only _review.wav files")
    parser.add_argument("--preserve-singles", action="store_true", help="Keep existing base single clips while regenerating corrected review candidates and comparisons")
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    voice = config["voice"]
    model = args.model or ROOT / voice["model_path"]
    model = model.resolve()
    if not args.review_only and not model.is_file():
        raise SystemExit(f"Piper voice model is missing: {model}\nSee docs/phonics-audio.md for the local setup command.")
    piper = shutil.which(args.piper) or args.piper
    out_dir = ROOT / "dist" / "assets" / "audio" / "phonics"
    source_dir = ROOT / "asset-source" / "audio" / "phonics" / "libritts-high-speaker-487" / "raw"
    source_dir.mkdir(parents=True, exist_ok=True)
    records = []
    source_paths = {}
    for clip in config["clips"]:
        raw = source_dir / f"{clip['id']}.wav"
        output = out_dir / f"{clip['id']}.wav"
        if args.review_only or args.preserve_singles:
            if not output.is_file():
                raise RuntimeError(f"Cannot preserve missing single clip: {output}")
            single_rate, single = pcm_samples(output)
            if single_rate != voice["sample_rate_hz"]:
                raise RuntimeError(f"Unexpected sample rate in preserved single clip: {output}")
            stats = {"preserved_single": True, "normalized_peak_dbfs": round(dbfs(max(abs(value) for value in single)), 2)}
        else:
            stats = synthesize_and_normalize(clip, raw, output, piper, model, voice, config)
        review_output = out_dir / f"{clip['id']}_review.wav"
        review_stats = create_review_clip(output, review_output, voice["sample_rate_hz"], config["review"])
        records.append({**clip, "file": output.name, "raw_file": str(raw.relative_to(ROOT)).replace("\\", "/"), **stats, **review_stats})
        source_paths[clip["id"]] = output
    corrections = []
    for clip in config.get("corrections", []):
        raw = source_dir / "corrected" / f"{clip['id']}.wav"
        output = out_dir / f"{clip['id']}.wav"
        if args.review_only:
            if not output.is_file():
                raise RuntimeError(f"Cannot preserve missing corrected clip: {output}")
            _, samples = pcm_samples(output)
            stats = {"preserved_single": True, "normalized_peak_dbfs": round(dbfs(max(abs(value) for value in samples)), 2)}
        else:
            raw.parent.mkdir(parents=True, exist_ok=True)
            stats = synthesize_and_normalize(clip, raw, output, piper, model, voice, config)
        review_output = out_dir / f"{clip['id']}_review.wav"
        review_stats = create_review_clip(output, review_output, voice["sample_rate_hz"], config["review"])
        corrections.append({**clip, "file": output.name, "raw_file": str(raw.relative_to(ROOT)).replace("\\", "/"), **stats, **review_stats})
        source_paths[clip["id"]] = output
    comparisons = []
    for sequence in config.get("comparison_sequences", []):
        try:
            inputs = [source_paths[source_id] for source_id in sequence["source_ids"]]
        except KeyError as error:
            raise RuntimeError(f"Unknown comparison source: {error.args[0]}") from error
        comparisons.append({**sequence, **create_sequence(inputs, out_dir / f"{sequence['id']}.wav", voice["sample_rate_hz"], config["comparison"])})
    manifest = {"voice": voice, "normalization": config["normalization"], "review": config["review"], "comparison": config["comparison"], "clips": records, "corrections": corrections, "comparison_sequences": comparisons}
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(records)} clips in {out_dir}")


if __name__ == "__main__":
    main()
