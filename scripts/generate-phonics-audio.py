#!/usr/bin/env python3
"""Generate the first phonics review set with a locked local Piper voice."""
import argparse
import array
import json
import math
import os
import shutil
import struct
import subprocess
import sys
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=ROOT / "config" / "phonics-speaker-487.json")
    parser.add_argument("--piper", default="piper", help="Piper executable or command on PATH")
    parser.add_argument("--model", type=Path, help="Override model path (never downloads a voice automatically)")
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    voice = config["voice"]
    model = args.model or ROOT / voice["model_path"]
    model = model.resolve()
    if not model.is_file():
        raise SystemExit(f"Piper voice model is missing: {model}\nSee docs/phonics-audio.md for the local setup command.")
    piper = shutil.which(args.piper) or args.piper
    out_dir = ROOT / "dist" / "assets" / "audio" / "phonics"
    source_dir = ROOT / "asset-source" / "audio" / "phonics" / "libritts-high-speaker-487" / "raw"
    source_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for clip in config["clips"]:
        raw = source_dir / f"{clip['id']}.wav"
        output = out_dir / f"{clip['id']}.wav"
        command = [piper, "--model", str(model), "--speaker", str(voice["speaker_id"]), "--output_file", str(raw)]
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
        stats = normalize(raw, output, voice["sample_rate_hz"], config["normalization"], config["qa"]["min_duration_ms"])
        records.append({**clip, "file": output.name, "raw_file": str(raw.relative_to(ROOT)).replace("\\", "/"), **stats})
    manifest = {"voice": voice, "normalization": config["normalization"], "clips": records}
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(records)} clips in {out_dir}")


if __name__ == "__main__":
    main()
