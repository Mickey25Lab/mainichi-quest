#!/usr/bin/env python3
"""Extract rhythm-first phonics segment candidates from a local MP4.

The scope config deliberately identifies only the letter windows.  Within each
window, boundaries are proposed from low energy, onsets, beats and spectral
flux.  It does not use speech recognition or upload media anywhere.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg
import librosa
import numpy as np


def round_time(value: float) -> float:
    return round(float(value) + 1e-9, 2)


def nearest(values: np.ndarray, target: float) -> float:
    return float(values[np.argmin(np.abs(values - target))]) if len(values) else target


def alternatives(candidates: np.ndarray, center: float, low: float, high: float) -> list[float]:
    valid = [float(value) for value in candidates if low <= value <= high]
    ordered = sorted(valid, key=lambda value: abs(value - center))
    result = [round_time(center)]
    for value in ordered:
        rounded = round_time(value)
        if rounded not in result:
            result.append(rounded)
        if len(result) == 3:
            break
    for offset in (0.03, -0.03, 0.06, -0.06, 0.10, -0.10, 0.14, -0.14):
        rounded = round_time(max(low, min(high, center + offset)))
        if rounded not in result:
            result.append(rounded)
        if len(result) == 3:
            break
    return sorted(result)[:3]


def local_valley(times: np.ndarray, rms: np.ndarray, target: float, radius: float) -> tuple[float, float]:
    mask = (times >= target - radius) & (times <= target + radius)
    if not np.any(mask):
        return target, 0.0
    local_times, local_rms = times[mask], rms[mask]
    index = int(np.argmin(local_rms))
    energy_range = max(float(np.max(rms) - np.min(rms)), 1e-9)
    valley_strength = 1.0 - ((float(local_rms[index]) - float(np.min(rms))) / energy_range)
    return float(local_times[index]), max(0.0, min(1.0, valley_strength))


def extract_audio(video: Path, wav: Path) -> None:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run(
        [ffmpeg, "-y", "-i", str(video), "-vn", "-ac", "1", "-ar", "22050", "-c:a", "pcm_s16le", str(wav)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )


def analyze(video: Path, config: dict, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    wav = output_dir / "analysis-audio.wav"
    extract_audio(video, wav)
    audio, sample_rate = librosa.load(wav, sr=22050, mono=True)
    duration = len(audio) / sample_rate
    hop = 512
    rms = librosa.feature.rms(y=audio, frame_length=2048, hop_length=hop)[0]
    frame_times = librosa.frames_to_time(np.arange(len(rms)), sr=sample_rate, hop_length=hop)
    onset_times = librosa.onset.onset_detect(y=audio, sr=sample_rate, hop_length=hop, units="time", backtrack=True)
    tempo, beat_frames = librosa.beat.beat_track(y=audio, sr=sample_rate, hop_length=hop, trim=False)
    beat_times = librosa.frames_to_time(beat_frames, sr=sample_rate, hop_length=hop)
    stft = np.abs(librosa.stft(audio, hop_length=hop))
    flux = np.maximum(0, np.diff(np.sum(stft, axis=0), prepend=0))
    flux_times = librosa.frames_to_time(np.arange(len(flux)), sr=sample_rate, hop_length=hop)
    high_flux_times = flux_times[flux >= np.percentile(flux, 78)]
    rhythmic_points = np.unique(np.concatenate([onset_times, beat_times, high_flux_times]))

    waveform_hop = max(1, len(audio) // 1800)
    waveform = audio[: (len(audio) // waveform_hop) * waveform_hop].reshape(-1, waveform_hop)
    waveform_peaks = np.maximum(np.abs(waveform.min(axis=1)), np.abs(waveform.max(axis=1)))
    waveform_times = np.arange(len(waveform_peaks)) * waveform_hop / sample_rate
    rhythm_config = config.get("rhythm")
    beats_per_set = int(rhythm_config["beatsPerSet"]) if rhythm_config else None
    anchor_index = None
    if rhythm_config:
        if len(beat_times) == 0:
            raise ValueError("拍グリッドを作れませんでした。beat tracking の結果が空です。")
        anchor = float(rhythm_config.get("firstDownbeatSeconds", beat_times[0]))
        anchor_index = int(np.argmin(np.abs(beat_times - anchor)))
    target_results = []
    metered_set_offset = 0
    for target in config["targets"]:
        if rhythm_config:
            first_beat = anchor_index + metered_set_offset * beats_per_set
            last_beat = first_beat + len(target["sets"]) * beats_per_set
            if last_beat >= len(beat_times):
                raise ValueError(f"{target['letter']} の拍グリッドが動画のbeat tracking範囲を超えました。")
            scope_start, scope_end = float(beat_times[first_beat]), float(beat_times[last_beat])
        else:
            scope_start, scope_end = float(target["scope"]["start"]), float(target["scope"]["end"])
        count = len(target["sets"])
        boundary_meta = []
        if rhythm_config:
            boundary_times = [float(beat_times[first_beat + index * beats_per_set]) for index in range(count + 1)]
            for index in range(count):
                start, end = boundary_times[index], boundary_times[index + 1]
                _, valley_strength = local_valley(frame_times, rms, end, 0.20)
                intervals = np.diff(beat_times[first_beat + index * beats_per_set:first_beat + (index + 1) * beats_per_set + 1])
                stability = 1.0 - min(1.0, float(np.std(intervals) / max(np.mean(intervals), 1e-9)))
                boundary_meta.append({
                    "confidence": round(min(0.97, 0.72 + stability * 0.18 + valley_strength * 0.07), 2),
                    "valleyStrength": round(valley_strength, 3),
                    "beatsPerSet": beats_per_set,
                    "startBeatIndex": first_beat + index * beats_per_set,
                    "endBeatIndex": first_beat + (index + 1) * beats_per_set,
                })
        else:
            boundary_times = [scope_start]
            for index in range(1, count):
                expected = scope_start + (scope_end - scope_start) * index / count
                valley, valley_strength = local_valley(frame_times, rms, expected, min(2.2, (scope_end - scope_start) / count * 0.42))
                snapped = nearest(rhythmic_points, valley)
                if abs(snapped - valley) <= 0.34:
                    suggested = snapped
                    onset_bonus = 0.18
                else:
                    suggested = valley
                    onset_bonus = 0.04
                suggested = max(boundary_times[-1] + 0.6, min(scope_end - 0.6, suggested))
                boundary_times.append(suggested)
                boundary_meta.append({
                    "confidence": round(min(0.95, 0.45 + valley_strength * 0.35 + onset_bonus), 2),
                    "valleyStrength": round(valley_strength, 3),
                })
            boundary_times.append(scope_end)
        segments = []
        for index, set_info in enumerate(target["sets"]):
            start, end = boundary_times[index], boundary_times[index + 1]
            start_candidates = alternatives(rhythmic_points, start, max(scope_start, start - 0.20), min(scope_end, start + 0.20))
            end_candidates = alternatives(rhythmic_points, end, max(scope_start, end - 0.20), min(scope_end, end + 0.20))
            boundary = boundary_meta[index] if index < len(boundary_meta) else {"confidence": 0.68, "valleyStrength": 0.0}
            segments.append({
                "id": set_info["id"], "letter": target["letter"], "label": set_info["label"],
                "start": round_time(start), "end": round_time(end),
                "startAlternatives": start_candidates, "endAlternatives": end_candidates,
                "autoSuggested": True, "manuallyAdjusted": False, "fixed": False,
                "confidence": boundary["confidence"], "evidence": {
                    "valleyStrength": boundary["valleyStrength"],
                    "nearbyOnsets": [round_time(value) for value in onset_times if start - 0.35 <= value <= end + 0.35][:24],
                    "meter": {key: boundary[key] for key in ("beatsPerSet", "startBeatIndex", "endBeatIndex") if key in boundary},
                },
            })
        target_results.append({"letter": target["letter"], "scope": {"start": round_time(scope_start), "end": round_time(scope_end)}, "segments": segments})
        metered_set_offset += count
    result = {
        "schemaVersion": 1, "lessonId": config["lessonId"], "sourceId": config["sourceId"],
        "proposalRevision": config.get("proposalRevision", "default"),
        "sourceVideo": str(video), "sourceAudio": "analysis-audio.wav", "duration": round_time(duration),
        "repeatVolume": config.get("repeatVolume", 40), "analysis": {
            "sampleRate": sample_rate, "tempoBpm": round(float(np.asarray(tempo).item()), 2),
            "methods": ["RMS low-energy valleys", "onset detection", "beat tracking", "spectral flux"],
            "onsets": [round_time(value) for value in onset_times.tolist()],
            "beats": [round_time(value) for value in beat_times.tolist()],
            "meter": {"beatsPerSet": beats_per_set, "anchorBeatIndex": anchor_index} if rhythm_config else None,
        },
        "waveform": {"times": [round_time(value) for value in waveform_times.tolist()], "peaks": [round(float(value), 4) for value in waveform_peaks.tolist()]},
        "letters": target_results,
    }
    (output_dir / "analysis.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--scope", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = analyze(args.video, json.loads(args.scope.read_text(encoding="utf-8")), args.output)
    print(json.dumps({"lessonId": result["lessonId"], "duration": result["duration"], "output": str(args.output / "analysis.json")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
