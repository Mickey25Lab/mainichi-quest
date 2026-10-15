const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dist = path.join(__dirname, "../dist");
const app = fs.readFileSync(path.join(dist, "app.js"), "utf8");
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const css = fs.readFileSync(path.join(dist, "styles.css"), "utf8");

test("BGM diagnostic is opt-in, bounded, and survives reload", () => {
  assert.match(app, /bgm-loss-diagnostics-enabled-v1/);
  assert.match(app, /bgm-loss-diagnostics-log-v1/);
  assert.match(app, /if \(!bgmDiagnosticsEnabled\) return/);
  assert.match(app, /bgmDiagnostics\.splice\(0, bgmDiagnostics\.length - 120\)/);
  assert.match(app, /localStorage\.setItem\(bgmDiagnosticStorageKey/);
  assert.match(app, /function setupBgmDiagnostics\(/);
  assert.match(app, /recordBgmDiagnostic\("possible-silence"\)/);
  assert.match(app, /recordBgmDiagnostic\("background-suspend"/);
  assert.match(app, /recordBgmDiagnostic\("foreground-resume"/);
  assert.match(app, /recordBgmDiagnostic\("audio-context-statechange"/);
  assert.match(app, /navigator\.clipboard\.writeText\(report\)/);
});

test("admin UI switches and daily actions have legible labels", () => {
  assert.match(html, /画面拡大診断/);
  assert.doesNotMatch(html, /MQ-001診断/);
  assert.match(html, /BGM消失診断/);
  assert.match(html, /id="admin-bgm-diagnostics-toggle"/);
  assert.match(app, /"click", toggleBgmDiagnostics/);
  assert.match(css, /\.profile-card \.admin-action-button \{[^}]*text-align:center/);
  assert.match(html, /id="admin-reenable-collection"/);
  assert.match(html, /id="admin-reenable-opening-movie"/);
});
