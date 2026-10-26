# PR-B3｜Cloudflare Pages 本番配信の受け入れ確認

## Confirmed in GitHub

- PR #224: production release metadata monitoring merged.
- PR #225: Cloudflare `dist/_headers` cache control merged.
- GitHub main is the source for Cloudflare production. Preview uses branches.
- CI on PRs checks regressions before merge; CI failures do **not** automatically block Cloudflare from building a manually merged main unless repository branch protections are configured. Verify branch protection separately.
- Cloudflare deployment success and GitHub Actions CI success are distinct signals.

## Automated checks

`node .github/scripts/verify-cloudflare-delivery.mjs` requests Cloudflare production HTML, app JS/CSS, profile-independent JS, manifest and metadata and verifies `Cache-Control` directives. Run **Check Cloudflare production delivery** through GitHub Actions `workflow_dispatch` after merging this PR; PR CI only runs deterministic unit tests so it cannot confuse production and Preview.

`Verify Cloudflare production release` (PR #224) separately compares production version/commit with GitHub main. A failed run is recorded in Actions. No email notification or third-party alert is configured.

## iPad acceptance checklist (separate environments)

1. First check current Production commit and version by opening https://mainichi-quest-63c.pages.dev/release-meta.json in Safari.
2. Open https://mainichi-quest-63c.pages.dev/ as a normal Safari tab, record the displayed Version and confirm it matches metadata.
3. In Minato's **existing** Cloudflare Safari PWA, use the app's reload button (do not reinstall); record the Version. Confirm Minato's existing profile, points, collections and learning records remain intact.
4. In Sumire's **existing** Cloudflare Safari PWA, repeat the reload and Version check; confirm Sumire's data remain intact.
5. If a PWA is still stale, fully close and reopen only that PWA. Do not clear website data, localStorage, caches by hand, or remove the home-screen icon. Record the observed Version for follow-up.
6. Check a Cloudflare Preview URL separately: it must display a `_P` version and the corresponding Preview commit. Preview testing must not alter the children's existing Production profiles.
7. Check Cloudflare dashboard Deployments for successful production deployment matching main SHA. A successful GitHub Pages deploy does not prove Cloudflare deployed successfully.

## Free tier and failure handling

Use Cloudflare Pages Git integration and GitHub Actions only; no new paid service is introduced. Review usage in Cloudflare dashboard if volume increases; free plan eligibility/limits can change. On Cloudflare failure, inspect the relevant deployment logs and preserve the last healthy deployment. Do not disable GitHub Pages or delete client data as a troubleshooting shortcut.

B3 cannot be declared fully complete until the production HTTP response headers and both children's **actual iPad** PWA state have been confirmed.
