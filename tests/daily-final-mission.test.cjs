const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const app = fs.readFileSync(require("node:path").join(__dirname, "../dist/app.js"), "utf8");
const first = app.indexOf("  function dailyMissionCompletionTransition(");
const last = app.indexOf("  function completeDailyMissionRound(", first);
assert.ok(first >= 0 && last > first);
const sandbox = vm.createContext({});
vm.runInContext(app.slice(first,last), sandbox);
const detect = (items, mode) => vm.runInContext("dailyMissionCompletionTransition(" + JSON.stringify(items) + "," + JSON.stringify(mode) + ")", sandbox);
test("final incomplete target is detected exactly once", () => {
  assert.equal(detect([{id:"normal",remaining:1},{id:"counting1",remaining:0}], "normal"), true);
  assert.equal(detect([{id:"normal",remaining:0},{id:"counting1",remaining:0}], "normal"), false);
});
test("earlier rounds and other enabled targets are not final", () => {
  assert.equal(detect([{id:"normal",remaining:2},{id:"counting1",remaining:0}], "normal"), false);
  assert.equal(detect([{id:"normal",remaining:1},{id:"counting1",remaining:1}], "normal"), false);
  assert.equal(detect([{id:"normal",remaining:1}], "counting1"), false);
  assert.equal(detect([], "normal"), false);
});
test("daily completion respects start context and complete-round hooks", () => {
  assert.match(app, /function startGameFromGesture\(mode\) \{[^]*?beginDailyMissionAttempt\(mode\)/);
  assert.match(app, /function showPhonicsIntro\(lessonId, modeId\) \{[^]*?beginDailyMissionAttempt\(modeId\)/);
  assert.match(app, /function finishRound\(\) \{[^]*?completeDailyMissionRound\(state.mode\)/);
  assert.match(app, /function completePhonicsYoutubeAndLeave\(\) \{[^]*?completeDailyMissionRound\(phonicsYoutube.activeModeId\)/);
  assert.match(app, /attempt.date !== japanDateKey\(\)/);
  assert.match(app, /attempt.profileId !== profileStore.getActiveProfileId\(\)/);
});
