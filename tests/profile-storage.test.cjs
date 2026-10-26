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
  assert.deepEqual(reloaded.getAcquisitionHistory(), []);
});

test("acquisition history is ordered, deduplicated, and isolated by profile", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profileA = store.createProfile("A");
  const discovery = { mode: "normal", vehicleId: "01_patrol_car", acquisitionType: "vehicle_discovered", displayForm: "vehicle", displayStage: 2 };
  const friendship = { mode: "normal", vehicleId: "01_patrol_car", acquisitionType: "friendship_complete", displayForm: "vehicle", displayStage: 2 };
  assert.equal(store.appendAcquisitionHistory(discovery).added, true);
  assert.equal(store.appendAcquisitionHistory(discovery).added, false);
  assert.equal(store.appendAcquisitionHistory(friendship).added, true);
  assert.deepEqual(store.getAcquisitionHistory().map(({ sequence, vehicleId, acquisitionType, displayForm, displayStage }) => ({ sequence, vehicleId, acquisitionType, displayForm, displayStage })), [
    { sequence: 1, vehicleId: "01_patrol_car", acquisitionType: "vehicle_discovered", displayForm: "vehicle", displayStage: 2 },
    { sequence: 2, vehicleId: "01_patrol_car", acquisitionType: "friendship_complete", displayForm: "vehicle", displayStage: 2 }
  ]);
  assert.equal(store.getAcquisitionHistory()[0].source, "normal");
  const profileB = store.createProfile("B");
  assert.deepEqual(store.getAcquisitionHistory(), []);
  store.appendAcquisitionHistory({ mode: "multiplication", source: "time_bonus", vehicleId: "02_fire_engine", acquisitionType: "vehicle_discovered", displayForm: "vehicle", displayStage: 2 });
  store.setActiveProfile(profileA.profileId);
  assert.equal(store.getAcquisitionHistory().length, 2);
  store.setActiveProfile(profileB.profileId);
  assert.equal(store.getAcquisitionHistory().length, 1);
  assert.equal(store.getAcquisitionHistory()[0].source, "time_bonus");
});

test("migration and collection fallback do not synthesize acquisition history", () => {
  const storage = new MemoryStorage({
    [legacyKeys.collection]: JSON.stringify([3, 0]),
    [legacyKeys.rewardProgressPhase1]: JSON.stringify([{ discovered: true }])
  });
  const store = makeStore(storage);
  store.migrateLegacyProfile("引継ぎ");
  assert.deepEqual(store.getAcquisitionHistory(), []);
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

test("daily usage markers are isolated by profile and can be cleared independently", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profileA = store.createProfile("A");
  store.setTopCollectionLastUsedJst("2026-10-14");
  store.setOpeningMovieLastPlayedJst("2026-10-14");
  const profileB = store.createProfile("B");
  store.setTopCollectionLastUsedJst("2026-10-13");
  store.setOpeningMovieLastPlayedJst("2026-10-13");

  store.setActiveProfile(profileA.profileId);
  assert.equal(store.getTopCollectionLastUsedJst(), "2026-10-14");
  assert.equal(store.getOpeningMovieLastPlayedJst(), "2026-10-14");
  store.setTopCollectionLastUsedJst(null);
  store.setOpeningMovieLastPlayedJst(null);
  assert.equal(store.getTopCollectionLastUsedJst(), null);
  assert.equal(store.getOpeningMovieLastPlayedJst(), null);

  store.setActiveProfile(profileB.profileId);
  assert.equal(store.getTopCollectionLastUsedJst(), "2026-10-13");
  assert.equal(store.getOpeningMovieLastPlayedJst(), "2026-10-13");
});

test("admin reset clears only the active profile child data", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profileA = store.createProfile("A");
  const registry = JSON.parse(storage.getItem(keys.profiles));
  registry.profiles[0].collection.stages = [3];
  registry.profiles[0].progress = {
    rewardProgressPhase1: [1], recentVehicles: [2, 3], topCollectionLastUsedJst: "2026-10-13",
    openingMovieLastPlayedJst: "2026-10-13", legacyHistory: { played: 4 }, legacyRanking: ["rank"]
  };
  registry.profiles[0].bestRecords.bestTimeMs = 1234;
  registry.profiles[0].acquisitionHistory = [{ eventKey: "01_patrol_car:vehicle_discovered", sequence: 1, timestamp: "2026-10-13T00:00:00.000Z", mode: "normal", vehicleId: "01_patrol_car", acquisitionType: "vehicle_discovered", displayForm: "vehicle", displayStage: 2 }];
  registry.profiles[0].enabledModes = { division: true };
  registry.profiles[0].energyMultipliers = { division: 0.5 };
  storage.setItem(keys.profiles, JSON.stringify(registry));
  const originalA = store.getActiveProfile();
  const profileB = store.createProfile("B");
  store.setRewardProgress([2]);
  const originalB = store.getActiveProfile();
  store.setActiveProfile(profileA.profileId);
  store.resetActiveProfileData();
  const resetA = store.getActiveProfile();
  assert.equal(resetA.profileId, originalA.profileId);
  assert.equal(resetA.displayName, originalA.displayName);
  assert.equal(resetA.createdAt, originalA.createdAt);
  assert.equal(resetA.collection.stages, null);
  assert.equal(resetA.progress.rewardProgressPhase1, null);
  assert.deepEqual(resetA.progress.recentVehicles, []);
  assert.equal(resetA.progress.topCollectionLastUsedJst, null);
  assert.equal(resetA.progress.openingMovieLastPlayedJst, null);
  assert.equal(resetA.progress.legacyHistory, null);
  assert.equal(resetA.progress.legacyRanking, null);
  assert.equal(resetA.bestRecords.bestTimeMs, null);
  assert.deepEqual(resetA.acquisitionHistory, []);
  assert.deepEqual(resetA.enabledModes, originalA.enabledModes);
  assert.deepEqual(resetA.energyMultipliers, originalA.energyMultipliers);
  store.setActiveProfile(profileB.profileId);
  assert.deepEqual(store.getActiveProfile(), originalB);
  assert.equal(store.listProfiles().length, 2);
  assert.equal(store.listProfiles().find((profile) => profile.profileId === profileB.profileId).displayName, "B");
});


