const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("dist/app.js", "utf8");
const html = fs.readFileSync("dist/index.html", "utf8");

test("WS2 PR7 reuses existing mode-complete popup and starts from its button", () => {
  assert.match(html, /id="mode-select-mission-complete"/);
  assert.match(app, /quest-bonus-continue"\)\.addEventListener\("click", beginDailyBonusFlow\)/);
  assert.match(app, /const bonusAvailable = overview\.allComplete/);
  assert.match(app, /questButton\.textContent = "ボーナスをもらう！"/);
});
test("WS2 PR7 allocates time energy before quest, then returns to existing mode selection", () => {
  const flow = app.slice(app.indexOf("function beginDailyBonusFlow()"), app.indexOf('  $("quest-bonus-continue").addEventListener("click", beginDailyBonusFlow)'));
  assert.match(flow, /if \(time\.allocation \|\| time\.balance > 0\)/);
  assert.match(flow, /openTimeEnergyAllocation\(\)/);
  assert.match(flow, /questBonusAvailable\(\) && promptQuestBonusIfAvailable\(\)/);
  assert.match(flow, /endToModeSelect\(\)/);
  assert.match(app, /dailyBonusFlow \? finishDailyTimeBonusFlow : showPhonicsCollectionHandoff/);
  assert.match(app, /completedQuestBonus && dailyBonusFlow/);
});
test("WS2 PR7 leaves existing earning formulas and atomic storage paths intact", () => {
  assert.match(app, /energy:9 \+ \(dailyMissionState\(\)\.questRewardLevel/);
  assert.match(app, /profileStore\.commitTimeEnergyAllocation\(/);
  assert.match(app, /questBonusClaimDate: questBonusClaimPendingDate/);
});
