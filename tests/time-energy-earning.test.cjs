const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../dist/app.js"), "utf8");

test("qualified time bonus is provisional pink energy, not blue energy", () => {
  const start = app.indexOf("function progressCollectionForCorrect(");
  const end = app.indexOf("function isFinalInitialQuestion()", start);
  const section = app.slice(start, end);
  assert.match(section, /roundTransaction\.timeEnergyAmount \+= timeBonus\.amount/);
  assert.match(section, /applyEnergyGain\(progress, vehicleIndex, energyGain\)/);
  assert.doesNotMatch(section, /deferredTimeBonus = \{/);
});

test("only completing a round credits pending time energy using an event ID", () => {
  const start = app.indexOf("function commitRoundTransaction()");
  const end = app.indexOf("let timeEnergySelecting", start);
  const section = app.slice(start, end);
  assert.match(section, /profileStore\.creditTimeEnergy\(pending\.timeEnergyAmount, pending\.timeEnergyEventId\)/);
  assert.match(app, /function finishRound\(\) \{\s*commitRoundTransaction\(\)/);
  assert.match(app, /timeEnergyAmount: 0/);
  assert.match(app, /function beginRoundTransaction\(\) \{\s*discardRoundTransaction\(\)/);
});
