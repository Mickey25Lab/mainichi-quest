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
2. 右下の区間カード（`A-1` から順）を選ぶ。全体動画は開始位置で停止し、下の専用プレイヤーはその区間だけを自動再生する。
3. 下の「選択中セット」専用プレイヤーは、選択中の開始〜終了だけを再生し、終端で停止する。聞き直す時は「このセットを最初から再生」を押す。
4. 早過ぎる・遅過ぎると感じたら、開始/終了の候補ボタンまたは ±0.01 / 0.05 / 0.10 秒で直す。変更するたび専用プレイヤーは新しい開始位置へ戻る。
5. 「通常→40%→次区間」で、実アプリに近い繰り返しも確認する。
6. 問題なければ `FIX` を押す。A-1、A-2、B-1、B-2 をすべてFIXしたら、「レビュー状態を保存」で作業記録を保存し、「アプリ用JSONを書き出す」で利用データを作る。

## 自動提案

この動画のPoCでは、まず **1セット=8 beat** の拍グリッドを作り、連続する8 beatを1セットとして提案する。最初のdownbeatは設定の `firstDownbeatSeconds` に最も近い自動検出beatへ合わせる。`firstSetStartBeat` はそのdownbeatを拍1と見なした最初のセット開始位置で、今回は `0.75` としているため、以後の境界も0.25 beatぶん前へ平行移動する。A/B以降も同じグリッドを連続利用する。人間が感じる大きな拍と解析器が取る細かいbeatが異なる動画では、設定の `beatsPerSet` でこの対応を明示する。

拍グリッドが設定されていない動画では、対象文字のscope内で以下を統合する従来の候補抽出へフォールバックする。

- RMSの低エネルギー谷
- onset
- beat/tempo
- spectral flux

拍グリッドではA〜Zのsetを設定順に連続して並べるだけで同じ処理を広げられる。各端点には3候補を残し、自動提案を確定値扱いしない。レビューとFIXが必須である。

## アプリ用JSON

レビュー画面で全区間をFIX後にダウンロードできる。ファイル化済みのFIXデータからは、次でも出力できる。

```powershell
python scripts/phonics-segments/export_app_json.py --input fixed-segments.json --output phonics-ab.json
```

未FIX区間があれば出力を拒否する。
