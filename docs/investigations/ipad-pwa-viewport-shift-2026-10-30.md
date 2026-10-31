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

## 調査手順（初期調査計画）
1. 実際のアプリのHTML/CSS/JSのエントリポイントを特定し、viewport meta、固定寸法、transform、画面フィット処理、resize、visibilitychange、orientationchange、visualViewportイベントを追跡する。
2. 10/26〜10/30のmainへの変更と、レイアウト・PWA関連の差分を照合する。時系列の一致のみで原因とは断定しない。
3. iPad横向きのPWAで通常プレイ中の画面サイズ変化を再現できるか確認する。Safari通常タブとの比較も行う。
4. 再現できなければ、既存MQ-001の軽量な端末内リングバッファログを拡張する案を具体化する。ログ項目：timestamp、commit SHA、innerWidth/Height、screen.width/height、visualViewportのwidth/height/offset/scale、devicePixelRatio、主要コンテナのboundingClientRect、computed transform、scrollX/Y、visibilityState、resize/visualViewport/ページ遷移イベント。端末内保持し、再起動後に閲覧・コピー可能にする。個人情報や学習回答内容は収集しない。
5. 診断UIは下部ボタンに依存させず、正常復帰後にアクセス可能にする。自動修復は根因が判明するまで実装しない。

## 非対象・安全条件
- このPRでは診断専用コード以外のゲーム表示・報酬・子どもの保存処理を変更しない。
- 既存の子どものデータを削除・初期化しない。
- 原因未確定のままCSSの場当たり的修正や自動リロードを入れない。

## 完了条件
- 実コードに基づく原因候補と根拠、直近差分の調査結果を追記する。
- 必要ならログ実装PRの設計・検証方法をまとめる。
- 原因が特定できない場合は「未特定」と明記する。

## コード調査結果（2026-10-30 / main 47495713af25）

### 実際のエントリポイント
- 本番配備ソースは `dist/index.html`, `dist/app.js`, `dist/styles.css`。root直下の `app.js` ではない。
- `dist/index.html:7`: `width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`。
- `dist/styles.css:47-70`: bodyは黒背景、`.app` は `width:100vw;height:100dvh;overflow:hidden`、相対配置。
- `dist/styles.css:1640-1650`: `.play-stage` は `1400×1050`、親の中央に `translate(-50%,-50%) scale(var(--stage-scale))`。
- `dist/app.js:1176-1204`: `stageScaleFor(width,height)=min(width/1400,height/1050)` として全画面に同じscaleを割当。
- したがって、viewport自体が一時的に変形した場合、`.app` の寸法・stageの縮小率・中央配置が連動する。異常なサイズ情報や更新漏れの影響が全画面で持続する可能性がある。

### 既存の復旧・診断コード（重複実装禁止）
- `dist/app.js:1605-1697`: すでにMQ-001のopt-inローカル診断ログあり。localStorageキー `mq-001:viewport-diagnostics-v1`、最大30件、起動後も保持。管理画面トグルでON、画面左上の固定ボタン「MQ-001 LOG」でコピー可能。
- ただし `diagnosticViewportSnapshot()` が保存するのはvisualViewport幅・高さ・scale・offsetおよびstageScaleだけ。`innerWidth`, `innerHeight`, `documentElement.clientWidth`, コンテナ矩形、computed transform、scroll位置は保存しない。
- `dist/app.js:1730-1754`: `visualViewport.scale != 1` のときだけ `recoverAbnormalPwaZoom()` がmeta viewportを一時変更して戻し、スクロールを0に戻す。scaleが1のままでレイアウトサイズだけ変化する問題は対象外。
- `dist/app.js:1757-1800`: `isNormalViewport` はvisualViewport.scaleおよびinnerとclientのサイズ差しか検査しない。物理画面とapp矩形のずれは検査しない。`schedulePlayStageSize` は二重requestAnimationFrameで寸法が安定しないとその呼び出しを終了し、自動再試行はしない。
- `dist/app.js:6718-6742,6917-6937`: window.resize / pageshow / orientationchange / visualViewport.resize / visibilitychange / focusで再計測・復旧する。ただし通常プレイ中にviewport異常が発生してこれらのイベントが届かなければ、再測定が起きない可能性がある。
- visualViewport.scrollイベントの監視は確認できず、レイアウトの絶対座標がずれた瞬間を検出する監視も存在しない。

### 有力な故障シナリオ（未検証）
**A（優先度高）:** iPadOS WebKit PWAが通常プレイ中に `100vw` / `100dvh` またはlayout viewportとvisualViewportを一時的に不整合にし、黒いbody背景が露出。右側の白領域はPWA/WebKitの背景等であり、黒bodyと別の描画領域になっている可能性。iPadOS実機の採取値が必要。

