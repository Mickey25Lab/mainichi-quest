const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../dist/app.js"), "utf8");

test("MQ-001 preserves the existing opt-in preference and stored history", () => {
  assert.match(app, /mq-001:viewport-diagnostics-enabled-v1/);
  assert.match(app, /mq-001:viewport-diagnostics-v1/);
  assert.match(app, /if \(!viewportDiagnosticsEnabled\) return;/);
  assert.match(app, /viewportDiagnostics = stored\.slice\(-180\)/);
  assert.match(app, /viewportDiagnostics\.slice\(-180\)/);
});

test("MQ-001 captures geometry needed to distinguish layout viewport from visual viewport", () => {
  const start = app.indexOf("function diagnosticViewportSnapshot()");
  const end = app.indexOf("function recordViewportDiagnostic(", start);
  assert.ok(start >= 0 && end > start);
  const body = app.slice(start, end);
  [
    "innerWidth", "innerHeight", "clientWidth", "clientHeight",
    "screenWidth", "screenHeight", "devicePixelRatio",
    "visualViewportWidth", "visualViewportHeight", "visualViewportScale",
    "visualViewportOffsetLeft", "visualViewportOffsetTop",
    "appRect", "stageRect", "appTransform", "stageTransform",
    "scrollX", "scrollY", "visibilityState", "stageScale"
  ].forEach((field) => assert.match(body, new RegExp("\\b" + field + "\\b")));
  assert.match(body, /getBoundingClientRect\(\)/);
  assert.doesNotMatch(body, /rewardProgress|profileStore|questionAnswer/);
});

test("MQ-001 samples play-time geometry only when enabled and visible", () => {
  assert.match(app, /if \(!viewportDiagnosticsEnabled \|\| document\.hidden\) return;/);
  assert.match(app, /recordViewportDiagnostic\(signature !== lastGeometry \? "geometry-change" : "geometry-baseline"\)/);
  assert.match(app, /}, 5000\);/);
  assert.match(app, /now - lastBaselineAt >= 30000/);
  assert.match(app, /recordViewportDiagnostic\("window\.resize"\)/);
  assert.match(app, /recordViewportDiagnostic\("visualViewport\.scroll"\)/);
});

test("MQ-001 keeps log export anchored at the top and does not automatically reload", () => {
  const start = app.indexOf("function setupViewportDiagnostics()");
  const end = app.indexOf("async function updateVersionLabelWithPreviewMetadata", start);
  assert.ok(start >= 0 && end > start);
  const body = app.slice(start, end);
  assert.match(body, /top: "8px"/);
  assert.match(body, /left: "8px"/);
  assert.match(body, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(body, /location\.reload\(|window\.location\.assign\(/);
});

test("MQ-001 admin toggle is visible rather than inside a hidden row", () => {
  const html = fs.readFileSync(path.join(__dirname, "../dist/index.html"), "utf8");
  const row = html.match(/<div class="admin-setting-row"([^>]*)>\s*<span>画面拡大診断<\/span>\s*<button[^>]*id="admin-viewport-diagnostics-toggle"/);
  assert.ok(row, "MQ-001 toggle must exist in developer tools");
  assert.doesNotMatch(row[1], /\bhidden\b/);
});
