const test = require("node:test");
const assert = require("node:assert/strict");
const { createProfileStorage, rewardProgressFromCollectionStages, keys, legacyKeys } = require("../dist/scripts/profile-storage.js");

class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function makeStore(storage) {
  let id = 0;
  let time = 0;
  return createProfileStorage(storage, {
    randomUUID: () => `profile-${++id}`,
    now: () => new Date(Date.UTC(2026, 9, 13, 0, 0, time++))
  });
}

test("legacy child data is copied, verified, and legacy keys remain", () => {
  const legacyProgress = [{ discovered: true, friendship: 5, friendly: true, stage: 3, energy: 7, masterMedal: false }];
  const legacyCollection = [2];
  const storage = new MemoryStorage({
    [legacyKeys.rewardProgressPhase1]: JSON.stringify(legacyProgress),
    [legacyKeys.collection]: JSON.stringify(legacyCollection),
    [legacyKeys.bestTime]: "12345",
    [legacyKeys.recentVehicles]: "[3,4]",
    [legacyKeys.topCollectionLastUsedJst]: "2026-10-12"
  });
  const store = makeStore(storage);

  const result = store.migrateLegacyProfile("みなと");

  assert.equal(result.profile.displayName, "みなと");
  assert.deepEqual(store.getRewardProgress(), legacyProgress);
  assert.deepEqual(store.getCollectionStages(), legacyCollection);
  assert.equal(store.getBestTime(), 12345);
  assert.deepEqual(store.getRecentVehicles(), [3, 4]);
  assert.equal(store.getTopCollectionLastUsedJst(), "2026-10-12");
  assert.equal(store.getMigrationState().migrationCompleted, true);
  assert.equal(storage.getItem(legacyKeys.rewardProgressPhase1), JSON.stringify(legacyProgress));
  assert.equal(storage.getItem(legacyKeys.collection), JSON.stringify(legacyCollection));
});

test("profiles keep progress isolated when active profile changes", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profileA = store.createProfile("すみれ");
  store.setRewardProgress([{ discovered: true }]);
  store.setBestTime(9000);
  const profileB = store.createProfile("みなと");

  assert.equal(store.getActiveProfileId(), profileB.profileId);
  assert.equal(store.getRewardProgress(), null);
  assert.equal(store.getBestTime(), null);

  store.setRewardProgress([{ discovered: false }]);
  store.setActiveProfile(profileA.profileId);
  assert.deepEqual(store.getRewardProgress(), [{ discovered: true }]);
  assert.equal(store.getBestTime(), 9000);

  store.setActiveProfile(profileB.profileId);
  assert.deepEqual(store.getRewardProgress(), [{ discovered: false }]);
});

test("new environment creates an empty active profile and survives reload", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profile = store.createProfile("すみれ");
  store.setCollectionStages([1, 0, 0]);

  const reloaded = makeStore(storage);
  assert.equal(reloaded.getActiveProfileId(), profile.profileId);
  assert.equal(reloaded.getActiveProfile().displayName, "すみれ");
  assert.deepEqual(reloaded.getCollectionStages(), [1, 0, 0]);
});

test("QA progress snapshots restore reward progress and collection exactly per profile", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profileA = store.createProfile("A");
  store.setRewardProgress([{ stage: 3 }]);
  store.setCollectionStages([2]);
  const snapshotA = store.getProgressSnapshot();
  store.setActiveQaState({ backupInitialized: true, progressBackup: snapshotA });
  store.setRewardProgress([{ stage: 5 }]);
  store.setCollectionStages([5]);
  const profileB = store.createProfile("B");
  assert.deepEqual(store.getActiveQaState(), {});
  const snapshotB = store.getProgressSnapshot();
  store.setActiveQaState({ backupInitialized: true, progressBackup: snapshotB });
  store.setRewardProgress([{ stage: 4 }]);
  store.setCollectionStages([3]);
  store.setActiveProfile(profileA.profileId);
  store.restoreProgressSnapshot(store.getActiveQaState().progressBackup);
  assert.deepEqual(store.getProgressSnapshot(), snapshotA);
  store.setActiveProfile(profileB.profileId);
  store.restoreProgressSnapshot(store.getActiveQaState().progressBackup);
  assert.deepEqual(store.getProgressSnapshot(), snapshotB);
  assert.ok(storage.getItem(keys.qaState));
});

test("QA progress snapshot preserves null values", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  store.createProfile("new");
  const snapshot = store.getProgressSnapshot();
  assert.deepEqual(snapshot, { rewardProgress: null, collection: null });
  store.setRewardProgress([{ discovered: true }]);
  store.setCollectionStages([1]);
  store.restoreProgressSnapshot(snapshot);
  assert.deepEqual(store.getProgressSnapshot(), snapshot);
});

test("legacy collection fallback creates only valid progress states", () => {
  const progress = rewardProgressFromCollectionStages([0, 1, 2, 3, 4, 5]);
  assert.deepEqual(progress, [
    { discovered: false, friendship: 0, friendly: false, stage: 1, energy: 0, masterMedal: false },
    { discovered: true, friendship: 0, friendly: false, stage: 2, energy: 0, masterMedal: false },
    { discovered: true, friendship: 5, friendly: true, stage: 3, energy: 0, masterMedal: false },
    { discovered: true, friendship: 5, friendly: true, stage: 4, energy: 0, masterMedal: false },
    { discovered: true, friendship: 5, friendly: true, stage: 5, energy: 0, masterMedal: false },
    { discovered: true, friendship: 5, friendly: true, stage: 5, energy: 0, masterMedal: true }
  ]);
  progress.filter((item) => item.stage >= 3).forEach((item) => {
    assert.equal(item.friendship, 5);
    assert.equal(item.friendly, true);
  });
});

test("developer reset clears only the active profile child data", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profileA = store.createProfile("A");
  store.setRewardProgress([1]);
  const profileB = store.createProfile("B");
  store.setRewardProgress([2]);
  store.resetActiveProfileData();
  assert.equal(store.getRewardProgress(), null);
  store.setActiveProfile(profileA.profileId);
  assert.deepEqual(store.getRewardProgress(), [1]);
  assert.equal(store.listProfiles().length, 2);
  assert.equal(store.listProfiles().find((profile) => profile.profileId === profileB.profileId).displayName, "B");
});
