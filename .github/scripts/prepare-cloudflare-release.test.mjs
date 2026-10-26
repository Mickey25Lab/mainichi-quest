import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const generator = resolve(".github/scripts/prepare-cloudflare-release.mjs");
const sha = "0123456789abcdef0123456789abcdef01234567";
for (const [branch, expected] of [["main", "production"], ["feature/example", "preview"]]) {
  test(`Cloudflare ${expected} release metadata identifies source commit`, () => {
    const cwd = mkdtempSync(join(tmpdir(), "mq-release-"));
    try {
      mkdirSync(join(cwd, "dist"));
      const result = spawnSync(process.execPath, [generator], {
        cwd,
        env: { ...process.env, CF_PAGES_COMMIT_SHA: sha, CF_PAGES_BRANCH: branch },
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
      const meta = JSON.parse(readFileSync(join(cwd, "dist/release-meta.json"), "utf8"));
      assert.deepEqual(meta, {
        schemaVersion: 1, environment: expected, version: sha.slice(0, 12),
        commit: sha, branch,
      });
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
}
test("rejects invalid deployment commit SHA", () => {
  const cwd = mkdtempSync(join(tmpdir(), "mq-release-invalid-"));
  try {
    mkdirSync(join(cwd, "dist"));
    const result = spawnSync(process.execPath, [generator], {
      cwd,
      env: { ...process.env, CF_PAGES_COMMIT_SHA: "bad", CF_PAGES_BRANCH: "main" },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