**B（優先度高）:** DOMのviewport幅と高さがそれぞれ不正・古い値になり、黒背景のapp・1400×1050 stageが正しい画面サイズへ復帰しない。二重rAFの安定性確認が一度失敗すると再スケジュールされないことが回復不能に寄与し得る。

**C（優先度中）:** `recoverAbnormalPwaZoom` によるviewport metaの一時書換えがWebKitに別のレイアウト不整合を引き起こす。ただし `scale != 1` の条件を満たさなければ実行しないため、ログによる確認前に犯人とは断定できない。

### 画像上の形状について
- 画面の左側に固定比率のゲーム領域が維持され、残りに黒・白の別領域がある。ゲーム内個別要素よりもviewport/アプリ外枠の問題に整合的。
- ただし画像のみからCSS矩形とWebKitの描画領域を区別できず、原因は未特定。

### 変更履歴の照合
- viewport関連の既存修正は **#96 (10/14, PWA復帰ズーム復旧)**、**#114 (10/15, viewport runtimeと診断payloadの分離)**、**10/17 stage resize guard統一**。
- 10/21の #181〜#184 でトップ・モード選択・コレクション等のstage倍率を共通化。10/25 #215 でコレクションUI縮小規則を統一。
- 10/28 main最新 #230 は `dist/app.js`, `dist/index.html`, `dist/styles.css` を含むが、主題は2けた×2けたのゼロモード。変更ファイルの存在だけでは画面異常への因果関係は示せない。
- 発生開始（約10/28）と既存viewport処理の導入（10/14〜17）には時間差がある。回帰の可能性は残すが、直接の引き金はまだ特定できない。

### 診断改善案（同PRで診断コードのみ実装）
1. MQ-001を重複新設せず拡張し、正常時と異常時双方の `window.innerWidth/Height`, `documentElement.clientWidth/Height`, `screen.width/height`, `devicePixelRatio`, `visualViewport`、`#app` と `#play-stage` の `getBoundingClientRect()`、computed style、scrollX/Yを**イベント種別・時間・SHA**とともに保持。
2. 既存30件上限は稀な再現では履歴が消える可能性があるため、上限と採取頻度を設計し直す。端末内だけに保持し、個人情報・回答データは記録しない。
3. window.resizeのほか、visualViewport.scroll、定期的な低頻度整合性チェック、document.visibilitychange等を比較する。正常時にログ負荷が増えすぎないようにする。
4. 異常発生中にボタンを押せなくても、**次回の正常起動後**に履歴をコピーできることを検証する。ボタンの単なる右上移設だけでは不十分。
5. 異常検知時の自動CSS修正、リロード、meta viewport書換え強化は原因が判明するまで保留。

### 初期調査時点で未実施
- 実機再現（接続iPadが必要）。
- 現物の異常時ログ採取（まだ未取得）。
- 10/28直近各PRの該当行の完全な差分監査。
- 実装・自動テスト（文書更新のみ）。仕様正本の変更は不要。

## 診断実装（2026-10-30、PR #232）
- `dist/app.js` の既存MQ-001診断を拡張。管理画面で診断ONにする既存のopt-in方式を維持。
- 記録：window / root / screen寸法、DPR、visualViewport寸法・scale・offset、#appと#play-stageの矩形・computed transform、scroll位置、visibilityState、stageScale、時刻とイベント。
- 5秒ごとに診断ON・ページ可視の場合のみ比較。変化時と30秒間隔のbaselineのみ保存する。visualViewport.scrollとwindow.resizeをイベントとして保存。
- 端末内localStorageの履歴保持枠を30→180件に拡張し、PWA再起動後も既存の「MQ-001 LOG」ボタンでコピー可能。新しいデータ送信・学習データ採取は追加しない。
- **画面を修正・リロードする処理は追加しない。** 既存のviewport復旧機構は変更しない。
- テスト：`tests/ipad-pwa-viewport-diagnostics.test.cjs` で静的回帰検査を追加。
- 注意：診断ON後に実機で発生するまで原因は確定しない。5秒以内に発生し消える異常は取り逃す可能性があるが、本件は持続するため5秒周期を優先。ログが180件を超えると古い情報から消える。
- 次の実機確認：親設定のMQ-001診断をONにし、通常プレイ。異常発生後にPWAを再起動し、左上のMQ-001 LOGからログを取得。プロフィール削除やリセットは不要。

### 変更に伴う扱い
- 当初は文書のみを予定していたが、追加の続行指示を受け、調査可能にする診断コードと回帰テストも同一PRに追加した。
- 正式仕様は変更なし。既存localStorageキー・子どものデータ形式も変更なし。
- 未完了：iPad実機確認、異常ログ取得、根因確定、実コードの動的実行確認。CI結果は別途確認する。
