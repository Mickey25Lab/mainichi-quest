const test = require("node:test");
const assert = require("node:assert/strict");
const { createProfileStorage } = require("../dist/scripts/profile-storage.js");

class MemoryStorage {
  constructor() { this.items = new Map(); }
  getItem(key) { return this.items.has(key) ? this.items.get(key) : null; }
  setItem(key, value) { this.items.set(key, String(value)); }
  removeItem(key) { this.items.delete(key); }
}
function setup() {
  const storage = new MemoryStorage();
  const store = createProfileStorage(storage);
  store.createProfile("tester");
  return { storage, store };
}

test("legacy profile starts with zero balance and may carry unallocated energy across days and reload", () => {
  const { storage, store } = setup();
  assert.equal(store.getTimeEnergy().balance, 0);
  assert.equal(store.creditTimeEnergy(8, "qa-example-1"), true);
  assert.equal(store.creditTimeEnergy(8, "qa-example-1"), false);
  const later = createProfileStorage(storage);
  assert.equal(later.getTimeEnergy().balance, 8);
  assert.equal(later.getTimeEnergy().allocation, null);
});

test("allocation deadline survives reload and the chosen vehicle cannot be changed", () => {
  const { storage, store } = setup();
  store.creditTimeEnergy(8, "gain");
  store.beginTimeEnergyAllocation("allot-1", 1793000000000);
  const later = createProfileStorage(storage);
  assert.equal(later.getTimeEnergy().allocation.deadline, 1793000000000);
  later.lockTimeEnergyVehicle("allot-1", 3);
  later.lockTimeEnergyVehicle("allot-1", 7);
  assert.equal(later.getTimeEnergy().allocation.vehicleIndex, 3);
  assert.equal(later.getTimeEnergy().allocation.amount, 8);
});

test("profiles and QA use isolated time-energy balances", () => {
  const { store } = setup();
  const first = store.getActiveProfileId();
  store.creditTimeEnergy(5, "real");
  store.setActiveQaState({ qaEnabled: true });
  assert.equal(store.getTimeEnergy().balance, 0);
  store.creditTimeEnergy(8, "qa");
  assert.equal(store.getTimeEnergy().balance, 8);
  store.setActiveQaState({});
  assert.equal(store.getTimeEnergy().balance, 5);
  store.createProfile("second");
  assert.equal(store.getTimeEnergy().balance, 0);
  store.setActiveProfile(first);
  assert.equal(store.getTimeEnergy().balance, 5);
});

test("invalid credits and missing commits cannot consume balance", () => {
  const { store } = setup();
  assert.throws(() => store.creditTimeEnergy(-1,"bad"));
  store.creditTimeEnergy(8,"real");
  store.beginTimeEnergyAllocation("allot-1", Date.now()+30000);
  assert.throws(() => store.commitTimeEnergyAllocation("allot-1", []));
  assert.equal(store.getTimeEnergy().balance, 8);
});

test("single allocation atomically advances vehicle and balance, replay does nothing", () => {
  const { storage, store } = setup();
  const empty = Array.from({ length:20 }, () => ({ discovered:false, friendship:0, friendly:false, stage:1, energy:0, masterMedal:false }));
  empty[0] = { discovered:true, friendship:5, friendly:true, stage:2, energy:5, masterMedal:false };
  store.setRewardProgress(empty);
  store.creditTimeEnergy(8,"gain");
  store.beginTimeEnergyAllocation("allocation-1", Date.now()+30000);
  store.lockTimeEnergyVehicle("allocation-1",0);
  const grown = empty.map((item) => ({ ...item }));
  grown[0].energy = 13;
  assert.equal(store.commitTimeEnergyAllocation("allocation-1",grown), true);
  const fresh = createProfileStorage(storage);
  assert.equal(fresh.getTimeEnergy().balance,0);
  assert.equal(fresh.getRewardProgress()[0].energy,13);
  assert.equal(fresh.commitTimeEnergyAllocation("allocation-1",grown),false);
  assert.equal(fresh.getRewardProgress()[0].energy,13);
});
