# フォニックス試作音声（speaker_487）

このディレクトリの初版は、無料・ローカル完結の Piper を使い、`en_US-libritts-high` の **speaker ID 487** を固定して A/B の8クリップだけを生成する。アプリの再生処理にはまだ接続しないため、既存挙動は変わらない。

## 対象と試聴

生成先は `dist/assets/audio/phonics/`。試聴ページは各素材の `_review.wav`（同じ正規化済み単発音声を3回、各回の間に1秒無音）を再生する。単発版も残り、補助リンクで確認できる。音素と `ant` は、元の単発素材を保持したまま、長さ・明示 phoneme を調整した `-clear` 候補をレビュー対象にする。次の3点だけを確認する。

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

既存の単発版を残したままレビュー版だけを作り直す場合は、`python scripts/generate-phonics-audio.py --review-only` を使う。通常実行は Piper で単発版を生成・正規化した後にレビュー版を生成する。

`config/phonics-speaker-487.json` が voice/model URL、speaker ID、命名、正規化、QA の唯一の正本。`[[æ]]` と `[[b]]` は Piper の phoneme 指定で、letter/word と別クリップとして生成する。

生成器は `asset-source/audio/phonics/libritts-high-speaker-487/raw/` に元 WAV、`dist/assets/audio/phonics/` にトリミング・ピーク正規化済み単発 WAV と `_review.wav` を保存する。さらに `comparison_sequences` の定義から、音素2回→文字／単語の結合 WAV を生成する（要素間0.6秒）。検証器は単発版とレビュー版の欠損、読み取り不可、モノラル/16-bit/22,050Hz、無音、長さ、クリッピングを確認する。レビュー版は単発版が3回あること、1秒の無音が2か所あること、単発版と形式が一致することも検証し、結合版は3要素の順序・2つの無音区間・形式・長さを検証して `qa-report.json` を更新する。
