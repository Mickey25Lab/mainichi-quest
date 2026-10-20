const test = require("node:test");
const assert = require("node:assert/strict");
const { createProfileStorage } = require("../dist/scripts/profile-storage.js");
const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,String(v)), removeItem: k => data.delete(k) }; };
const empty = () => ({ discovered:false, stage:1, friendship:0, friendly:false, energy:0, masterMedal:false });
const vehicle = (stage, energy = 0, medal = false) => ({ discovered:true, stage, friendly:true, friendship:5, energy, masterMedal:medal });
test("migration is idempotent, earned delta is not doubled, and energy overflow is capped", () => {
  const store = createProfileStorage(memory());
  store.createProfile("A");
  const progress = [vehicle(2,27)];
  store.setRewardProgress(progress);
  assert.equal(store.initializePointLedger(progress).total, 52);
  assert.equal(store.initializePointLedger([vehicle(5,99,true)]).total, 52);
  assert.equal(store.commitRewardProgressWithPoints([vehicle(3,0)]).total, 85);
  assert.equal(store.commitRewardProgressWithPoints([vehicle(3,0)]).total, 85);
  assert.equal(store.commitRewardProgressWithPoints([vehicle(4,0)]).total, 185);
  assert.equal(store.commitRewardProgressWithPoints([vehicle(5,0)]).total, 385);
  assert.equal(store.commitRewardProgressWithPoints([vehicle(5,0,true)]).total, 785);
});
test("friendship and profile separation; reset clears only the active profile ledger", () => {
  const store = createProfileStorage(memory());
  const a = store.createProfile("A").profileId;
  store.initializePointLedger([empty()]);
  assert.equal(store.commitRewardProgressWithPoints([{discovered:true, stage:2, friendship:4, friendly:false, energy:0}]).total,13);
  assert.equal(store.commitRewardProgressWithPoints([vehicle(2,0)]).total,25);
  const b = store.createProfile("B").profileId;
  store.initializePointLedger([empty()]);
  assert.equal(store.getPointLedger().total,0);
  store.setActiveProfile(a);
  assert.equal(store.getPointLedger().total,25);
  store.resetActiveProfileData();
  assert.equal(store.getPointLedger(),null);
  store.setActiveProfile(b);
  assert.equal(store.getPointLedger().total,0);
});

test("medal energy continues to 500, capped and never double-counted", () => {
 const store=createProfileStorage(memory()); store.createProfile("A"); store.initializePointLedger([vehicle(5,0,true)]);
 assert.equal(store.getPointLedger().total,785);
 assert.equal(store.commitRewardProgressWithPoints([vehicle(5,27,true)]).total,812);
 assert.equal(store.commitRewardProgressWithPoints([vehicle(5,800,true)]).total,1285);
 assert.equal(store.commitRewardProgressWithPoints([vehicle(5,800,true)]).total,1285);
});
