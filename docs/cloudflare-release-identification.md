# Cloudflare Pages production versioning

Official production URL: https://mainichi-quest-63c.pages.dev/

## Version policy

Retain the existing numeric `0.3.x` semantic-version series. The last version managed by the former GitHub Pages release mechanism is anchored at Git tag `mq-prod-v0.3.61`. Cloudflare versions use `0.3.(61 + N)` where N is the count of **first-parent commits on main since that anchor**, so each mainline release has a stable, increasing number. Retried deployments of the same main commit retain the same number. Other branches and commits do not affect this count.

- Production: display `Version 0.3.62 | <commit7>` (example); numeric version plus the separately tracked deployed Git commit SHA.
- Preview: display `Version 0.3.62_P | <commit7>` (example); take the numeric version from the current main while exposing the actual Preview commit separately. Preview commits do not advance the number.
- `dist/release-meta.json`: generated at build time and contains `version`, `commit`, `branch`, `environment`, and `releaseCommit`. It must not be committed.
- **Important**: this policy counts *all* mainline commits as releases, including documentation-only changes. It does not automate semantic MINOR or MAJOR upgrades. Changes of series require an explicitly designed and tested migration of the baseline.

## Required Cloudflare Pages configuration (dashboard verification pending)

- Repository: `Mickey25Lab/mainichi-quest`
- Production branch: `main`
- Build command: `node .github/scripts/prepare-cloudflare-release.mjs`
- Build output directory: `dist`
- Root directory: repository root
- Cloudflare must supply full `CF_PAGES_COMMIT_SHA` and `CF_PAGES_BRANCH` values.
- Git checkout must retain access to the origin and permit fetching history and `mq-prod-v0.3.61`.

The build script fails rather than emitting a wrong version if the required tag/ancestry cannot be found. The application continues to show its older embedded fallback version if Cloudflare does not execute the build script; treat that as a deployment configuration defect.

## Acceptance checks

After PR merge and Cloudflare deployment, inspect `https://mainichi-quest-63c.pages.dev/release-meta.json`: verify `environment=production`, `branch=main`, numerical `version` and full `commit` against deployed main SHA. Check the homepage displays the same version and abbreviated commit. On the Cloudflare Preview URL, verify `environment=preview`, `_P` display, and version based on main (no increment for Preview).

GitHub Actions CI checks generator behavior using a miniature Git repository (two main releases and one Preview). This PR does not change localStorage, profile IDs, migration tools, installed PWA data, or the old GitHub Pages workflow. Do not disable GitHub Pages until Cloudflare production validation (PR-B) succeeds.
