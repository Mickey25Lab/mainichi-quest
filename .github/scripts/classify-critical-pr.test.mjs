import test from "node:test";
import assert from "node:assert/strict";
import { classifyCriticalFiles } from "./classify-critical-pr.mjs";

test("shared app changes are critical", () => {
  for (const name of ["dist/app.js", "dist/index.html", "dist/scripts/profile-storage.js", ".github/workflows/playwright-browser-smokes.yml", ".github/scripts/classify-critical-pr.mjs"]) {
    assert.equal(classifyCriticalFiles([name]).critical, true, name);
  }
});

test("test updates trigger regression coverage", () => {
  assert.equal(classifyCriticalFiles(["tests/profile-storage.test.cjs"]).critical, true);
});

test("visual-only and documentation edits keep the existing standard checks", () => {
  assert.equal(classifyCriticalFiles(["dist/styles.css", "docs/master/foo.md", "README.md"]).critical, false);
});

test("classification ignores duplicates and blank lines", () => {
  assert.deepEqual(classifyCriticalFiles(["", " dist/app.js ", "dist/app.js"]).reasons, ["dist/app.js"]);
});

test("unrelated paths do not accidentally match", () => {
  assert.equal(classifyCriticalFiles(["archive/dist/app.js", "tests/fixtures/data.json"]).critical, false);
});
