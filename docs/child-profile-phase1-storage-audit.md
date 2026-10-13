# 子どもプロファイル Phase 1 保存監査

監査対象は `dist/app.js` の全 `localStorage` アクセスです。Phase 1では、子ども固有データを `warizan-robot:profiles-v1` 内の各Profileへ移し、旧キーは削除せず復旧元として保持します。

## 旧キー

| キー | 用途 | 旧読み込み | 旧書き込み・削除 | 分類 | Phase 1 |
|---|---|---|---|---|---|
| `warizan-robot:best-time-ms` | ベストタイム | 結果表示 | ゲーム完了時、旧記録リセット | 子ども固有 | `Profile.bestRecords.bestTimeMs` へコピー |
| `warizan-robot:vehicle-collection-v1` | 20車種の旧コレクション段階 | コレクション読込 | 進捗同期、複数の旧リセット | 子ども固有 | `Profile.collection.stages` へコピー |
| `warizan-robot:recent-vehicles-v1` | 抽選重複を避ける直近3車種 | 起動時 | 車種抽選時 | 子ども固有 | `Profile.progress.recentVehicles` へコピー |
| `warizan-robot:history` | 旧学習履歴 | 現行コードでは未使用 | 旧記録リセット | 子ども固有 | `Profile.progress.legacyHistory` へコピー |
| `warizan-robot:ranking` | 旧ランキング | 現行コードでは未使用 | 旧記録リセット | 子ども固有 | `Profile.progress.legacyRanking` へコピー |
| `warizan-robot:top-collection-last-used-jst` | 当日のトップ画面からのコレクション閲覧済み状態 | トップボタン更新 | コレクションを開いた時、旧リセット | 子ども固有 | `Profile.progress.topCollectionLastUsedJst` へコピー |
| `warizan-robot:reward-progress-phase1-v1` | 発見、なかよし、進化段階、エネルギー、メダル | 起動時・QA | 正解時・QA・旧リセット | 子ども固有 | `Profile.progress.rewardProgressPhase1` へコピー |
| `warizan-robot:bgm-enabled-v1` | BGMの端末設定 | 起動時 | BGM切替時 | アプリ共通 | 端末共通のまま維持 |
| `warizan-robot:records-reset-2026-09-19` | 旧記録リセット完了印 | 起動時 | 旧リセット時 | アプリ共通・旧migration | 旧キーとして保持、今後は実行しない |
| `warizan-robot:reward-reset-v40-done` | 旧報酬リセット完了印 | 起動時 | 旧リセット時 | アプリ共通・旧migration | 同上 |
| `warizan-robot:collection-reset-20260924-done` | 旧コレクションリセット完了印 | 起動時 | 旧リセット時 | アプリ共通・旧migration | 同上 |
| `warizan-robot:collection-access-reset-20260924-done` | 旧閲覧制限リセット完了印 | 起動時 | 旧リセット時 | アプリ共通・旧migration | 同上 |
| `warizan-robot:reward-progress-phase1-reset-20260928-done` | 旧進捗リセット完了印 | 起動時 | 旧リセット時 | アプリ共通・旧migration | 同上 |
| `warizan-robot:qa-progress-backup-v1` | QA進捗を戻すためのバックアップ | QA終了時 | QA開始・終了時 | QA / 開発 | Profile別QA状態へ置換 |
| `warizan-robot:preview-qa-progress-v2` | QAプリセット適用済み印 | QA開始時 | QA開始・終了時 | QA / 開発 | Profile別QA状態へ置換 |
| `mq-001:visual-diagnostics-v1` | 画像読込診断ログ | 診断URL時 | 診断URL時 | QA / 開発 | 端末共通のまま維持 |
| `mq-001:viewport-diagnostics-v1` | viewport診断ログ | 診断URL時 | 診断URL時 | QA / 開発 | 端末共通のまま維持 |

## 新キー

| キー | 用途 | 分類 |
|---|---|---|
| `warizan-robot:profiles-v1` | Profile一覧と各Profileの子ども固有データ | Profile保存本体 |
| `warizan-robot:active-profile-id-v1` | この端末で現在開いているProfile | 端末固有 |
| `warizan-robot:profile-migration-v1` | 旧データコピーのversion、完了、検証対象 | migration |
| `warizan-robot:profile-qa-state-v1` | Profile別QAバックアップとプリセット適用状態 | QA / 開発 |

## 監査で確認した破損リスクと対処

- 旧リセット関数は起動時に子ども固有キーを削除するため、Profile移行より先に動くと復旧元を失います。Phase 1では旧リセット実行を停止しました。
- QAプリセットが旧進捗キーへ直接書き込むと、active Profileと表示内容がずれます。QAの進捗操作もProfile保存アクセス層経由にしました。
- 開発者リセットが全キーを削除すると他の子どものProfileも失われます。active Profileのプレイデータだけを初期化する動作へ変更しました。
- 旧コレクション段階だけが残る環境では進捗配列が空になるため、旧段階から最低限の進化状態を復元してから新形式へ保存します。
