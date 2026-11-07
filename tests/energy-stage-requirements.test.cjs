const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const app = fs.readFileSync(path.join(__dirname, "../dist/app.js"), "utf8");

function energyRules() {
  const start = app.indexOf("const energyRequirementsByStage =");
  const end = app.indexOf("function energyStageForRequired(", start);
  assert.ok(start >= 0 && end > start, "shared stage rules exist");
  const context = vm.createContext({});
  vm.runInContext(app.slice(start, end), context);
  return (stage, masterMedal = false) =>
    vm.runInContext("requiredEnergyForProgress({ stage:" + stage + ", masterMedal:" + masterMedal + " })", context);
}

test("all evolution stages use the same energy threshold table", () => {
  const required = energyRules();
  assert.equal(required(2), 30);
  assert.equal(required(3), 50);
  assert.equal(required(4), 100);
  assert.equal(required(5), 200);
  assert.equal(required(5, true), 500);
});

test("all charge and display paths derive required energy from progress", () => {
  assert.doesNotMatch(app, /masterMedal\s*\?\s*500\s*:\s*requiredEnergyForStage/);
  for (const name of ["animateSelectedVehicleCharge", "applyTimeEnergyCharge", "renderVehicleProgressUi",
    "applyEnergyGain", "renderCollectionGrid"]) {
    const start = app.indexOf("function " + name + "(");
    assert.ok(start >= 0, name + " exists");
    const section = app.slice(start, start + 5500);
    assert.match(section, /requiredEnergyForProgress\(/, name + " uses common rules");
  }
});
