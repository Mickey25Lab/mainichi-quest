const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../dist/app.js"), "utf8");

test("portrait mismatch recovery requires an independent physical landscape signal", () => {
  assert.match(app, /function physicalLandscapeSignal\(\)/);
  assert.match(app, /landscape-primary\|landscape-secondary/);
  assert.match(app, /Math\.abs\(legacy\) === 90/);
  assert.match(app, /first\.innerHeight > first\.innerWidth\s*&& physicalLandscapeSignal\(\)/);
  assert.match(app, /viewportIsStable\(first, current\)/);
});

test("recovery is guarded, rate limited and does not reload or reset progress", () => {
  const chunk = app.slice(app.indexOf("function scheduleViewportOrientationRecovery("), app.indexOf("function assignQuestionVisualContext("));
  assert.match(chunk, /if \(document\.hidden\) return/);
  assert.match(chunk, /30000/);
  assert.match(chunk, /window\.setTimeout\(/);
  assert.match(chunk, /orientation-recovery-result/);
  assert.match(chunk, /schedulePlayStageSize\("orientation-recovery-verify"\)/);
  assert.doesNotMatch(chunk, /location\.reload|profileStore|localStorage\.clear|beginRound\(/);
});

test("resize, page restore and viewport events feed recovery guard", () => {
  assert.match(app, /scheduleViewportOrientationRecovery\("resize"\)/);
  assert.match(app, /scheduleViewportOrientationRecovery\("pageshow"\)/);
  assert.match(app, /scheduleViewportOrientationRecovery\("orientationchange"\)/);
  assert.match(app, /scheduleViewportOrientationRecovery\("visualViewport\.resize"\)/);
});

test("MQ-001 snapshots include independent physical, CSS and PWA orientation signals", () => {
  const chunk = app.slice(app.indexOf("function diagnosticViewportSnapshot()"), app.indexOf("function recordViewportDiagnostic("));
  for (const field of ["screenOrientationType", "screenOrientationAngle", "legacyWindowOrientation",
    "mediaQueryLandscape", "displayModeStandalone", "navigatorStandalone"]) {
    assert.match(chunk, new RegExp(field + ":"));
  }
  assert.match(chunk, /window\.screen\.orientation\?\.type \?\? null/);
  assert.match(chunk, /typeof window\.orientation === "number"/);
});

test("orientation and app lifecycle events record snapshots, without altering recovery policy", () => {
  assert.match(app, /recordViewportDiagnostic\("orientationchange"\)/);
  assert.match(app, /recordViewportDiagnostic\("pageshow", \{ persisted: Boolean\(event\.persisted\) \}\)/);
  assert.match(app, /recordViewportDiagnostic\("pagehide", \{ persisted: Boolean\(event\.persisted\) \}\)/);
  assert.match(app, /recordViewportDiagnostic\("focus"\)/);
  const section = app.slice(app.indexOf("function diagnosticViewportSnapshot()"), app.indexOf("function updateViewportDiagnosticsButton()"));
  assert.doesNotMatch(section, /location\.reload|profileStore|beginRound\(/);
});

test("false portrait snapshots pin the last validated landscape app layout", () => {
  assert.match(app, /let lastStableLandscapeViewport = null/);
  assert.match(app, /function syncLandscapeViewportLayout\(snapshot = viewportSnapshot\(\)\)/);
  assert.match(app, /snapshot\.innerHeight > snapshot\.innerWidth\s*&& physicalLandscapeSignal\(\)/);
  assert.match(app, /lastStableLandscapeViewport = \{ width: snapshot\.innerWidth, height: snapshot\.innerHeight \}/);
  assert.match(app, /if \(syncLandscapeViewportLayout\(snapshot\)\) return false/);
  assert.match(app, /root\.classList\.add\("mq-viewport-landscape-pinned"\)/);
  assert.match(app, /root\.classList\.remove\("mq-viewport-landscape-pinned"\)/);
  assert.match(app, /recordViewportDiagnostic\("orientation-layout-pinned"/);
  assert.match(app, /recordViewportDiagnostic\("orientation-layout-unpinned"/);
});
test("viewport is pinned before paint and normal viewport can still update", () => {
  const scheduler = app.slice(app.indexOf("function schedulePlayStageSize("), app.indexOf("// MQ-001: iPad standalone PWAs"));
  assert.ok(scheduler.indexOf("syncLandscapeViewportLayout();") < scheduler.indexOf("window.requestAnimationFrame("));
  assert.match(app, /if \(!isNormalViewport\(snapshot\)\) return false/);
  const lock = app.slice(app.indexOf("function syncLandscapeViewportLayout("), app.indexOf("function sizePlayStage("));
  assert.doesNotMatch(lock, /location\.reload|meta\.setAttribute|profileStore|localStorage\.clear|beginRound\(/);
  const css = fs.readFileSync(path.join(__dirname, "../dist/styles.css"), "utf8");
  assert.match(css, /:root\.mq-viewport-landscape-pinned \.app\s*\{/);
  assert.match(css, /width: var\(--mq-locked-viewport-width\)/);
  assert.match(css, /height: var\(--mq-locked-viewport-height\)/);
});

test("landscape pin prevents the portrait media-query scroll switch", () => {
  const css = fs.readFileSync(path.join(__dirname, "../dist/styles.css"), "utf8");
  assert.ok(css.includes("html.mq-viewport-landscape-pinned body {"));
  const block = css.split("html.mq-viewport-landscape-pinned body {")[1]?.split("}")[0];
  assert.ok(block?.includes("overflow: hidden;"), "false portrait may not scroll the page");
  assert.ok(css.includes("@media (max-aspect-ratio: 4/5) {"));
  assert.ok(css.includes("body { overflow:auto; }"), "real portrait styling remains available");
});
