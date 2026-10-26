# マイクエ

Repository: `Mickey25Lab/mainichi-quest`

## 本番配信（正本）

**Cloudflare Pages:** https://mainichi-quest-63c.pages.dev/

- Production branch: `main`. Cloudflare Pages Git連携によってmainマージ後に本番ビルド。
- Preview: PRブランチごとのCloudflare Pages Preview。
- Build command（Cloudflare側設定）: `node scripts/generate-preview-meta.mjs && node .github/scripts/prepare-cloudflare-release.mjs`
- Build output: `dist`。
- 配信バージョンとSHA: https://mainichi-quest-63c.pages.dev/release-meta.json
- CI: GitHub Actions。詳細は `docs/cloudflare-release-identification.md` と `docs/cloudflare-production-acceptance.md`。

## GitHub Pages（旧配信）

GitHub Pages は**正式な本番配信先ではありません**。`PR-C` で旧 `.github/workflows/deploy-pages.yml` を廃止し、mainへのpush時の二重デプロイと旧方式の自動リリースタグ発行を停止しました。既にGitHub Pages上に公開されているファイルは、このPRだけでは削除・非公開になりません。

公開停止はGitHubリポジトリのPages設定で別途行う操作です。既存PWAや保存データを初期化しないでください。Cloudflare本番運用への切替完了確認後に判断します。

## バージョン管理

Cloudflare本番は `0.3.x` の数値バージョンと配信コミットSHAを表示します。基準タグ `mq-prod-v0.3.61` からのmain first-parentコミット数でバージョンを算出します。GitHub Pages時代のリリースタグを新規発行する必要はありません。仕組み・例外は `docs/cloudflare-release-identification.md` を参照してください。

## 移行の経緯

このリポジトリはChatGPT Sitesの `warizan-robot` から移行しました。