test("parent learning settings are saved per profile without switching the active player", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profileA = store.createProfile("A");
  const profileB = store.createProfile("B");
  const activeBefore = store.getActiveProfileId();

  store.setProfileLearningSettings(profileA.profileId, {
    enabledModes: { normal: true, counting1: false },
    energyMultipliers: { normal: "large", counting1: "off" },
    dailyTargetCounts: { normal: 3, counting1: 1 }
  });
  store.setProfileLearningSettings(profileB.profileId, {
    enabledModes: { normal: true },
    energyMultipliers: { normal: "small" },
    dailyTargetCounts: { normal: 2 }
  });

  assert.equal(store.getActiveProfileId(), activeBefore);
  assert.deepEqual(store.getProfileLearningSettings(profileA.profileId), {
    enabledModes: { normal: true, counting1: false },
    energyMultipliers: { normal: "large", counting1: "off" },
    dailyTargetCounts: { normal: 3, counting1: 1 },
    freePlayEnabled: false,
    freePlayEnergyMode: "normal"
  });
  assert.deepEqual(store.getProfileLearningSettings(profileB.profileId), {
    enabledModes: { normal: true },
    energyMultipliers: { normal: "small" },
    dailyTargetCounts: { normal: 2 },
    freePlayEnabled: false,
    freePlayEnergyMode: "normal"
  });
});

test("admin reset preserves parent learning settings", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profile = store.createProfile("A");
  store.setProfileLearningSettings(profile.profileId, {
    enabledModes: { normal: true },
    energyMultipliers: { normal: "medium" },
    dailyTargetCounts: { normal: 4 }
  });
  store.setRewardProgress([{ stage: 3 }]);
  store.resetActiveProfileData();

  assert.deepEqual(store.getProfileLearningSettings(profile.profileId), {
    enabledModes: { normal: true },
    energyMultipliers: { normal: "medium" },
    dailyTargetCounts: { normal: 4 },
    freePlayEnabled: false,
    freePlayEnergyMode: "normal"
  });
});


test("daily mission progress is isolated by profile and survives reload", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profileA = store.createProfile("A");
  store.setDailyMission({ date:"2026-10-14", completedCounts:{ normal:2 } });
  const profileB = store.createProfile("B");
  store.setDailyMission({ date:"2026-10-14", completedCounts:{ counting1:1 } });

  store.setActiveProfile(profileA.profileId);
  assert.deepEqual(store.getDailyMission(), { date:"2026-10-14", completedCounts:{ normal:2 } });

  store.setActiveProfile(profileB.profileId);
  assert.deepEqual(store.getDailyMission(), { date:"2026-10-14", completedCounts:{ counting1:1 } });

  const reloaded = makeStore(storage);
  reloaded.setActiveProfile(profileA.profileId);
  assert.deepEqual(reloaded.getDailyMission(), { date:"2026-10-14", completedCounts:{ normal:2 } });
});


