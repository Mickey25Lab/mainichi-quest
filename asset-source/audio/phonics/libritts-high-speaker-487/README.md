# Source record: LibriTTS high speaker 487

- Engine: Piper (local CLI)
- Voice model: `en_US-libritts-high`
- Locked speaker: `487`
- Upstream model: https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/libritts/high

`raw/` is created by `scripts/generate-phonics-audio.py` and intentionally contains the unnormalized local source WAVs. The model (`asset-source/audio/phonics/models/`) is downloaded locally and ignored by Git because it is a third-party binary asset.
