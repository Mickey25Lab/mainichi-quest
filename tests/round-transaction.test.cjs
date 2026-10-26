const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require("node:path").join(__dirname, "../dist/app.js"), "utf8");
const begin = source.indexOf("  let roundTransaction = null;");
const end = source.indexOf("  function syncCollectionFromRewardProgress()", begin);
assert.ok(begin >= 0 && end > begin, "round transaction implementation exists");
const transactionSource = source.slice(begin, end);

function createHarness(persisted = { progress: [{ energy: 10 }], collection: [2], recent: ["a"], history: [] }) {
  const data = structuredClone(persisted);
  let activeProfile = "child-one";
  const calls = [];
  const store = {
    getActiveProfileId: () => activeProfile,
    setRewardProgress: (value) => { calls.push("qa-save"); data.progress = structuredClone(value); },
    commitRewardProgressWithPoints: (value) => { calls.push("commit-points"); data.progress = structuredClone(value); },
    appendAcquisitionHistory: (value) => { calls.push("history"); data.history.push(structuredClone(value)); }
  };
  const context = vm.createContext({
    profileStore: store,
    state: { rewardProgress: structuredClone(data.progress), collection: [...data.collection], recentVehicleHistory: [...data.recent] },
    capsuleSpendPending: false,
    qaProgressModeEnabled: () => false,
    saveCollectionProgress() {
      vm.runInContext("saveRewardProgress()", context);
      data.collection = structuredClone(context.state.collection);
      calls.push("collection");
    },
    saveRecentVehicles() { data.recent = structuredClone(context.state.recentVehicleHistory); calls.push("recent"); },
    console
  });
  vm.runInContext(transactionSource, context);
  return {
    context, data, calls,
    execute(code) { return vm.runInContext(code, context); },
    switchProfile(id) { activeProfile = id; }
  };
}

test("incomplete rounds never write points, progress, collection or acquisitions", () => {
  const h = createHarness();
  h.execute("beginRoundTransaction(); state.rewardProgress[0].energy = 90; state.collection[0] = 4; state.recentVehicleHistory.push('b'); roundTransaction.acquisitionHistory.push({ vehicleId: 'b' }); saveRewardProgress()");
  assert.equal(h.data.progress[0].energy, 10);
  assert.deepEqual(h.data.collection, [2]);
  assert.deepEqual(h.data.history, []);
  assert.deepEqual(h.calls, []);
  h.execute("discardRoundTransaction()");
  assert.equal(h.context.state.rewardProgress[0].energy, 10);
  assert.equal(h.context.state.collection[0], 2);
  assert.deepEqual(Array.from(h.context.state.recentVehicleHistory), ["a"]);
});

test("finishing a round commits its rewards once and then records acquisitions", () => {
  const h = createHarness();
  h.execute("beginRoundTransaction(); state.rewardProgress[0].energy = 90; state.collection[0] = 4; roundTransaction.acquisitionHistory.push({ vehicleId: 'b' }); saveRewardProgress(); commitRoundTransaction(); commitRoundTransaction()");
  assert.equal(h.data.progress[0].energy, 90);
  assert.deepEqual(h.data.collection, [4]);
  assert.deepEqual(h.data.history, [{ vehicleId: "b" }]);
  assert.deepEqual(h.calls, ["commit-points", "collection", "recent", "history"]);
});

test("reload leaves only previously committed state", () => {
  const h = createHarness();
  h.execute("beginRoundTransaction(); state.rewardProgress[0].energy = 90; saveRewardProgress()");
  const next = createHarness(h.data);
  assert.equal(next.context.state.rewardProgress[0].energy, 10);
});

test("a profile change cannot commit another child's pending rewards", () => {
  const h = createHarness();
  h.execute("beginRoundTransaction(); state.rewardProgress[0].energy = 999");
  h.switchProfile("child-two");
  assert.throws(() => h.execute("commitRoundTransaction()"), /Active profile changed/);
  assert.equal(h.data.progress[0].energy, 10);
  assert.deepEqual(h.calls, []);
});

test("round lifecycle is wired to start, normal completion and quit", () => {
  assert.match(source, /function beginRound\([^]*?beginRoundTransaction\(\)/);
  assert.match(source, /function finishRound\(\)\s*\{\s*commitRoundTransaction\(\)/);
  assert.match(source, /function endToModeSelect\(\)\s*\{\s*discardRoundTransaction\(\)/);
  assert.match(source, /function saveCollection\(\)\s*\{\s*if \(roundTransaction\) return/);
  assert.match(source, /function saveRecentVehicles\(\)\s*\{\s*if \(roundTransaction\) return/);
  assert.match(source, /function recordCommittedAcquisition\([^]*?roundTransaction\.acquisitionHistory\.push/);
});
