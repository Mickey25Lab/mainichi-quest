# 決定: mainブランチを自動チェックで保護する

日付：2026-10-23
状態：採用

## 状況

マイクエは子どものプロファイル・学習履歴・報酬進捗を端末内に保存する。
PR #185では、GitHubランナーのUbuntu更新とPlaywrightの互換性不足により、ブラウザテストが実行前に失敗したにもかかわらず、mainにブロックを掛けるGitHub設定が未整備だった。

## 決定

GitHubの`main`に次の保護を設定する。

- mainへの直接pushは禁止し、PR経由のみとする
- 次の4チェックが成功するまでmergeを許可しない
  - `Check unchanged PR version`
  - `Playwright browser smoke tests`
  - `Multi-viewport UI geometry`
  - `Cloudflare Pages`
- チェックは最新mainを取り込んだ状態で成功していることを必須にする
- 強制pushとmainブランチ削除を禁止する
- 未解決のPR会話がある場合はmergeを禁止する
- 管理者もこれらのルールを守る

この技術的な安全柵に加え、Kimiがチャットで明示的に`OK`するまでCodexはmergeしない。

## 理由

- 子どものデータや遊びの体験に影響する変更を、未検証のまま公開しないため
- Preview、ブラウザスモーク、複数画面サイズの確認を、個人の記憶ではなくGitHubの仕組みで確実に通すため
- Codexを含む管理者操作でも安全基準を省略しないため

## 影響

- PRごとに4つの自動チェックを待つ必要がある
- CIの基盤不具合は、アプリ変更と混ぜず別PRで先に直す
- KimiはGitHubの設定を確認する必要はない。Codexがチェック結果を確認し、Kimiには非技術的な確認内容だけを伝える

## 見直し条件

- テスト名・Preview提供元・公開方式を変更する場合
- Cloudflare PagesまたはGitHub Actionsの運用を変更する場合
- 外部家庭テスト・有償提供に向け、追加の安全要件が必要になった場合
