# 05_equipment 正式化記録

2026-10-17に、スペシャル装備単品20種の正本PNGと配信用WebPを正式化した。

## 正本PNG

- 保存先：`asset-source/collection/05_equipment/png/`
- 20枚、1254×1254、RGBA
- 入力：承認済み高解像度PNG。正式化前のレビュー成果物は削除済みで、現在の正本は上記保存先とする
- 正規化・中央配置済みで、PNGの`alpha < 16`は透明化済み
- EXIF、ICC、XMP、コメントは含まない

## 比較と採用条件

| 項目 | 比較値 | 採用値 |
| --- | --- | --- |
| 解像度 | 430／512／640／768／896／1254 | **640×640** |
| RGB Quality | 30／50／70／90 | **Q70** |
| Alpha Quality | 10／40／70／100 | **A40** |

比較対象は宅配便車とレーシングバイク。描画量の多い面・細線・発光と、細身の輪郭・透明境界を確認した。比較データは同フォルダの`*_comparison_data.json`に保存する。

## 正式WebPと配備

- 正式WebP：`asset-source/collection/05_equipment/webp/`
- 配備先：`dist/assets/collection/05_equipment/`
- 正本PNGから直接LANCZOSで640×640へ縮小
- lossy RGB Q70、WebP Alpha Quality 40、`method=6`、`exact=False`
- metadataは付与しない
- 20枚すべてRGBA・正常デコードを確認
- `asset-source`と`dist`は20/20でSHA-256一致

生成条件、各ファイルの容量とSHA-256は`formal_webp_manifest.json`を正とする。再生成は`build_formal_assets.py`を使い、WebPを入力にした再圧縮は行わない。
