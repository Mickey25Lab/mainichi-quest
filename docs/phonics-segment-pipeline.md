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

## レビューの順番

1. 上の「全体動画」で、歌の前後関係やリズムを確認する。
2. 右下の区間カード（`A-1` から順）を選ぶ。全体動画と下の専用プレイヤーは、その区間の開始位置で停止する。
3. 下の「選択中セット」専用プレイヤーで再生する。このプレイヤーは選択中の開始〜終了だけを再生し、終端で停止する。
4. 早過ぎる・遅過ぎると感じたら、開始/終了の候補ボタンまたは ±0.01 / 0.05 / 0.10 秒で直す。変更するたび専用プレイヤーは新しい開始位置へ戻る。
5. 「通常→40%→次区間」で、実アプリに近い繰り返しも確認する。
6. 問題なければ `FIX` を押す。A-1、A-2、B-1、B-2 をすべてFIXしたら、「レビュー状態を保存」で作業記録を保存し、「アプリ用JSONを書き出す」で利用データを作る。

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
