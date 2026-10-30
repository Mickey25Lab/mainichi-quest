# iPad PWA画面ずれ：原因調査（2026-10-30）

## 事象（実機確認）
- iPad横向きのホーム画面追加PWA「マイクエ」で、通常プレイ中に突然発生（スリープ復帰・回転操作が必須条件ではない）。
- 上部が黒く、右側が白くなり、ゲーム描画が左下に偏る。ゲーム内の相対配置は概ね維持される。
- 画面遷移しても解消しない。PWAを完全終了して再起動すると復旧する。
- 2026-10-28頃から観測。発生頻度は不定。2026-10-30のスクリーンショットあり。
- 下部操作領域が使えず、下部の開発者ツール入口に依存する調査は不可。

## 調査する仮説（断定しない）
1. WebKit standalone PWA の visual viewport / layout viewport の不整合。
2. アプリの固定アスペクト比・scale・translate・中央寄せ計算の古い値が維持される。
3. 画面サイズ変更イベントの取りこぼし、CSS dvh/vh/viewport-fit、スクロール位置。
4. 直近のマージによる描画レイアウトへの回帰。

## 調査手順（このPRは調査資料のみ）
1. 実際のアプリのHTML/CSS/JSのエントリポイントを特定し、viewport meta、固定寸法、transform、画面フィット処理、resize、visibilitychange、orientationchange、visualViewportイベントを追跡する。
2. 10/26〜10/30のmainへの変更と、レイアウト・PWA関連の差分を照合する。時系列の一致のみで原因とは断定しない。
3. iPad横向きのPWAで通常プレイ中の画面サイズ変化を再現できるか確認する。Safari通常タブとの比較も行う。
4. 再現できなければ、次PRで軽量な端末内リングバッファログを実装する案を具体化する。ログ項目：timestamp、commit SHA、innerWidth/Height、screen.width/height、visualViewportのwidth/height/offset/scale、devicePixelRatio、主要コンテナのboundingClientRect、computed transform、scrollX/Y、visibilityState、resize/visualViewport/ページ遷移イベント。端末内保持し、再起動後に閲覧・コピー可能にする。個人情報や学習回答内容は収集しない。
5. 診断UIは下部ボタンに依存させず、正常復帰後にアクセス可能にする。自動修復は根因が判明するまで実装しない。

## 非対象・安全条件
- このPRでアプリの表示・ゲーム・報酬・保存処理を変更しない。
- 既存の子どものデータを削除・初期化しない。
- 原因未確定のままCSSの場当たり的修正や自動リロードを入れない。

## 完了条件
- 実コードに基づく原因候補と根拠、直近差分の調査結果を追記する。
- 必要ならログ実装PRの設計・検証方法をまとめる。
- 原因が特定できない場合は「未特定」と明記する。
