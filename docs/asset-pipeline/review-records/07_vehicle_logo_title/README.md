# 07_vehicle_logo_title 正式化記録

2026-10-18に、車種名英語ロゴ20種の正本PNGと配信用WebPを正式化した。

## 正本PNG

- 保存先：`asset-source/collection/07_vehicle_logo_title/png/`
- 20枚、1254×320、RGBA、透明背景
- デザインFIX：2026-10-09
- ロゴ実体は外接高198〜200px、外接幅1013〜1160px
- 全20枚で`alpha 1〜15`が0px、すなわち`alpha < 16 → 0`を適用済み
- EXIF、ICC、XMP、コメントは含まない

## 比較と採用条件

| 項目 | 比較値 | 採用値 |
| --- | --- | --- |
| 解像度 | 512／640／768／896／1024／1254 | **640×163** |
| RGB Quality | 90／60／30 | **Q60** |
| Alpha Quality | 80／40／20 | **A40** |

解像度比較はPatrolCar、KindergartenBus、Helicopter、Q・Alpha比較はPatrolCarとKindergartenBusを使用した。比較候補はすべて正本PNGから直接生成し、アプリ実表示相当と透明境界を確認した。比較データは`resolution_comparison_data.json`と`quality_alpha_comparison_data.json`に保存する。

## 正式WebPと配備

- 正式WebP：`asset-source/collection/07_vehicle_logo_title/webp/`
- 配備先：`dist/assets/collection/07_vehicle_logo_title/`
- 正本PNGから直接LANCZOSで640×163へ縮小
- lossy RGB Q60、WebP Alpha Quality 40、`method=6`、`exact=False`
- metadataは付与しない
- 20枚すべてRGBA・透過・正常デコードを確認
- `asset-source`と`dist`は20/20でSHA-256一致
- `dist`の旧PNGは削除し、アプリ参照をWebPへ変更

生成条件、各ファイルの容量とSHA-256は`formal_webp_manifest.json`を正とする。再生成は`build_formal_assets.py`を使い、WebPを入力にした再圧縮は行わない。
