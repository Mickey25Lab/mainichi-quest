(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MQProfileStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const MIGRATION_VERSION = 1;
  const keys = Object.freeze({
    profiles: "warizan-robot:profiles-v1",
    activeProfileId: "warizan-robot:active-profile-id-v1",
    migration: "warizan-robot:profile-migration-v1",
    qaState: "warizan-robot:profile-qa-state-v1"
  });
  const legacyKeys = Object.freeze({
    bestTime: "warizan-robot:best-time-ms",
    collection: "warizan-robot:vehicle-collection-v1",
    recentVehicles: "warizan-robot:recent-vehicles-v1",
    history: "warizan-robot:history",
    ranking: "warizan-robot:ranking",
    topCollectionLastUsedJst: "warizan-robot:top-collection-last-used-jst",
    rewardProgressPhase1: "warizan-robot:reward-progress-phase1-v1"
  });

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function parseJson(value, fallback = null) {
    if (value === null || value === undefined) return fallback;
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function isoNow(now) {
    return (now ? now() : new Date()).toISOString();
  }

  function stableId(randomUUID) {
    if (typeof randomUUID === "function") return randomUUID();
    return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function normalizeDisplayName(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
  }

  function emptyProfile(displayName, profileId, timestamp) {
    return {
      profileId,
      displayName,
      createdAt: timestamp,
      updatedAt: timestamp,
      collection: { stages: null },
      progress: {
        rewardProgressPhase1: null,
        recentVehicles: [],
        topCollectionLastUsedJst: null,
        legacyHistory: null,
        legacyRanking: null
      },
      bestRecords: { bestTimeMs: null },
      enabledModes: {},
      energyMultipliers: {}
    };
  }

  function normalizeProfile(value) {
    if (!value || typeof value !== "object" || !value.profileId) return null;
    const profile = emptyProfile(
      normalizeDisplayName(value.displayName) || "プレイヤー",
      String(value.profileId),
      value.createdAt || new Date(0).toISOString()
    );
    profile.updatedAt = value.updatedAt || profile.createdAt;
    profile.collection.stages = Array.isArray(value.collection?.stages) ? clone(value.collection.stages) : null;
    profile.progress.rewardProgressPhase1 = Array.isArray(value.progress?.rewardProgressPhase1) ? clone(value.progress.rewardProgressPhase1) : null;
    profile.progress.recentVehicles = Array.isArray(value.progress?.recentVehicles) ? clone(value.progress.recentVehicles) : [];
    profile.progress.topCollectionLastUsedJst = typeof value.progress?.topCollectionLastUsedJst === "string" ? value.progress.topCollectionLastUsedJst : null;
    profile.progress.legacyHistory = value.progress?.legacyHistory ?? null;
    profile.progress.legacyRanking = value.progress?.legacyRanking ?? null;
    const best = Number(value.bestRecords?.bestTimeMs);
    profile.bestRecords.bestTimeMs = Number.isFinite(best) && best > 0 ? best : null;
    profile.enabledModes = value.enabledModes && typeof value.enabledModes === "object" ? clone(value.enabledModes) : {};
    profile.energyMultipliers = value.energyMultipliers && typeof value.energyMultipliers === "object" ? clone(value.energyMultipliers) : {};
    return profile;
  }

  function createProfileStorage(storage, options = {}) {
    if (!storage) throw new Error("storage is required");
    const now = options.now;
    const randomUUID = options.randomUUID || (globalThis.crypto && globalThis.crypto.randomUUID ? () => globalThis.crypto.randomUUID() : null);

    function readRegistry() {
      const parsed = parseJson(storage.getItem(keys.profiles), {});
      const profiles = Array.isArray(parsed.profiles) ? parsed.profiles.map(normalizeProfile).filter(Boolean) : [];
      return { schemaVersion: SCHEMA_VERSION, profiles };
    }

    function writeRegistry(registry) {
      storage.setItem(keys.profiles, JSON.stringify({ schemaVersion: SCHEMA_VERSION, profiles: registry.profiles }));
    }

    function listProfiles() {
      return clone(readRegistry().profiles);
    }

    function getActiveProfileId() {
      const id = storage.getItem(keys.activeProfileId);
      return id && readRegistry().profiles.some((profile) => profile.profileId === id) ? id : null;
    }

    function ensureActiveProfile() {
      const existing = getActiveProfileId();
      if (existing) return existing;
      const first = readRegistry().profiles[0];
      if (!first) return null;
      storage.setItem(keys.activeProfileId, first.profileId);
      return first.profileId;
    }

    function getActiveProfile() {
      const id = ensureActiveProfile();
      if (!id) return null;
      return clone(readRegistry().profiles.find((profile) => profile.profileId === id) || null);
    }

    function setActiveProfile(profileId) {
      const id = String(profileId || "");
      if (!readRegistry().profiles.some((profile) => profile.profileId === id)) throw new Error("profile not found");
      storage.setItem(keys.activeProfileId, id);
      return id;
    }

    function mutateActiveProfile(mutator) {
      const registry = readRegistry();
      const id = ensureActiveProfile();
      const index = registry.profiles.findIndex((profile) => profile.profileId === id);
      if (index < 0) throw new Error("active profile is missing");
      const profile = registry.profiles[index];
      mutator(profile);
      profile.updatedAt = isoNow(now);
      registry.profiles[index] = normalizeProfile(profile);
      writeRegistry(registry);
      return clone(registry.profiles[index]);
    }

    function legacySnapshot() {
      const raw = {};
      Object.entries(legacyKeys).forEach(([name, key]) => { raw[name] = storage.getItem(key); });
      return raw;
    }

    function hasLegacyChildData() {
      return Object.values(legacySnapshot()).some((value) => value !== null);
    }

    function applyLegacySnapshot(profile, raw) {
      const collection = parseJson(raw.collection);
      const rewardProgress = parseJson(raw.rewardProgressPhase1);
      const recentVehicles = parseJson(raw.recentVehicles);
      const history = parseJson(raw.history, raw.history);
      const ranking = parseJson(raw.ranking, raw.ranking);
      const bestTime = Number(raw.bestTime);
      profile.collection.stages = Array.isArray(collection) ? collection : null;
      profile.progress.rewardProgressPhase1 = Array.isArray(rewardProgress) ? rewardProgress : null;
      profile.progress.recentVehicles = Array.isArray(recentVehicles) ? recentVehicles : [];
      profile.progress.topCollectionLastUsedJst = raw.topCollectionLastUsedJst || null;
      profile.progress.legacyHistory = history;
      profile.progress.legacyRanking = ranking;
      profile.bestRecords.bestTimeMs = Number.isFinite(bestTime) && bestTime > 0 ? bestTime : null;
      return profile;
    }

    function createProfile(displayName, createOptions = {}) {
      const name = normalizeDisplayName(displayName);
      if (!name) throw new Error("display name is required");
      const timestamp = isoNow(now);
      const profile = emptyProfile(name, stableId(randomUUID), timestamp);
      if (createOptions.legacySnapshot) applyLegacySnapshot(profile, createOptions.legacySnapshot);
      const registry = readRegistry();
      registry.profiles.push(profile);
      writeRegistry(registry);
      storage.setItem(keys.activeProfileId, profile.profileId);
      return clone(profile);
    }

    function migrateLegacyProfile(displayName) {
      const rawBefore = {
        profiles: storage.getItem(keys.profiles),
        activeProfileId: storage.getItem(keys.activeProfileId),
        migration: storage.getItem(keys.migration)
      };
      const copiedLegacy = legacySnapshot();
      try {
        const profile = createProfile(displayName, { legacySnapshot: copiedLegacy });
        const verified = getActiveProfile();
        if (!verified || JSON.stringify(verified) !== JSON.stringify(normalizeProfile(profile))) throw new Error("profile verification failed");
        const copiedKeys = Object.entries(copiedLegacy).filter(([, value]) => value !== null).map(([name]) => legacyKeys[name]);
        const migration = {
          migrationVersion: MIGRATION_VERSION,
          migrationCompleted: true,
          profileId: profile.profileId,
          migratedAt: isoNow(now),
          copiedKeys
        };
        storage.setItem(keys.migration, JSON.stringify(migration));
        const migrationCheck = parseJson(storage.getItem(keys.migration));
        if (!migrationCheck?.migrationCompleted || migrationCheck.profileId !== profile.profileId) throw new Error("migration verification failed");
        return { profile: verified, migration: migrationCheck };
      } catch (error) {
        Object.entries(rawBefore).forEach(([name, value]) => {
          const key = keys[name];
          if (value === null) storage.removeItem(key); else storage.setItem(key, value);
        });
        throw error;
      }
    }

    function getMigrationState() {
      return clone(parseJson(storage.getItem(keys.migration)));
    }

    function getCollectionStages() { return clone(getActiveProfile()?.collection.stages ?? null); }
    function setCollectionStages(value) { return mutateActiveProfile((profile) => { profile.collection.stages = Array.isArray(value) ? clone(value) : null; }); }
    function getRewardProgress() { return clone(getActiveProfile()?.progress.rewardProgressPhase1 ?? null); }
    function setRewardProgress(value) { return mutateActiveProfile((profile) => { profile.progress.rewardProgressPhase1 = Array.isArray(value) ? clone(value) : null; }); }
    function getRecentVehicles() { return clone(getActiveProfile()?.progress.recentVehicles ?? []); }
    function setRecentVehicles(value) { return mutateActiveProfile((profile) => { profile.progress.recentVehicles = Array.isArray(value) ? clone(value) : []; }); }
    function getBestTime() { return getActiveProfile()?.bestRecords.bestTimeMs ?? null; }
    function setBestTime(value) { return mutateActiveProfile((profile) => { const n = Number(value); profile.bestRecords.bestTimeMs = Number.isFinite(n) && n > 0 ? n : null; }); }
    function getTopCollectionLastUsedJst() { return getActiveProfile()?.progress.topCollectionLastUsedJst ?? null; }
    function setTopCollectionLastUsedJst(value) { return mutateActiveProfile((profile) => { profile.progress.topCollectionLastUsedJst = value ? String(value) : null; }); }

    function resetActiveProfileData() {
      return mutateActiveProfile((profile) => {
        profile.collection = { stages: null };
        profile.progress = { rewardProgressPhase1: null, recentVehicles: [], topCollectionLastUsedJst: null, legacyHistory: null, legacyRanking: null };
        profile.bestRecords = { bestTimeMs: null };
      });
    }

    function readQaState() {
      const parsed = parseJson(storage.getItem(keys.qaState), {});
      return parsed && typeof parsed === "object" ? parsed : {};
    }

    function getActiveQaState() {
      const id = getActiveProfileId();
      return id ? clone(readQaState()[id] || {}) : {};
    }

    function setActiveQaState(value) {
      const id = getActiveProfileId();
      if (!id) throw new Error("active profile is missing");
      const all = readQaState();
      all[id] = clone(value || {});
      storage.setItem(keys.qaState, JSON.stringify(all));
    }

    return {
      keys, legacyKeys, schemaVersion: SCHEMA_VERSION, migrationVersion: MIGRATION_VERSION,
      listProfiles, getActiveProfileId, ensureActiveProfile, getActiveProfile, setActiveProfile,
      hasLegacyChildData, legacySnapshot, createProfile, migrateLegacyProfile, getMigrationState,
      getCollectionStages, setCollectionStages, getRewardProgress, setRewardProgress,
      getRecentVehicles, setRecentVehicles, getBestTime, setBestTime,
      getTopCollectionLastUsedJst, setTopCollectionLastUsedJst,
      resetActiveProfileData, getActiveQaState, setActiveQaState
    };
  }

  return { createProfileStorage, keys, legacyKeys, SCHEMA_VERSION, MIGRATION_VERSION };
});
