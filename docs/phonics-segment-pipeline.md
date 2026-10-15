# フォニックス区間フレーム・パイプライン（A〜Z PoC）

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
  --scope config/phonics-segments/az-frame.json `
  --output review/phonics-segments/abc-phonics-chant-az-tora-teacher
python scripts/phonics-segments/build_review.py `
  --analysis-dir review/phonics-segments/abc-phonics-chant-az-tora-teacher
python scripts/phonics-segments/serve_review.py
```

表示された `http://127.0.0.1:4180/.../review.html` を開く。レビュー画面では、A-1フレームとA-2以降フレームの全体調整、通常→通常→次区間、A-1〜Z-2を各2回ずつ通し再生、FIX、アプリ用JSONのダウンロードを行える。

## レビューの順番

1. 右側の「全区間フレーム」で、`A-1フレーム` と `A-2以降フレーム` を調整する。±0.01 / 0.05 / 0.10秒を押すと、A-1〜Z-2の全52区間が即時に再計算される。
2. 右下の区間カードを選ぶ。全体動画は開始位置で停止し、下の専用プレイヤーはその区間だけを自動再生する。
3. 個別の聞き直しは「このセットを最初から再生」、繰り返し確認は「通常→通常→次区間」を使う。
4. 最終確認は「A-1〜Z-2を各2回通し再生」。全52区間を通常音量で2回ずつ連続再生する。
5. 問題なければ `FIX` を押す。全区間をFIXしたら、「レビュー状態を保存」で作業記録を保存し、「アプリ用JSONを書き出す」で利用データを作る。

## 自動提案

この動画のPoCでは、音声やリズムを解析しない。`mechanicalGrid` の二つの数値だけを使う。

- `firstFrameSeconds`: A-1の長さ（初期値 4.58秒）
- `followingFrameSeconds`: A-2〜Z-2の各フレーム長（初期値 4.74秒）

開始は0秒で、A-1の終端以降は共通フレーム長を機械的に積み上げる。全52区間の最終終端は246.32秒で、動画長262.55秒の範囲内に収まる。調整時もこの同じ規則で全区間を再計算する。

## アプリ用JSON

レビュー画面で全区間をFIX後にダウンロードできる。ファイル化済みのFIXデータからは、次でも出力できる。

```powershell
python scripts/phonics-segments/export_app_json.py --input fixed-segments.json --output phonics-ab.json
```

未FIX区間があれば出力を拒否する。
