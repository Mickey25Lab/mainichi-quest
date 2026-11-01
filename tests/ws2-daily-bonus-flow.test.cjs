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

test("WS2 PR7 keeps bonus action inside visible completion panel", () => {
  const css = fs.readFileSync("dist/styles.css", "utf8");
  assert.match(css, /WS2 PR7: keep the claim button inside the visible completion panel/);
  assert.match(css, /\.mode-select-screen > \.mode-select-mission-complete \{\s*gap:12px;\s*padding:32px 42px;/);
  assert.match(css, /\.mode-select-screen > \.mode-select-mission-complete #quest-bonus-continue:not\(\[hidden\]\)/);
  assert.match(app, /banner\.dataset\.bonusStatus/);
});

test("WS2 PR7 QA scenario starts from developer panel with eight isolated time energy", () => {
  assert.match(app, /QA：ミッションぜんぶクリア → ボーナスをもらう！/);
  assert.match(app, /if \(!qaProgressModeEnabled\(\)\) return;\s*const qa = profileStore\.getActiveQaState\(\);/);
  assert.match(app, /dailyBonusScenario: \{ date:japanDateKey\(\), questClaimDate:null \}/);
  assert.match(app, /timeEnergy: \{ balance:0, allocation:null, completed:\[\] \}/);
  assert.match(app, /profileStore\.creditTimeEnergy\(8, "qa-daily-bonus-"/);
  assert.match(app, /dailyBonusFlow = false;\s*endToModeSelect\(\)/);
  assert.match(app, /const completed = qaDailyBonusScenario\(\) \? target :/);
});
test("WS2 PR7 QA quest bonus is claimed only in QA state and does not mutate the real claim date", () => {
  const qaSave = app.slice(app.indexOf('function saveRewardProgress()'),app.indexOf('function syncCollectionFromRewardProgress()'));
  assert.match(qaSave, /if \(questBonusClaimPendingDate && qaDailyBonusScenario\(\)\)/);
  assert.match(qaSave, /dailyBonusScenario:\{ \.\.\.qa\.dailyBonusScenario, questClaimDate:questBonusClaimPendingDate \}/);
  assert.match(qaSave, /questBonusClaimPendingDate = null;/);
  assert.match(app, /function questBonusClaimedDate\(\)/);
  assert.match(app, /if \(\(qaProgressModeEnabled\(\) && !qaDailyBonusScenario\(\)\) \|\| questBonusSelecting/);
});
