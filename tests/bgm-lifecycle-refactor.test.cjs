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
  assert.match(show, /restoreForegroundBackgroundMusic/);
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

test("foreground restoration is shared by resume and AudioContext running events", () => {
  const restore = section("function restoreForegroundBackgroundMusic", "function resumeAudioAfterVisible");
  const resume = section("function resumeAudioAfterVisible", "function audioContext");
  const context = section("function audioContext", "function loadBgmEnabledPreference");
  assert.match(restore, /restoreAudioGainAfterVisibility\(\)/);
  assert.match(restore, /if \(!document\.hidden\) syncBackgroundMusicForActiveScreen\(\)/);
  assert.match(resume, /Promise\.resolve\(resumed\)\.finally\(restoreForegroundBackgroundMusic\)/);
  assert.match(context, /state\.audio\?\.state === "running" && !document\.hidden\) restoreForegroundBackgroundMusic\(\)/);
  assert.doesNotMatch(resume, /stopBackgroundMusic\(/);
  assert.doesNotMatch(resume, /disconnectBackgroundMusicSource\(/);
});

test("user gestures remain able to retry suspended AudioContext resume", () => {
  const resumeContext = section("function resumeAudioContext", "function clearAudioVisibilitySuspendTimer");
  assert.match(resumeContext, /Promise\.resolve\(ctx\.resume\(\)\)/);
  assert.doesNotMatch(resumeContext, /if \(audioResumePromise\) return/);
  assert.match(app, /window\.addEventListener\("pointerdown", \(\) => primeBackgroundMusicFromGesture\(\)/);
  assert.match(app, /window\.addEventListener\("touchstart", \(\) => primeBackgroundMusicFromGesture\(\)/);
});

test("screen transitions share invalidation without changing fade time", () => {
  const invalidate = section("function invalidateBgmFadeTransition", "function cancelBgmTransitionForLifecycle");
  const transition = section("function transitionBackgroundMusic", "function setBackgroundMusicDucked");
  const select = section("function setDesiredBgmGroup", "function syncBackgroundMusicForActiveScreen");
  assert.match(invalidate, /state\.bgmTransitionId \+= 1/);
  assert.match(invalidate, /clearBgmFadeTimer\(\)/);
  assert.match(transition, /const transitionId = invalidateBgmFadeTransition\(\)/);
  assert.match(transition, /bgmConfig\.transitionDurationSeconds \* 1000/);
  assert.match(select, /invalidateBgmFadeTransition\(\)/);
  assert.match(transition, /transitionId !== state\.bgmTransitionId \|\| document\.hidden \|\| audioMutedForBackground/);
});
