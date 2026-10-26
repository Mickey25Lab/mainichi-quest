import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCachePolicy, verifyHeaders } from "./verify-cloudflare-delivery.mjs";

test("cache directive parser accepts additional directives", () => {
  assert.equal(validateCachePolicy("/app.js", "no-cache, max-age=0, must-revalidate", "no-cache"), null);
  assert.equal(validateCachePolicy("/release-meta.json", "no-store, max-age=0", "no-store"), null);
});
test("rejects missing and wrong directives", () => {
  assert.match(validateCachePolicy("/app.js", "max-age=600", "no-cache"), /must include no-cache/);
  assert.match(validateCachePolicy("/release-meta.json", null, "no-store"), /missing/);
});
test("validates live response headers without touching browser data", async () => {
  const requested = [];
  const fetcher = async (url) => {
    requested.push(url);
    const isMetadata = url.endsWith("-meta.json");
    return { ok: true, status: 200,
      headers: { get: () => isMetadata ? "no-store, max-age=0" : "no-cache, max-age=0, must-revalidate" } };
  };
  await verifyHeaders(fetcher, "https://example.pages.dev");
  assert.equal(requested.length, 8);
});
test("fails when static asset is missing", async () => {
  const fetcher = async () => ({ ok: false, status: 404, headers: { get: () => null } });
  await assert.rejects(verifyHeaders(fetcher), /HTTP 404/);
});
