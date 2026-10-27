import assert from "node:assert/strict";
import { test } from "node:test";
import { validateProductionRelease, checkProduction } from "./verify-cloudflare-production.mjs";

const sha = "1234567890abcdef1234567890abcdef12345678";
const good = () => ({ schemaVersion: 1, environment: "production", branch: "main",
  version: "0.3.65", commit: sha, releaseCommit: sha });
test("accepts a matching numeric production release", () => {
  assert.deepEqual(validateProductionRelease(good(), sha), []);
});
test("rejects incorrect channel and stale release", () => {
  const meta = { ...good(), environment: "preview", commit: "f".repeat(40) };
  const errors = validateProductionRelease(meta, sha);
  assert.ok(errors.some(x => x.includes("not serving production")));
  assert.ok(errors.some(x => x.includes("differs from main")));
});
test("rejects nonnumeric version and missing SHA", () => {
  assert.ok(validateProductionRelease({ ...good(), version: "abc", commit: null }, sha).length >= 2);
});
test("fetches GitHub main and production with cache bypass", async () => {
  const calls = [];
  const fetcher = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, json: async () => url.includes("api.github.com")
      ? { commit: { sha } } : good() };
  };
  assert.equal((await checkProduction(fetcher)).version, "0.3.65");
  assert.equal(calls.length, 2);
  assert.ok(calls.every(x => x.opts.cache === "no-store"));
});
