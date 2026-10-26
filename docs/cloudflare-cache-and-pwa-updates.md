# Cloudflare Pages app update and cache policy

Cloudflare serves static application files from `dist`. The `dist/_headers` file asks clients and intermediaries to revalidate the app shell (`/`, `/index.html`, `/app.js`, `/styles.css`, `/scripts/*`, and the manifest) rather than reuse an older version without checking. Release metadata is `no-store` so checks and version display are not masked by an older response.

This does **not** clear the browser cache, delete localStorage, change profiles, modify save keys, or force a PWA reinstall. Image and audio files retain their existing caching behavior. Existing open tabs can retain loaded JavaScript until reloaded.

## Acceptance checks (production and Preview)

1. Inspect response headers for `/`, `/app.js`, `/release-meta.json` in the browser network panel; confirm intended `Cache-Control` values. `_headers` applies on Cloudflare Pages builds only.
2. Verify that `release-meta.json` reports the deployed commit and a numeric version, and the home screen reports the same pair.
3. On iPad Safari browser and separately on the installed Safari PWA, use the top-left reload control or close/reopen after deployment. Confirm the updated version is shown in each.
4. Confirm each child's profile, points, energy and collection remain unchanged. Do **not** clear site data, reinstall the PWA or reset profiles as part of update testing.
5. If one surface remains stale, distinguish the currently open in-memory app from HTTP caching by checking `release-meta.json` in Safari first; record the stale surface and app version for investigation.

## Boundaries

The project currently does not bundle a service worker registration script; the reload control attempts `navigator.serviceWorker.getRegistration()?.update()` but continues to `location.reload()` even without a registration. This PR does not introduce a service worker or background update mechanism.

The `Cache-Control` response header cannot forcibly update an already-open browser tab. Actual iPad Safari PWA and normal Safari tests are required before PR-B is considered complete.
