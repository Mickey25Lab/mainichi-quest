import test from "node:test";
import assert from "node:assert/strict";
import { checkVersionBump } from "./check-app-version-bump.mjs";

const appJs = (version) => `(() => {\n  const appVersion = "${version}";\n})();\n`;

function check(changedFiles, baseVersion = "0.1.1", headVersion = baseVersion) {
  return () => checkVersionBump({
    changedFiles,
    baseAppJs: appJs(baseVersion),
    headAppJs: appJs(headVersion)
  });
}

test("dist/app.js change without version bump fails", () => {
  assert.throws(check(["dist/app.js"]), /must be bumped exactly one patch/);
});

test("dist/styles.css change without version bump fails", () => {
  assert.throws(check(["dist/styles.css"]), /must be bumped exactly one patch/);
});

test("dist/assets change without version bump fails", () => {
  assert.throws(check(["dist/assets/ui/icon.png"]), /must be bumped exactly one patch/);
});

test("dist/app.js change with patch plus one passes", () => {
  const result = check(["dist/app.js"], "0.1.1", "0.1.2")();
  assert.equal(result.required, true);
  assert.equal(result.headVersion, "0.1.2");
});

test("docs-only change passes without version bump", () => {
  const result = check(["docs/guide.md"])();
  assert.equal(result.required, false);
});

test("asset-source-only change passes without version bump", () => {
  const result = check(["asset-source/collection/source.png"])();
  assert.equal(result.required, false);
});

test("minor, major, skipped patch, lower, and invalid versions fail", () => {
  assert.throws(check(["dist/index.html"], "0.1.1", "0.2.0") , /0\.1\.2/);
  assert.throws(check(["dist/index.html"], "0.1.1", "1.0.0") , /0\.1\.2/);
  assert.throws(check(["dist/index.html"], "0.1.1", "0.1.3") , /0\.1\.2/);
  assert.throws(check(["dist/index.html"], "0.1.1", "0.1.0") , /0\.1\.2/);
  assert.throws(() => checkVersionBump({ changedFiles:["dist/index.html"], baseAppJs:appJs("0.1.1"), headAppJs:'const appVersion = "next";' }), /must appear exactly once/);
});
