# 04_super_robot_equipped 正式PNG FIX記録

- FIX日: 2026-10-10
- 正式PNG: 20枚
- キャンバス: 1254 × 1254 px
- モード: RGBA
- 背景: 透明
- alpha前処理: `alpha < 16`を完全透明化
- 目線: 全20車種をY=374に整列
- 足元: 全20車種をY=1164（下余白90px）に整列
- 横位置: 顔中心を基本に配置し、大型装備がある車種のみキャンバス内へ収める制約補正を適用
- レッカー車: 2本ウインチ版を採用
- ブルドーザー: 両肩のスペシャル装備を約1.5倍に拡大し、頭頂部より上へ張り出す版を採用
- 飛行機: 円形スペシャル装備の穴越しに背後の機体を描画した版を採用
- 正式PNG生成元: `review/collection/04_super_robot_equipped/eye_aligned_face_center_review_v4_2026-10-10/`の高解像度個別PNG
- レビューシートからの切り出しは不使用

## 承認証跡

Kimiが`04_super_robot_equipped_eye_aligned_face_center_review_v4_20.png`を確認し、現20車種を正式PNGとしてFIXした。

## 成果物

- 正式PNG: `asset-source/collection/04_super_robot_equipped/png/`
- 配置・ハッシュ記録: `docs/asset-pipeline/review-records/04_super_robot_equipped/final_layout_params.csv`
- 正式PNGマニフェスト: `docs/asset-pipeline/review-records/04_super_robot_equipped/formal_png_manifest.json`
- 正式PNGレビュー: `review/collection/04_super_robot_equipped/final_png_review_2026-10-10/04_super_robot_equipped_final_png_review_20.png`

## 正式WebP

- 正式化日: 2026-10-12
- 解像度: 768 × 768 px
- 形式: WebP lossy（透過維持）
- RGB Quality: 50
- Alpha Quality: 60
- method: 6
- リサイズ: LANCZOS
- 生成経路: 正式PNGから各WebPを直接生成
- metadata: EXIF / ICC / XMPを付与しない
- 正式WebP: `asset-source/collection/04_super_robot_equipped/webp/`
- 配信用WebP: `dist/assets/collection/04_super_robot_equipped/`
- 生成・ハッシュ記録: `formal_webp_manifest.json`

`asset-source`と`dist`の20枚は全件同一バイトとする。
