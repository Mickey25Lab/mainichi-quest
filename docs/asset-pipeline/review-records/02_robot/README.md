# 02_robot 正式化の再現記録

`review/` はローカルレビュー領域として Git 管理から除外する。このフォルダには、正式化と WebP 条件の再現に必要な小さな数値記録のみを保存する。元のレビュー画像と比較ページはローカルの `review/collection/02_robot/` に残す。

| 記録 | 内容 |
| --- | --- |
| `final_layout_params.csv` | 20車種の確定 Scale・X offset・Y offset、入力SHA-256、表示bbox |
| `resolution_comparison_data.json` | 896／768／640／480／384 px の比較条件と各候補の容量 |
| `rgb_quality_comparison_data.json` | 480 px での Q70／50／30／20／10 の比較条件と容量 |
| `alpha_quality_comparison_data.json` | 480 px・Q30 での alpha quality 20／60 の比較条件と容量 |

採用値は `docs/asset-pipeline/画像生成パイプライン.md` 第17章を正とする。**480×480、lossy RGB Q30、WebP alpha quality 60**。比較当時の暫定推奨と Kimi の最終採用値を混同しない。CSV・JSON 内の絶対パスは比較実施時の入力元を記録したもので、別の環境で再利用する際はプロジェクトルートへ読み替える。

`01_vehicle` と `08_background` の採用条件・判断根拠は同文書の第15・16章に記録済み。これらの大量の比較画像は正本に複製しない。
