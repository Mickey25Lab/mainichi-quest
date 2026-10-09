# 03_super_robot 正式PNG FIX記録

- FIX日: 2026-10-09
- キャンバス: 1254 × 1254 px
- モード: RGBA
- 背景: 透明
- alpha前処理: alpha < 16 を完全透明化
- 横位置: 可視領域を中心 x=627 に配置
- 目線: 消防車の左右の目の中心を基準に全20車種を整列
- 足元: 全20車種を y=1171 に整列
- 目線: 全20車種を y=279 に整列
- 共通収容係数: 0.926829（92.68%）
- 共通収容係数は、承認済みレビュー配置の相対サイズを維持したまま、ヘリコプターのローターを含む全装飾を1254×1254内へ収めるために適用
- 正式PNG生成元: `review/collection/03_super_robot/normalized_alpha16_v1/` の高解像度個別PNG
- レビューシートからの切り出しは不使用

## 承認証跡

Kimiが `03_super_robot_eye_aligned_full_view_review_v4_20.png` を確認し、20車種のサイズ感をFIXした。

## 成果物

- 正式PNG: `asset-source/collection/03_super_robot/png/`
- 配置パラメータ: `docs/asset-pipeline/review-records/03_super_robot/final_layout_params.csv`
- 正式PNGレビュー: `review/collection/03_super_robot/final_png_review_2026-10-09/03_super_robot_final_png_review_20.png`

この段階ではWebP、シルエット、dist反映、アプリ実装、Git操作、公開を行わない。

## WebP最適化

- 2026-10-09、Kimiが配信用キャンバスを **768 × 768 px** にFIXした。
- 解像度比較条件はQ90、WebP alpha quality 100、method 6、LANCZOS、metadata非付与。
- 比較証跡：`review/collection/03_super_robot/resolution_test_2026-10-09/03_super_robot_resolution_comparison.html`
- 解像度FIX後、RGB Quality **30／50／70** とWebP alpha quality **20／60／100** の3×3比較を開始した。
- 3×3比較は768×768、method 6、LANCZOS、metadata非付与で、各候補を正式PNGから直接生成する。
- 比較証跡：`review/collection/03_super_robot/quality_alpha_matrix_768_2026-10-09/03_super_robot_quality_alpha_matrix_768.html`
- 2026-10-09、Kimiが **RGB Quality 70／WebP alpha quality 20** を正式採用した。
- 正式WebPは、正式PNGから直接LANCZOSで768×768へ縮小し、Pillow 12.3.0／libwebp 1.6.0、lossy Q70、alpha quality 20、`method=6`、`exact=False`、metadata非付与で20枚生成した。
- 保存先：`asset-source/collection/03_super_robot/webp/`
- 20/20でファイル名、768×768、透過、正常デコード、metadata非付与を確認した。合計1,183,386 B、平均59,169.3 B。
- 比較対象のパトカー、フォーミュラカー、ヘリコプターは、承認したQ70／A20候補と正式WebPがバイト一致した。
- 再現・検証記録：`docs/asset-pipeline/review-records/03_super_robot/formal_webp_manifest.json`
- 正式WebP20枚を`dist/assets/collection/03_super_robot/`へ同一バイトで配備し、20/20でSHA-256一致を確認した。
- アプリは既存のスーパーロボット参照先をそのまま使い、配信画像と画像メトリクスを768px版へ更新した。Versionは0.0.128。
- シルエット生成は今回の対象外。正式Preview／実機QAとmainへのmergeはPR工程で行う。
