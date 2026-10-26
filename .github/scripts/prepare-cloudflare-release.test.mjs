import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const generator = resolve(".github/scripts/prepare-cloudflare-release.mjs");
function run(cmd, args, cwd, env = {}) {
  const result = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, encoding: "utf8" });
  assert.equal(result.status, 0, `${cmd} ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}
test("semantic numeric versions follow main only; previews never advance the version", () => {
  const root = mkdtempSync(join(tmpdir(), "mq-cloudflare-release-"));
  try {
    const origin = join(root, "origin.git"), clone = join(root, "clone");
    run("git", ["init", "--bare", origin], root);
    run("git", ["clone", origin, clone], root);
    run("git", ["config", "user.name", "CI"], clone);
    run("git", ["config", "user.email", "ci@example.test"], clone);
    run("git", ["checkout", "-b", "main"], clone);
    mkdirSync(join(clone, "dist"));
    writeFileSync(join(clone, "test.txt"), "one");
    run("git", ["add", "."], clone);
    run("git", ["commit", "-m", "initial"], clone);
    run("git", ["tag", "mq-prod-v0.3.61"], clone);
    run("git", ["push", "-u", "origin", "main", "--tags"], clone);
    writeFileSync(join(clone, "test.txt"), "two");
    run("git", ["commit", "-am", "first release"], clone);
    run("git", ["push"], clone);
    const first = run("git", ["rev-parse", "HEAD"], clone);
    function generate(branch, sha) {
      run(process.execPath, [generator], clone, { CF_PAGES_BRANCH: branch, CF_PAGES_COMMIT_SHA: sha });
      return JSON.parse(readFileSync(join(clone, "dist/release-meta.json"), "utf8"));
    }
    const prod = generate("main", first);
    assert.equal(prod.version, "0.3.62");
    assert.equal(prod.environment, "production");
    assert.equal(prod.commit, first);
    run("git", ["checkout", "-b", "feature/example"], clone);
    writeFileSync(join(clone, "test.txt"), "preview");
    run("git", ["commit", "-am", "preview only"], clone);
    const previewSha = run("git", ["rev-parse", "HEAD"], clone);
    const preview = generate("feature/example", previewSha);
    assert.equal(preview.version, "0.3.62");
    assert.equal(preview.environment, "preview");
    assert.equal(preview.commit, previewSha);
    assert.equal(preview.releaseCommit, first);
    run("git", ["checkout", "main"], clone);
    writeFileSync(join(clone, "test.txt"), "third");
    run("git", ["commit", "-am", "second release"], clone);
    run("git", ["push"], clone);
    assert.equal(generate("main", run("git", ["rev-parse", "HEAD"], clone)).version, "0.3.63");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
