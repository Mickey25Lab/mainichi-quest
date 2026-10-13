const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.resolve(__dirname, "../dist/app.js"), "utf8");

test("all six acquisition types are declared by the shared commit flow", () => {
  const expected = [
    ["vehicle_discovered", 1],
    ["friendship_complete", 1],
    ["robot", 2],
    ["super_robot", 3],
    ["super_robot_equipped", 4],
    ["master_medal", 5]
  ];
  expected.forEach(([type, stage]) => {
    assert.match(app, new RegExp(`${type}: Object\\.freeze\\(\\{ rewardStage: ${stage},`));
  });
});

test("history persistence is owned by commitAcquisition, not session rendering", () => {
  const sessionFunction = app.slice(app.indexOf("function addCompletedRewardToSession"), app.indexOf("function recordCommittedAcquisition"));
  const commitFunction = app.slice(app.indexOf("function commitAcquisition"), app.indexOf("function saveCollectionProgress"));
  assert.doesNotMatch(sessionFunction, /AcquisitionHistory|recordCommittedAcquisition/);
  assert.match(commitFunction, /recordCommittedAcquisition\(/);
  assert.match(commitFunction, /addCompletedRewardToSession\(reward\)/);
  assert.match(commitFunction, /saveCollectionProgress\(\)/);
});

test("normal and time-bonus evolution both converge on completeEnergyStage", () => {
  const completionFunction = app.slice(app.indexOf("function completeEnergyStage"), app.indexOf("function applyEnergyGain"));
  const deferredFunction = app.slice(app.indexOf("function finishDeferredTimeBonusProgress"), app.indexOf("function playTimeBonusSequence"));
  assert.match(completionFunction, /commitAcquisition\(\{ vehicleIndex, acquisitionType, stage, source \}\)/);
  assert.match(deferredFunction, /completeEnergyStage\(progress, deferred\.vehicleIndex, "time_bonus"\)/);
});
