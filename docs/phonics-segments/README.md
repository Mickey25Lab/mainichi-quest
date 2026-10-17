# フォニックス区間調整ツール

ABC Phonics ChantのA-1〜Z-2、全52区間をローカル動画で確認・調整する制作ツール。アプリ本体や公開用`dist`には組み込まない。

## 恒久保存するもの

- 実行コード：`scripts/phonics-segments/`
- 初期設定：`config/phonics-segments/az-frame.json`
- 使用方法と採用値：この文書

`review/phonics-segments/`は実行時に生成する一時領域で、正式成果物ではない。確認終了後に削除してよい。

## 正式採用中の初期値

2026-10-16時点のmainで使っている値を初期値とする。

- A-1基準フレーム：4.59秒
- A-2以降の共通フレーム：5.05秒
- ジャンプ終了補正：0.00秒
- ジャンプ開始補正：0.39秒
- A-1例外：元の開始位置-0.40秒、実再生開始0.00秒、終了4.84秒
- 全区間数：52

A-1はYouTubeで負の時刻へ移動できないため、実再生を0秒から始める。設定の正本は`config/phonics-segments/az-frame.json`とする。

## ローカル動画

元動画は公開リポジトリへ含めない。

`asset-source/phonics/videos/abc-phonics-chant-az-tora-teacher.mp4`

## 準備

解析用ライブラリが未導入の場合だけ実行する。

```powershell
python -m pip install scipy librosa soundfile imageio-ffmpeg
```

## 実行

```powershell
python scripts/phonics-segments/analyze_video.py `
  --video asset-source/phonics/videos/abc-phonics-chant-az-tora-teacher.mp4 `
  --scope config/phonics-segments/az-frame.json `
  --output review/phonics-segments/abc-phonics-chant-az-tora-teacher

python scripts/phonics-segments/build_review.py `
  --analysis-dir review/phonics-segments/abc-phonics-chant-az-tora-teacher

python scripts/phonics-segments/serve_review.py
```

表示された`http://127.0.0.1:4180/review/phonics-segments/abc-phonics-chant-az-tora-teacher/review.html`を開く。

## 調整手順

1. 左側の区間一覧から確認対象を選ぶ。
2. 「このセットだけを再生」または「通常→通常→最後まで」で境界を確認する。
3. 必要な場合だけ、全体設定または個別の開始・終了を調整する。
4. A-1〜Z-2を各2回通し再生して確認する。
5. 次回も調整値を使う場合は「すべての設定値を更新・保存」を押す。
6. 確定区間を`FIX`にし、「レビュー状態を保存」でJSONを書き出す。
7. 全区間FIX後、「アプリ用JSONを書き出す」で利用データを生成する。

ブラウザへ明示保存しなかった変更は、再読み込みすると正式採用中の初期値へ戻る。

## ファイルからの書き出し

保存済みのレビューJSONからアプリ用データを作る場合は次を使う。未FIX区間がある場合は出力を拒否する。

```powershell
python scripts/phonics-segments/export_app_json.py `
  --input fixed-segments.json `
  --output phonics-az.json
```

## 更新ルール

- 採用値を変える場合は`config/phonics-segments/az-frame.json`と本書を同時に更新する。
- 生成されたレビューHTML、解析JSON、音声、動画はGitへ追加しない。
- アプリへ反映するときは、出力JSONと`dist/app.js`の値を別途照合する。
