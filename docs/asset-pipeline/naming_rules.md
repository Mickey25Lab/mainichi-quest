# 画像素材の命名規則（v1.6）

正式仕様は [asset_pipeline_v1_6.md](asset_pipeline_v1_6.md) です。既存完成図は `01_source_final/` に保持し、上書き・削除・リネーム・直接加工しません。

車種別カテゴリは `01_vehicle`、`02_robot`、`03_super_robot`、`04_super_robot_equipped`、`05_equipment`、`06_medal`、`07_vehicle_logo_title`、`08_background` の8つです。`02_review/` と `03_assets/png/`・`03_assets/webp/` に同じカテゴリフォルダを置きます。

車種別素材名は `NN_slug_category.png`（WebPは `.webp`）です。`NN` は01～20、`slug` は小文字の snake_case、`category` は番号を除いたカテゴリ名です。例: `01_patrol_car_super_robot_equipped.png`。

全車種共通の `Evolution Material` は `common/evolution_material.png` とし、車種別8カテゴリには含めません。UIラベル3つ、青い進化矢印2つ、メダル背後光の6要素を1枚にまとめます。接地サークルは新しい完成図に使いません。

`08_background` は全車種共通で1400×1050 pxの完全背景です。透過部分、未描画部分、不自然な余白を残しません。メダルは20車種分を先にreviewへ揃え、一覧比較・正規化・最終レビュー後にFIXします。

再合成した完成図は `NN_slug_collection_complete_v2.png` とします。FIX済み素材を `composition_layout.json` の設定で機械的にアルファ合成します。
