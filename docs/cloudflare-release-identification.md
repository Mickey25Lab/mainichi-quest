# Cloudflare Pages release identification

Cloudflare Pages is the intended production host:
https://mainichi-quest-63c.pages.dev/

## Cloudflare dashboard settings (must be verified manually)

- Git repository: `Mickey25Lab/mainichi-quest`
- Production branch: `main`
- Build command: `node .github/scripts/prepare-cloudflare-release.mjs`
- Build output directory: `dist`
- Root directory: repository root
- Cloudflare Pages Git integration must supply `CF_PAGES_COMMIT_SHA` and `CF_PAGES_BRANCH`

These settings cannot be confirmed or changed through the GitHub repository alone. Do not consider this migration complete until production and Preview builds have been checked on Cloudflare.

## Release identification

`dist/release-meta.json` is generated during the Cloudflare build from the deployment commit. The app displays `Version <12-char commit> | Production` for main and `Version <12-char commit> | Preview` for other branches. The complete 40-character commit SHA is retained in metadata. A commit-derived release ID avoids divergent version counters: the same commit always has the same ID regardless of build order or deployment retries. GitHub Pages' legacy semantic-version counter is not used for Cloudflare.

The current committed `appVersion` is retained solely as a legacy fallback until GitHub Pages retirement. A missing release-meta file will show that fallback; treat that as a failed Cloudflare build configuration check, not a successful new production release.

Verify: open `https://mainichi-quest-63c.pages.dev/release-meta.json` and check `environment=production`, `branch=main`, and `commit` against the production deployment SHA. Confirm the homepage shows the same abbreviated SHA. Perform the same check on a Cloudflare Preview URL with `environment=preview`. No storage keys, PWA installation, profile, or migration data are altered by this change.

Do not disable GitHub Pages or remove its release tags until PR-B validation is complete.
