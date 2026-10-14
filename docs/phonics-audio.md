# フォニックス試作音声（speaker_487）

このディレクトリの初版は、無料・ローカル完結の Piper を使い、`en_US-libritts-high` の **speaker ID 487** を固定して A/B の8クリップだけを生成する。アプリの再生処理にはまだ接続しないため、既存挙動は変わらない。

## 対象と試聴

生成先は `dist/assets/audio/phonics/`。各 WAV をブラウザまたは OS の音声プレーヤーで開き、次の3点だけを確認する。

1. 子どもが真似したくなる声か
2. 音がクリアか
3. phoneme → letter/word が同じ人の声として自然か

| Group | phoneme | letter | words |
| --- | --- | --- | --- |
| A | `/æ/` | `A` | `apple`, `ant` |
| B | `/b/` | `B` | `ball`, `bus` |

## ローカル準備と再生成

Python 環境に Piper を一度だけ入れ、モデルと設定 JSON をローカルに保存する。モデルは Git 管理しない（大容量のため）。

```powershell
python -m pip install piper-tts
New-Item -ItemType Directory -Force asset-source/audio/phonics/models
Invoke-WebRequest https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx -OutFile asset-source/audio/phonics/models/en_US-libritts-high.onnx
Invoke-WebRequest https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx.json -OutFile asset-source/audio/phonics/models/en_US-libritts-high.onnx.json
python scripts/generate-phonics-audio.py
python scripts/validate-phonics-audio.py
```

`config/phonics-speaker-487.json` が voice/model URL、speaker ID、命名、正規化、QA の唯一の正本。`[[æ]]` と `[[b]]` は Piper の phoneme 指定で、letter/word と別クリップとして生成する。

生成器は `asset-source/audio/phonics/libritts-high-speaker-487/raw/` に元 WAV、`dist/assets/audio/phonics/` にトリミング・ピーク正規化済み WAV と manifest を保存する。検証器は欠損、読み取り不可、モノラル/16-bit/22,050Hz、無音、長さ、クリッピングを確認して `qa-report.json` を更新する。
