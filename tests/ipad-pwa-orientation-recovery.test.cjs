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
