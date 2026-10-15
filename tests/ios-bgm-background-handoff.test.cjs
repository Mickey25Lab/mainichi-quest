const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../dist/app.js"), "utf8");

test("background handoff is idempotent across blur, pagehide and visibilitychange", () => {
  const fn = app.slice(app.indexOf("function suspendAudioForBackground("), app.indexOf("function resumeAudioAfterVisible("));
  assert.match(fn, /if \(audioMutedForBackground\) return;/);
  assert.ok(fn.indexOf("if (audioMutedForBackground) return;") < fn.indexOf("cancelBgmTransitionForLifecycle()"));
  assert.ok(fn.indexOf("if (audioMutedForBackground) return;") < fn.indexOf("window.clearTimeout(audioVisibilitySuspendTimer)"));
  assert.match(fn, /gain\.linearRampToValueAtTime\(0\.0001/);
  assert.match(fn, /state\.audio\.suspend\(\)/);
});

test("background event listeners share the one handoff function", () => {
  assert.match(app, /suspendAudioForBackground\("blur"/);
  assert.match(app, /suspendAudioForBackground\("pagehide"/);
  assert.match(app, /suspendAudioForBackground\("visibilitychange:hidden"\)/);
});
