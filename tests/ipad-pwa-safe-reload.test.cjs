const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../dist/app.js"), "utf8");
const recovery = app.slice(app.indexOf("const orientationReloadAttemptKey"), app.indexOf("function assignQuestionVisualContext("));

test("last-resort reload only runs when PWA reports false portrait and orientation remains landscape", () => {
  assert.match(recovery, /function persistentFalsePortrait\(\)/);
  assert.match(recovery, /display-mode: standalone/);
  assert.match(recovery, /snapshot\.innerHeight > snapshot\.innerWidth/);
  assert.match(recovery, /physicalLandscapeSignal\(\)/);
  assert.match(recovery, /if \(!persistentFalsePortrait\(\)\) return/);
});

test("never auto-reload an active question, reward, or onboarding overlay", () => {
  assert.match(recovery, /function isSafeOrientationReloadScreen\(\)/);
  assert.match(recovery, /state\.transitioning \|\| state\.confirmingAnswer \|\| state\.confirmingQuit/);
  assert.match(recovery, /start\?\.classList\.contains\("active"\) \|\| modes\?\.classList\.contains\("active"\)/);
  assert.match(recovery, /if \(!isSafeOrientationReloadScreen\(\)\)/);
  assert.match(recovery, /orientation-reload-deferred/);
});

test("reload attempts are session-guarded, cooldown-limited and delayed", () => {
  assert.match(recovery, /const orientationReloadCooldownMs = 10 \* 60 \* 1000/);
  assert.match(recovery, /sessionStorage\.setItem\(orientationReloadAttemptKey, String\(Date\.now\(\)\)\)/);
  assert.match(recovery, /orientation-reload-skipped/);
  assert.match(recovery, /\}, 3000\)/);
  assert.match(recovery, /window\.location\.reload\(\)/);
  assert.ok(recovery.indexOf("sessionStorage.setItem(") < recovery.indexOf("window.location.reload()"));
});

test("prior meta retry is preserved and failure alone triggers fallback", () => {
  assert.match(recovery, /recordViewportDiagnostic\("orientation-recovery-result", \{ recovered, reason \}\)/);
  assert.match(recovery, /if \(!recovered\) queueSafeOrientationReload\(reason\)/);
  assert.match(app, /queueSafeOrientationReload\("safe-screen"\)/);
  assert.match(app, /orientation-reload-observed/);
});

test("fallback does not read or mutate player progress", () => {
  assert.doesNotMatch(recovery, /profileStore|localStorage\.clear|discardRoundTransaction|beginRound\(/);
});
