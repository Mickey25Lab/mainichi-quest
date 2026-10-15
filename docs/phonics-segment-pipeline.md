# フォニックス区間自動抽出パイプライン（A/B PoC）

## ローカル素材

元動画はローカル専用で次に保存する。公開リポジトリへは含めない。

`asset-source/phonics/videos/abc-phonics-chant-az-tora-teacher.mp4`

## 実行

初回だけ、ローカルの Python 環境へ解析用ライブラリを追加する。

```powershell
python -m pip install scipy librosa soundfile imageio-ffmpeg
```

```powershell
python scripts/phonics-segments/analyze_video.py `
  --video asset-source/phonics/videos/abc-phonics-chant-az-tora-teacher.mp4 `
  --scope config/phonics-segments/ab-scope.json `
  --output review/phonics-segments/abc-phonics-chant-az-tora-teacher
python scripts/phonics-segments/build_review.py `
  --analysis-dir review/phonics-segments/abc-phonics-chant-az-tora-teacher
python scripts/phonics-segments/serve_review.py
```

表示された `http://127.0.0.1:4180/.../review.html` を開く。レビュー画面では、通常再生、同一区間40%再生、次区間への連続再生、±0.01〜0.10秒相当の候補選択/調整、FIX、アプリ用JSONのダウンロードを行える。

## 自動提案

文字の意味や音声認識ではなく、対象文字のscope内で以下を統合する。

- RMSの低エネルギー谷
- onset
- beat/tempo
- spectral flux

scopeだけを設定すれば、同じ処理で将来A〜Zへ広げられる。各端点には3候補を残し、自動提案を確定値扱いしない。レビューとFIXが必須である。

## アプリ用JSON

レビュー画面で全区間をFIX後にダウンロードできる。ファイル化済みのFIXデータからは、次でも出力できる。

```powershell
python scripts/phonics-segments/export_app_json.py --input fixed-segments.json --output phonics-ab.json
```

未FIX区間があれば出力を拒否する。
