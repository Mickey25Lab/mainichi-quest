const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../dist/app.js"), "utf8");
const section = (from, to) => app.slice(app.indexOf(from), app.indexOf(to));

test("background suspension owns a single cancellable timer", () => {
  const clear = section("function clearAudioVisibilitySuspendTimer", "function scheduleAudioVisibilitySuspend");
  const schedule = section("function scheduleAudioVisibilitySuspend", "function suspendAudioForBackground");
  const hide = section("function suspendAudioForBackground", "function resumeAudioAfterVisible");
  const show = section("function resumeAudioAfterVisible", "function audioContext");
  assert.match(clear, /window\.clearTimeout\(audioVisibilitySuspendTimer\)/);
  assert.match(clear, /audioVisibilitySuspendTimer = null/);
  assert.match(schedule, /audioVisibilitySuspendTimer = window\.setTimeout/);
  assert.match(schedule, /requireHidden && !document\.hidden/);
  assert.match(schedule, /state\.audio\.suspend\(\)/);
  assert.match(hide, /clearAudioVisibilitySuspendTimer\(\)/);
  assert.match(hide, /scheduleAudioVisibilitySuspend\(requireHidden, suspendDelayMs\)/);
  assert.match(show, /clearAudioVisibilitySuspendTimer\(\)/);
  assert.match(show, /restoreAudioGainAfterVisibility\(\)/);
  assert.match(show, /syncBackgroundMusicForActiveScreen\(\)/);
});

test("iOS handoff preserves existing fade timings and transition cancellation", () => {
  const hide = section("function suspendAudioForBackground", "function resumeAudioAfterVisible");
  assert.match(hide, /fadeMs = 80, suspendDelayMs = 100/);
  assert.match(hide, /cancelBgmTransitionForLifecycle\(\)/);
  assert.match(hide, /gain\.linearRampToValueAtTime\(0\.0001, ctx\.currentTime \+ fadeMs \/ 1000\)/);
  assert.match(app, /suspendAudioForBackground\("pagehide", \{ requireHidden: false, fadeMs: 24, suspendDelayMs: 40 \}\)/);
  assert.match(app, /suspendAudioForBackground\("blur", \{ requireHidden: false, fadeMs: 24, suspendDelayMs: 40 \}\)/);
  assert.doesNotMatch(hide, /if \(audioMutedForBackground\) return/);
});