test("collection scene order is persisted per profile and reset with child data", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profileA = store.createProfile("A");
  store.setCollectionSceneOrder({ vehicle:[3,1,8], robot:[1,3], "super-robot":[8,4], equipment:[4,8], medal:[3] });
  assert.deepEqual(store.getCollectionSceneOrder(), { vehicle:[3,1,8], robot:[1,3], "super-robot":[8,4], equipment:[4,8], medal:[3] });

  const profileB = store.createProfile("B");
  assert.deepEqual(store.getCollectionSceneOrder(), { vehicle:[], robot:[], "super-robot":[], equipment:[], medal:[] });
  store.setCollectionSceneOrder({ vehicle:[2], robot:[2] });

  store.setActiveProfile(profileA.profileId);
  assert.deepEqual(store.getCollectionSceneOrder(), { vehicle:[3,1,8], robot:[1,3], "super-robot":[8,4], equipment:[4,8], medal:[3] });
  store.resetActiveProfileData();
  assert.deepEqual(store.getCollectionSceneOrder(), { vehicle:[], robot:[], "super-robot":[], equipment:[], medal:[] });

  store.setActiveProfile(profileB.profileId);
  assert.deepEqual(store.getCollectionSceneOrder(), { vehicle:[2], robot:[2], "super-robot":[], equipment:[], medal:[] });
});

test("collection category seen state is profile-specific and reset with child data", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const profileA = store.createProfile("A");
  assert.deepEqual(store.getCollectionCategorySeen(), []);
  store.setCollectionCategorySeen(["vehicle", "robot", "robot", "invalid"]);
  assert.deepEqual(store.getCollectionCategorySeen(), ["vehicle", "robot"]);

  const profileB = store.createProfile("B");
  assert.deepEqual(store.getCollectionCategorySeen(), []);
  store.setCollectionCategorySeen(["vehicle"]);

  store.setActiveProfile(profileA.profileId);
  assert.deepEqual(store.getCollectionCategorySeen(), ["vehicle", "robot"]);
  store.resetActiveProfileData();
  assert.deepEqual(store.getCollectionCategorySeen(), []);

  store.setActiveProfile(profileB.profileId);
  assert.deepEqual(store.getCollectionCategorySeen(), ["vehicle"]);
});

test("profiles from before progressive collection tabs preserve a legacy unseen sentinel", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  store.createProfile("A");
  const registry = JSON.parse(storage.getItem(keys.profiles));
  delete registry.profiles[0].progress.collectionCategorySeen;
  storage.setItem(keys.profiles, JSON.stringify(registry));

  assert.equal(store.getCollectionCategorySeen(), null);
});

test("quest bonus claim is atomic with progression, once a JST day and profile", () => {
  const storage = new MemoryStorage();
  const store = makeStore(storage);
  const a = store.createProfile("A");
  const initial = [{ discovered:true, friendly:true, friendship:5, stage:2, energy:3, masterMedal:false }];
  store.setRewardProgress(initial);
  store.initializePointLedger(initial);
  const gained = [{ ...initial[0], energy:18 }];
  store.commitRewardProgressWithPoints(gained, { questBonusClaimDate:"2026-10-26" });
  assert.equal(store.getQuestBonusClaimDate(), "2026-10-26");
  assert.deepEqual(store.getRewardProgress(), gained);
  const snapshot = store.getPointLedger();
  assert.throws(() => store.commitRewardProgressWithPoints([{ ...gained[0], energy:28 }], { questBonusClaimDate:"2026-10-26" }), /already claimed/);
  assert.deepEqual(store.getRewardProgress(), gained);
  assert.deepEqual(store.getPointLedger(), snapshot);
  const next = makeStore(storage);
  assert.equal(next.getQuestBonusClaimDate(), "2026-10-26");
  const profileB = next.createProfile("B");
  next.setActiveProfile(profileB.profileId);
  assert.equal(next.getQuestBonusClaimDate(), null);
  next.setActiveProfile(a.profileId);
  next.commitRewardProgressWithPoints([{ ...gained[0], energy:24 }], { questBonusClaimDate:"2026-10-27" });
  assert.equal(next.getQuestBonusClaimDate(), "2026-10-27");
});
