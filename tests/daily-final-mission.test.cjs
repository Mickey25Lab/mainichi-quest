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

test("parent target changes only update completion state; they do not trigger an award", () => {
  assert.equal(detect([{id:"normal",remaining:0},{id:"counting1",remaining:1}], "normal"), false);
  assert.equal(detect([{id:"normal",remaining:0},{id:"counting1",remaining:1}], "counting1"), true);
  assert.equal(detect([{id:"normal",remaining:0}], "normal"), false);
  assert.equal(detect([{id:"normal",remaining:1}], "normal"), true);
});
test("only a completed attempt can save completion and emit a final signal", () => {
  assert.match(app, /if \(!attempt \|\| attempt.mode !== mode/);
  assert.match(app, /if \(isFinal\) lastDailyMissionCompletion =/);
  assert.match(app, /function endToModeSelect\(\) \{\s*cancelDailyMissionAttempt\(\)/);
  assert.match(app, /function leavePhonicsYoutube\(\) \{\s*cancelDailyMissionAttempt\(\)/);
  assert.match(app, /function dailyMissionCompletionTransition\(items, completedMode\) \{\s*if \(!items.length\) return false/);
});

test("parent can set every mode to zero without persisting before Save", () => {
  const html = fs.readFileSync(require("node:path").join(__dirname, "../dist/index.html"), "utf8");
  assert.match(html, /id="parent-all-modes-off"/);
  const first = app.indexOf("  function setAllParentTargetsToZero()");
  const last = app.indexOf("  function saveParentSettings()", first);
  assert.ok(first >= 0 && last > first);
  const implementation = app.slice(first, last);
  assert.match(implementation, /parentDraftForProfile\(parentSettingsProfileId\)/);
  assert.match(implementation, /for \(const mode of parentModeDefinitions\)/);
  assert.match(implementation, /settings\.dailyTargetCounts\[mode\.id\] = 0/);
  assert.match(implementation, /settings\.enabledModes\[mode\.id\] = false/);
  assert.doesNotMatch(implementation, /setProfileLearningSettings/);
  assert.match(app, /parent-all-modes-off"\)\.addEventListener\("click", setAllParentTargetsToZero\)/);
});

test("quest reward quantity and timer fallback remain separate from phonics", () => {
  assert.match(app, /if \(questBonusSelecting\) return \{ friendship:5, energy:8 \+ \(/);
  assert.match(app, /function startQuestBonusTimer\(\) \{[^]*?questBonusDeadline = Date\.now\(\) \+ 30000/);
  assert.match(app, /const displayed = remaining <= 10 \? remaining : Math\.ceil\(remaining \/ 10\) \* 10/);
  assert.match(app, /const candidates = collectionDisplayOrder\.filter\(index => vehicleProgress\(index\)\.discovered\)/);
  assert.match(app, /Math\.floor\(Math\.random\(\) \* candidates\.length\)/);
  assert.match(app, /applyPhonicsRewardGrowth\(choice, openNormalCollectionAfterPhonicsReward\)/);
  assert.match(app, /return progress\.friendly \? .エネルギー \+\$\{amounts\.energy\}. : .ハート \+\$\{amounts\.friendship\}./);
});
