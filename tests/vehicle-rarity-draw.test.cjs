const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const app = fs.readFileSync(path.resolve(__dirname, "../dist/app.js"), "utf8");
const start = app.indexOf("function raritiesForDraw(");
const end = app.indexOf("function prepareInitialVehicle()", start);
assert.ok(start >= 0 && end > start, "vehicle rarity drawing functions exist");
const drawing = app.slice(start, end);

test("rarity eligibility depends only on consecutive correct answers", () => {
  const context = { Set, Math, state: { recentVehicleHistory: [], correctStreak: 0, currentVehicleIndex: -1 }, vehicles: [], preloadVehicleVisuals() {}, currentStageForVehicle() { return 1; }, saveRecentVehicles() {} };
  vm.runInNewContext(drawing, context);
  const expected = [
    [0, ["normal"]],
    [1, ["normal"]],
    [2, ["normal", "special"]],
    [3, ["normal", "special", "rare"]],
    [4, ["normal", "special", "rare"]],
    [5, ["normal", "special", "rare", "super-rare"]],
    [9, ["normal", "special", "rare", "super-rare"]]
  ];
  for (const [streak, rarities] of expected) {
    assert.deepEqual(Array.from(context.raritiesForDraw(streak)), rarities, "streak " + streak);
  }
  assert.doesNotMatch(drawing, /afterStage5/, "stage-five special eligibility is removed");
});

test("a five-answer streak includes super-rare without excluding normal", () => {
  const pool = ["normal", "special", "rare", "super-rare"].map((rarity, index) => ({ index, rarity, weight: 1 }));
  const context = { Set, Math, state: { recentVehicleHistory: [], correctStreak: 5, currentVehicleIndex: -1 }, vehicles: pool, preloadVehicleVisuals() {}, currentStageForVehicle() { return 1; }, saveRecentVehicles() {} };
  vm.runInNewContext(drawing, context);
  assert.deepEqual(Array.from(context.candidatesForDraw(5, [], pool)).map(v => v.rarity), ["normal", "special", "rare", "super-rare"]);
  assert.deepEqual(Array.from(context.candidatesForDraw(4, [], pool)).map(v => v.rarity), ["normal", "special", "rare"]);
  assert.deepEqual(Array.from(context.candidatesForDraw(5, [3], pool)).map(v => v.rarity), ["normal", "special", "rare"], "recent vehicles remain excluded");
});

test("reward-stage-specific selector is not used", () => {
  assert.doesNotMatch(app, /startNextVehicleChallenge\(\{\s*afterStage5/);
  assert.doesNotMatch(app, /afterStage5/);
});
