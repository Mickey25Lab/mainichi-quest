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

const vm = require("node:vm");

function timeBonusHarness(overrides = {}) {
  const a = app.indexOf("function timeBonusAnswerDigits(");
  const b = app.indexOf("const acquisitionDefinitions", a);
  assert.ok(a >= 0 && b > a, "time bonus functions located");
  const progress = { discovered:true, friendly:true, masterMedal:false, energy:3, stage:2,
    ...(overrides.progress || {}) };
  const context = vm.createContext({
    state: { phase:"initial", mode:"normal", currentVehicleIndex:0, ...overrides.state },
    timeBonusConfig: { enabled:true, amount:1, modes:["normal","multiplication2x2"],
      limitMsByAnswerDigits:{1:4000,2:5000,3:10000,4:15000,5:20000}},
    vehicleProgress: () => progress,
    performance: {now:()=>6000}
  });
  vm.runInContext(app.slice(a,b),context);
  return { context, run(question) {
    context.state.current = question;
    return vm.runInContext("getTimeBonusForCorrect(state.current)",context);
  }};
}

test("actual time qualification function handles thresholds, wrong answers and review", () => {
  const h = timeBonusHarness();
  const valid = {kind:"normal",quotient:12,remainder:0,timeBonusStartedAt:1000};
  assert.equal(h.run(valid).amount,1); // exactly 5s qualifies
  assert.equal(h.run({...valid,timeBonusStartedAt:999}),null);
  assert.equal(h.run({...valid,hadWrong:true}),null);
  assert.equal(h.run({...valid,hintUsed:true}),null);
  assert.equal(h.run({...valid,answerRevealed:true}),null);
  assert.equal(h.run({...valid,progressPenalty:true}),null);
  assert.equal(h.run({...valid,isReview:true}),null);
  h.context.state.mode = "counting1";
  assert.equal(h.run(valid),null);
});

test("time bonus requires a vehicle in energy stage", () => {
  const h = timeBonusHarness({progress:{friendly:false}});
  assert.equal(h.run({kind:"normal",quotient:12,remainder:0,timeBonusStartedAt:1000}),null);
});
