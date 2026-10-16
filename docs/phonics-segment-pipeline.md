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

表示された `http://127.0.0.1:4180/.../review.html` を開く。レビュー画面では、A-1フレームとA-2以降フレームの全体調整、選択位置からの通常→通常→最後まで、A-1〜Z-2を各2回ずつ通し再生、FIX、アプリ用JSONのダウンロードを行える。

## レビューの順番

1. 必要なときだけ右側の「全区間フレーム設定」を開く。`A-1フレーム`、`A-2以降フレーム`、`ジャンプ時終了`、`ジャンプ時開始`を4列で調整できる。各列は縦6ボタンで、マイナスは青、プラスは赤。前2項目はA-1〜Z-2の全52区間を再計算し、後2項目は1回目の終端と戻った2回目の開始だけを変える。個別の開始・終了微調整も、同じ2列・縦6ボタンで、誤操作を避けるため通常は閉じている。
2. 左上のスクロール可能な区間カード一覧から選ぶ。ヘッダーは固定され、一覧だけを上下に動かせる。全体動画は開始位置で停止し、上段の専用プレイヤーが、選択区間から最後まで各区間を2回ずつ自動再生する。
3. 個別の聞き直しは「このセットだけを再生」、選択位置からの連続確認は「通常→通常→最後まで」を使う。
4. 最終確認は「A-1〜Z-2を各2回通し再生」。各区間の1回目→2回目だけ開始へ戻し、2回目の終端から次区間の1回目へはseekせずに連続再生する。
5. 問題なければ `FIX` を押す。全区間をFIXしたら、「レビュー状態を保存」で作業記録を保存し、「アプリ用JSONを書き出す」で利用データを作る。

## 自動提案

この動画のPoCでは、音声やリズムを解析しない。`mechanicalGrid` の四つの数値だけを使う。

- `firstFrameSeconds`: A-1の長さ（初期値 4.49秒）
- `followingFrameSeconds`: A-2〜Z-2の各フレーム長（初期値 5.06秒）
- `jumpEndOffsetSeconds`: 1回目の再生で戻るジャンプを実行する終端の差分（初期値 0.00秒）
- `jumpStartOffsetSeconds`: ジャンプ後の2回目の開始位置の差分（初期値 0.00秒）

開始は0秒で、A-1の終端以降は共通フレーム長を機械的に積み上げる。全52区間の最終終端は262.55秒で、動画長262.55秒の範囲内に収まる。ジャンプ時終了は1回目だけ、ジャンプ時開始は戻った2回目だけに適用されるため、2回目から次区間の1回目へのシームレス再生には影響しない。

## アプリ用JSON

レビュー画面で全区間をFIX後にダウンロードできる。ファイル化済みのFIXデータからは、次でも出力できる。

```powershell
python scripts/phonics-segments/export_app_json.py --input fixed-segments.json --output phonics-ab.json
```

未FIX区間があれば出力を拒否する。
