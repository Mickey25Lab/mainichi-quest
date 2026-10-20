const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("dist/index.html", "utf8");
const app = fs.readFileSync("dist/app.js", "utf8");
const { createProfileStorage } = require("../dist/scripts/profile-storage.js");
const storage = () => { const items = new Map(); return { getItem: k => items.get(k) ?? null, setItem: (k,v) => items.set(k,String(v)), removeItem: k => items.delete(k) }; };
test("point diagnostics UI remains PIN-gated and read-only", () => {
  assert.ok(html.indexOf('id="admin-points-open"') > html.indexOf('id="admin-panel-overlay"'));
  assert.ok(html.includes('id="admin-points-rows"'));
  assert.match(app, /function openPointsDiagnostics\(/);
  const diagnosticCode = app.split("function openPointsDiagnostics()")[1].split("function closePointsDiagnostics()")[0];
  assert.doesNotMatch(diagnosticCode, /commitRewardProgressWithPoints|initializePointLedger|setRewardProgress|setCollectionStages/);
});
test("current-state reference points do not mutate saved ledger", () => {
  const store = createProfileStorage(storage());
  store.createProfile("diagnostics");
  const p = [{discovered: true, stage:3, friendship:5, friendly:true, energy:10, masterMedal:false}];
  store.initializePointLedger(p);
  const before = store.getPointLedger();
  assert.equal(store.calculateVehiclePointValue(p[0]), 95);
  assert.deepEqual(store.getPointLedger(), before);
});
