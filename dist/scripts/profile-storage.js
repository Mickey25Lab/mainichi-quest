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

  function rewardProgressFromCollectionStages(value) {
    if (!Array.isArray(value)) return null;
    return value.map((rawStage) => {
      const collectionStage = Math.max(0, Math.min(5, Number(rawStage) || 0));
      if (collectionStage === 0) {
        return { discovered: false, friendship: 0, friendly: false, stage: 1, energy: 0, masterMedal: false };
      }
      return {
        discovered: true,
        friendship: collectionStage >= 2 ? 5 : 0,
        friendly: collectionStage >= 2,
        stage: Math.min(5, collectionStage + 1),
        energy: 0,
        masterMedal: collectionStage === 5
      };
    });
  }

  function normalizeTimeEnergy(value) {
    const raw = value && typeof value === "object" ? value : {};
    const balance = Number.isSafeInteger(raw.balance) && raw.balance >= 0 ? raw.balance : 0;
    const allocation = raw.allocation && typeof raw.allocation === "object"
      && typeof raw.allocation.id === "string" && Number.isSafeInteger(raw.allocation.amount)
      && raw.allocation.amount > 0 && Number.isFinite(raw.allocation.deadline)
      ? { id:raw.allocation.id, amount:raw.allocation.amount, deadline:raw.allocation.deadline,
        vehicleIndex:Number.isInteger(raw.allocation.vehicleIndex) ? raw.allocation.vehicleIndex : null } : null;
    const completed = Array.isArray(raw.completed) ? raw.completed.filter((item) =>
      item && typeof item.id === "string" && Number.isInteger(item.vehicleIndex)
      && Number.isSafeInteger(item.amount) && item.amount > 0).slice(-100) : [];
    return { balance, allocation, completed };
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
        openingMovieLastPlayedJst: null,
        dailyMission: { date: null, completedCounts: {} },
        questBonusClaimDate: null,
        timeEnergy: { balance: 0, allocation: null, completed: [] },
        collectionSceneOrder: { vehicle: [], robot: [], "super-robot": [], equipment: [], medal: [] },
        collectionCategorySeen: [],
        legacyHistory: null,
        legacyRanking: null
      },
      bestRecords: { bestTimeMs: null },
      // This starts empty even for migrated profiles.  It is deliberately not
      // inferred from collection/progress, because those states do not retain
      // the real acquisition order needed by a future opening movie.
      acquisitionHistory: [],
      pointLedger: null,
      levelAcknowledged: null,
      energyCapsuleCount: 0,
      energyCapsuleAwardedLevel: null,
      enabledModes: {},
      energyMultipliers: {},
      dailyTargetCounts: {},
      freePlayEnabled: false,
      freePlayEnergyMode: "normal"
    };
  }

  function normalizeAcquisitionHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.reduce((history, raw) => {
      if (!raw || typeof raw !== "object") return history;
      const vehicleId = typeof raw.vehicleId === "string" ? raw.vehicleId : "";
      const acquisitionType = typeof raw.acquisitionType === "string" ? raw.acquisitionType : "";
      const mode = typeof raw.mode === "string" ? raw.mode : "";
      const eventKey = typeof raw.eventKey === "string" ? raw.eventKey : `${vehicleId}:${acquisitionType}`;
      if (!vehicleId || !acquisitionType || !mode || !eventKey || seen.has(eventKey)) return history;
      seen.add(eventKey);
      const displayStage = Number(raw.displayStage);
      history.push({
        eventKey,
        sequence: history.length + 1,
        timestamp: typeof raw.timestamp === "string" ? raw.timestamp : new Date(0).toISOString(),
        mode,
        source: typeof raw.source === "string" ? raw.source : "normal",
        vehicleId,
        acquisitionType,
        displayForm: typeof raw.displayForm === "string" ? raw.displayForm : null,
        displayStage: Number.isInteger(displayStage) && displayStage >= 1 && displayStage <= 5 ? displayStage : null
      });
      return history;
    }, []);
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
    profile.progress.openingMovieLastPlayedJst = typeof value.progress?.openingMovieLastPlayedJst === "string" ? value.progress.openingMovieLastPlayedJst : null;
    profile.progress.questBonusClaimDate = typeof value.progress?.questBonusClaimDate === "string" ? value.progress.questBonusClaimDate : null;
    profile.progress.timeEnergy = normalizeTimeEnergy(value.progress?.timeEnergy);
    const dailyMission = value.progress?.dailyMission;
    profile.progress.dailyMission = {
      date: typeof dailyMission?.date === "string" ? dailyMission.date : null,
      completedCounts: dailyMission?.completedCounts && typeof dailyMission.completedCounts === "object" ? clone(dailyMission.completedCounts) : {},
      ...(Number.isInteger(dailyMission?.questRewardLevel) && dailyMission.questRewardLevel >= 1 ? { questRewardLevel:dailyMission.questRewardLevel } : {})
    };
    const sceneOrder = value.progress?.collectionSceneOrder;
    profile.progress.collectionSceneOrder = {
      vehicle: Array.isArray(sceneOrder?.vehicle) ? sceneOrder.vehicle.filter((value) => Number.isInteger(value) && value >= 0 && value < 20) : [],
      robot: Array.isArray(sceneOrder?.robot) ? sceneOrder.robot.filter((value) => Number.isInteger(value) && value >= 0 && value < 20) : [],
      "super-robot": Array.isArray(sceneOrder?.["super-robot"]) ? sceneOrder["super-robot"].filter((value) => Number.isInteger(value) && value >= 0 && value < 20) : [],
      equipment: Array.isArray(sceneOrder?.equipment) ? sceneOrder.equipment.filter((value) => Number.isInteger(value) && value >= 0 && value < 20) : [],
      medal: Array.isArray(sceneOrder?.medal) ? sceneOrder.medal.filter((value) => Number.isInteger(value) && value >= 0 && value < 20) : []
    };
    const collectionCategorySeen = value.progress?.collectionCategorySeen;
    profile.progress.collectionCategorySeen = Array.isArray(collectionCategorySeen)
      ? [...new Set(collectionCategorySeen.filter((item) => ["vehicle", "robot", "super-robot", "equipment", "medal"].includes(item)))]
      : null;
    profile.progress.legacyHistory = value.progress?.legacyHistory ?? null;
    profile.progress.legacyRanking = value.progress?.legacyRanking ?? null;
    profile.acquisitionHistory = normalizeAcquisitionHistory(value.acquisitionHistory);
    profile.levelAcknowledged = Number.isInteger(value.levelAcknowledged) && value.levelAcknowledged >= 1 && value.levelAcknowledged <= 50 ? value.levelAcknowledged : null;
    profile.energyCapsuleCount = Number.isInteger(value.energyCapsuleCount) ? Math.max(0, Math.min(99, value.energyCapsuleCount)) : 0;
    profile.energyCapsuleAwardedLevel = Number.isInteger(value.energyCapsuleAwardedLevel) && value.energyCapsuleAwardedLevel >= 1 && value.energyCapsuleAwardedLevel <= 50 ? value.energyCapsuleAwardedLevel : null;
    profile.pointLedger = value.pointLedger && Number.isSafeInteger(value.pointLedger.total) && value.pointLedger.total >= 0 && Array.isArray(value.pointLedger.observedProgress)
      ? clone(value.pointLedger) : null;
    const best = Number(value.bestRecords?.bestTimeMs);
    profile.bestRecords.bestTimeMs = Number.isFinite(best) && best > 0 ? best : null;
    profile.enabledModes = value.enabledModes && typeof value.enabledModes === "object" ? clone(value.enabledModes) : {};
    profile.energyMultipliers = value.energyMultipliers && typeof value.energyMultipliers === "object" ? clone(value.energyMultipliers) : {};
    profile.dailyTargetCounts = value.dailyTargetCounts && typeof value.dailyTargetCounts === "object" ? clone(value.dailyTargetCounts) : {};
    profile.freePlayEnabled = value.freePlayEnabled === true;
    profile.freePlayEnergyMode = value.freePlayEnergyMode === "almost-zero" ? "almost-zero" : "normal";
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

    function mutateProfile(profileId, mutator) {
      const registry = readRegistry();
      const id = String(profileId || "");
      const index = registry.profiles.findIndex((profile) => profile.profileId === id);
      if (index < 0) throw new Error("profile not found");
      const profile = registry.profiles[index];
      mutator(profile);
      profile.updatedAt = isoNow(now);
      registry.profiles[index] = normalizeProfile(profile);
      writeRegistry(registry);
      return clone(registry.profiles[index]);
    }

    function mutateActiveProfile(mutator) {
      const id = ensureActiveProfile();
      if (!id) throw new Error("active profile is missing");
      return mutateProfile(id, mutator);
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

    // Points are a permanent, profile-owned record. The first snapshot is valued
    // once at migration; later changes credit only the positive difference between
    // the previous and current vehicle state under the CURRENT ruleset.
    // Repricing past progress therefore never changes the stored total.
    function vehiclePointValue(raw) {
      if (!raw?.discovered) return 0;
      const stage = Math.max(2, Math.min(5, Math.floor(Number(raw.stage) || 2)));
      const medal = raw.masterMedal === true;
      const friendly = raw.friendly === true || stage > 2 || medal;
      const hearts = friendly ? 5 : Math.max(0, Math.min(5, Math.floor(Number(raw.friendship) || 0)));
      let points = 5 + hearts * 2 + (friendly ? 10 : 0);
      const thresholds = [30, 50, 100, 200];
      const bonuses = [30, 50, 100, 200];
      const completed = medal ? 4 : stage - 2;
      for (let i = 0; i < completed; i += 1) points += thresholds[i] + bonuses[i];
      if (friendly) points += Math.max(0, Math.min(medal ? 500 : thresholds[completed], Math.floor(Number(raw.energy) || 0)));
      return points;
    }
    function getLevelAcknowledged() { return getActiveProfile()?.levelAcknowledged ?? null; }
    function setLevelAcknowledged(level) { if (!Number.isInteger(level) || level < 1 || level > 50) throw new RangeError("invalid level"); return mutateActiveProfile((profile) => { profile.levelAcknowledged = level; }); }
    function getEnergyCapsuleCount() { return getActiveProfile()?.energyCapsuleCount ?? 0; }
    // Existing players begin at their last acknowledged level; pending level-ups
    // are granted once, and an existing inventory is never retroactively inflated.
    function awardEnergyCapsulesThroughLevel(level) {
      if (!Number.isInteger(level) || level < 1 || level > 50) throw new RangeError("invalid level");
      let added = 0;
      mutateActiveProfile((profile) => {
        const previous = profile.energyCapsuleAwardedLevel ?? (profile.levelAcknowledged ?? level);
        if (level <= previous) { profile.energyCapsuleAwardedLevel = previous; return; }
        added = Math.min(99 - profile.energyCapsuleCount, level - previous);
        profile.energyCapsuleCount += added;
        profile.energyCapsuleAwardedLevel = level;
      });
      return added;
    }
    function consumeEnergyCapsule() {
      if (!getEnergyCapsuleCount()) return false;
      mutateActiveProfile((profile) => {
        if (profile.energyCapsuleCount < 1) throw new Error("no energy capsule");
        profile.energyCapsuleCount -= 1;
      });
      return true;
    }
    function getPointLedger() { return clone(getActiveProfile()?.pointLedger ?? null); }
    function initializePointLedger(progress) {
      if (!Array.isArray(progress)) throw new Error("point migration requires collection progress");
      return mutateActiveProfile((profile) => {
        if (profile.pointLedger) return;
        const observedProgress = clone(progress);
        const total = observedProgress.reduce((sum, item) => sum + vehiclePointValue(item), 0);
        profile.pointLedger = { schemaVersion: 1, total, initialPoints: total, observedProgress, nextSequence: 1,
          recentEvents: [{ id: "migration-v1", type: "initial-migration", points: total }] };
      }).pointLedger;
    }
    function commitRewardProgressWithPoints(progress, { consumeEnergyCapsule = false, questBonusClaimDate = null } = {}) {
      if (!Array.isArray(progress)) throw new Error("reward progress array required");
      return mutateActiveProfile((profile) => {
        if (questBonusClaimDate) {
          if (profile.progress.questBonusClaimDate === questBonusClaimDate) throw new Error("quest bonus already claimed today");
          profile.progress.questBonusClaimDate = questBonusClaimDate;
        }
        if (consumeEnergyCapsule) {
          if (profile.energyCapsuleCount < 1) throw new Error("no energy capsule to use");
          profile.energyCapsuleCount -= 1;
        }
        if (!profile.pointLedger) {
          // Never silently create a zero-point ledger if initialization was skipped.
          // Recover the previous saved state as the migration baseline.
          const baseline = Array.isArray(profile.progress.rewardProgressPhase1) ? profile.progress.rewardProgressPhase1 : [];
          const total = baseline.reduce((sum, item) => sum + vehiclePointValue(item), 0);
          profile.pointLedger = { schemaVersion: 1, total, initialPoints: total,
            observedProgress: clone(baseline), nextSequence: 1,
            recentEvents: [{ id: "migration-v1", type: "initial-migration", points: total }] };
        }
        const ledger = profile.pointLedger;
        const old = ledger.observedProgress;
        for (let i = 0; i < progress.length; i += 1) {
          const delta = Math.max(0, vehiclePointValue(progress[i]) - vehiclePointValue(old[i]));
          if (!delta) continue;
          ledger.total += delta;
          ledger.recentEvents.push({ id: "earned-" + ledger.nextSequence++, type: "progress", vehicleIndex: i, points: delta });
        }
        // Events are an inspection log; lifetime totals never depend on truncation.
        if (ledger.recentEvents.length > 500) ledger.recentEvents = ledger.recentEvents.slice(-500);
        ledger.observedProgress = clone(progress);
        profile.progress.rewardProgressPhase1 = clone(progress);
      }).pointLedger;
    }

    // Profile-scoped time energy. All commits update balance and vehicle progress
    // in one registry write. QA uses its separate storage key, never production progress.
    function getTimeEnergy() {
      const qa = getActiveQaState();
      return normalizeTimeEnergy(qa.qaEnabled ? qa.timeEnergy : getActiveProfile()?.progress.timeEnergy);
    }
    function mutateTimeEnergy(mutator) {
      const qa = getActiveQaState();
      if (qa.qaEnabled) {
        const state = normalizeTimeEnergy(qa.timeEnergy);
        const result = mutator(state, null);
        setActiveQaState({ ...qa, timeEnergy: state });
        return result;
      }
      let result;
      mutateActiveProfile((profile) => {
        profile.progress.timeEnergy = normalizeTimeEnergy(profile.progress.timeEnergy);
        result = mutator(profile.progress.timeEnergy, profile);
      });
      return result;
    }
    function creditTimeEnergy(amount, eventId) {
      if (!Number.isSafeInteger(amount) || amount <= 0 || typeof eventId !== "string" || !eventId) throw new Error("invalid time energy credit");
      return mutateTimeEnergy((state) => {
        if (state.completed.some((item) => item.id === "credit:" + eventId)) return false;
        if (!Number.isSafeInteger(state.balance + amount)) throw new Error("time energy overflow");
        state.balance += amount;
        state.completed.push({ id:"credit:" + eventId, amount, vehicleIndex:-1 });
        state.completed = state.completed.slice(-100);
        return true;
      });
    }
    function beginTimeEnergyAllocation(eventId, deadline) {
      if (typeof eventId !== "string" || !eventId || !Number.isFinite(deadline)) throw new Error("invalid allocation");
      return mutateTimeEnergy((state) => {
        if (state.allocation) return clone(state.allocation);
        if (!state.balance) return null;
        if (state.completed.some((item) => item.id === eventId)) return null;
        state.allocation = { id:eventId, amount:state.balance, deadline, vehicleIndex:null };
        return clone(state.allocation);
      });
    }
    function lockTimeEnergyVehicle(eventId, vehicleIndex) {
      if (!Number.isInteger(vehicleIndex) || vehicleIndex < 0 || vehicleIndex >= 20) throw new Error("invalid vehicle");
      return mutateTimeEnergy((state) => {
        const allocation = state.allocation;
        if (!allocation || allocation.id !== eventId) return null;
        if (allocation.vehicleIndex === null) allocation.vehicleIndex = vehicleIndex;
        return clone(allocation);
      });
    }
    function commitTimeEnergyAllocation(eventId, nextProgress, expectedPrevious = null) {
      if (!Array.isArray(nextProgress) || nextProgress.length !== 20) throw new Error("invalid progress");
      const qa = getActiveQaState();
      if (qa.qaEnabled) {
        let saved = false;
        const result = mutateTimeEnergy((state) => {
          if (state.completed.some((item) => item.id === eventId)) return false;
          const allocation = state.allocation;
          if (!allocation || allocation.id !== eventId || allocation.vehicleIndex === null) return false;
          if (state.balance < allocation.amount) throw new Error("insufficient time energy");
          state.balance -= allocation.amount;
          state.completed.push({ id:eventId, amount:allocation.amount, vehicleIndex:allocation.vehicleIndex });
          state.completed = state.completed.slice(-100);
          state.allocation = null;
          saved = true;
          return true;
        });
        if (saved) {
          const latest = getActiveQaState();
          setActiveQaState({ ...latest, timeEnergyRewardProgress: clone(nextProgress) });
        }
        return result;
      }
      return mutateTimeEnergy((state, profile) => {
        if (state.completed.some((item) => item.id === eventId)) return false;
        const allocation = state.allocation;
        if (!allocation || allocation.id !== eventId || allocation.vehicleIndex === null) return false;
        if (state.balance < allocation.amount) throw new Error("insufficient time energy");
        const before = profile.progress.rewardProgressPhase1;
        if (!Array.isArray(before) || before.length !== 20) throw new Error("missing vehicle progress");
        const index = allocation.vehicleIndex;
        if (expectedPrevious && JSON.stringify(before[index]) !== JSON.stringify(expectedPrevious)) throw new Error("stale vehicle progress");
        if (JSON.stringify(before.filter((_, i) => i !== index)) !== JSON.stringify(nextProgress.filter((_, i) => i !== index))) throw new Error("unrelated vehicle progress changed");
        state.balance -= allocation.amount;
        state.completed.push({ id:eventId, amount:allocation.amount, vehicleIndex:index });
        state.completed = state.completed.slice(-100);
        state.allocation = null;
        // Shares the point-ledger semantics of commitRewardProgressWithPoints.
        if (!profile.pointLedger) {
          const baseline = Array.isArray(before) ? before : [];
          const total = baseline.reduce((sum, item) => sum + vehiclePointValue(item), 0);
          profile.pointLedger = { schemaVersion:1, total, initialPoints:total, observedProgress:clone(baseline), nextSequence:1, recentEvents:[] };
        }
        const ledger = profile.pointLedger;
        if (!Array.isArray(ledger.observedProgress)) throw new Error("invalid point ledger");
        const delta = Math.max(0, vehiclePointValue(nextProgress[index]) - vehiclePointValue(ledger.observedProgress[index]));
        if (delta) {
          ledger.total += delta;
          ledger.recentEvents.push({ id:"earned-" + ledger.nextSequence++, type:"progress", vehicleIndex:index, points:delta });
          if (ledger.recentEvents.length > 500) ledger.recentEvents = ledger.recentEvents.slice(-500);
        }
        ledger.observedProgress = clone(nextProgress);
        profile.progress.rewardProgressPhase1 = clone(nextProgress);
        // The collection stages are refreshed by the existing collection sync path.
        return true;
      });
    }
    function getRewardProgress() { return clone(getActiveProfile()?.progress.rewardProgressPhase1 ?? null); }
    function setRewardProgress(value) { return mutateActiveProfile((profile) => { profile.progress.rewardProgressPhase1 = Array.isArray(value) ? clone(value) : null; }); }
    function getProgressSnapshot() {
      return { rewardProgress: getRewardProgress(), collection: getCollectionStages() };
    }
    function restoreProgressSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== "object") throw new Error("progress snapshot is required");
      return mutateActiveProfile((profile) => {
        profile.progress.rewardProgressPhase1 = Array.isArray(snapshot.rewardProgress) ? clone(snapshot.rewardProgress) : null;
        profile.collection.stages = Array.isArray(snapshot.collection) ? clone(snapshot.collection) : null;
      });
    }
    function getRecentVehicles() { return clone(getActiveProfile()?.progress.recentVehicles ?? []); }
    function setRecentVehicles(value) { return mutateActiveProfile((profile) => { profile.progress.recentVehicles = Array.isArray(value) ? clone(value) : []; }); }
    function getBestTime() { return getActiveProfile()?.bestRecords.bestTimeMs ?? null; }
    function setBestTime(value) { return mutateActiveProfile((profile) => { const n = Number(value); profile.bestRecords.bestTimeMs = Number.isFinite(n) && n > 0 ? n : null; }); }
    function getTopCollectionLastUsedJst() { return getActiveProfile()?.progress.topCollectionLastUsedJst ?? null; }
    function setTopCollectionLastUsedJst(value) { return mutateActiveProfile((profile) => { profile.progress.topCollectionLastUsedJst = value ? String(value) : null; }); }
    function getOpeningMovieLastPlayedJst() { return getActiveProfile()?.progress.openingMovieLastPlayedJst ?? null; }
    function setOpeningMovieLastPlayedJst(value) { return mutateActiveProfile((profile) => { profile.progress.openingMovieLastPlayedJst = value ? String(value) : null; }); }
    function getQuestBonusClaimDate() { return getActiveProfile()?.progress.questBonusClaimDate ?? null; }
    function getDailyMission() {
      const mission = getActiveProfile()?.progress.dailyMission;
      return clone(mission && typeof mission === "object" ? mission : { date:null, completedCounts:{} });
    }
    function setDailyMission(value) {
      const mission = value && typeof value === "object" ? value : {};
      return mutateActiveProfile((profile) => {
        profile.progress.dailyMission = {
          date: typeof mission.date === "string" ? mission.date : null,
          completedCounts: mission.completedCounts && typeof mission.completedCounts === "object" ? clone(mission.completedCounts) : {},
          ...(Number.isInteger(mission.questRewardLevel) && mission.questRewardLevel >= 1 ? { questRewardLevel:mission.questRewardLevel } : {})
        };
      });
    }
    function getProfileLearningSettings(profileId) {
      const id = String(profileId || "");
      const profile = readRegistry().profiles.find((item) => item.profileId === id);
      if (!profile) throw new Error("profile not found");
      return clone({
        enabledModes: profile.enabledModes || {},
        energyMultipliers: profile.energyMultipliers || {},
        dailyTargetCounts: profile.dailyTargetCounts || {},
        freePlayEnabled: profile.freePlayEnabled === true,
        freePlayEnergyMode: profile.freePlayEnergyMode === "almost-zero" ? "almost-zero" : "normal"
      });
    }
    function setProfileLearningSettings(profileId, value) {
      const settings = value && typeof value === "object" ? value : {};
      return mutateProfile(profileId, (profile) => {
        profile.enabledModes = settings.enabledModes && typeof settings.enabledModes === "object" ? clone(settings.enabledModes) : {};
        profile.energyMultipliers = settings.energyMultipliers && typeof settings.energyMultipliers === "object" ? clone(settings.energyMultipliers) : {};
        profile.dailyTargetCounts = settings.dailyTargetCounts && typeof settings.dailyTargetCounts === "object" ? clone(settings.dailyTargetCounts) : {};
        profile.freePlayEnabled = settings.freePlayEnabled === true;
        profile.freePlayEnergyMode = settings.freePlayEnergyMode === "almost-zero" ? "almost-zero" : "normal";
      });
    }

    function getCollectionSceneOrder() {
      const value = getActiveProfile()?.progress?.collectionSceneOrder;
      return clone(value || { vehicle: [], robot: [], "super-robot": [], equipment: [], medal: [] });
    }
    function setCollectionSceneOrder(value) {
      const next = value && typeof value === "object" ? value : {};
      return mutateActiveProfile((profile) => {
        profile.progress.collectionSceneOrder = {
          vehicle: Array.isArray(next.vehicle) ? next.vehicle.filter((item) => Number.isInteger(item) && item >= 0 && item < 20) : [],
          robot: Array.isArray(next.robot) ? next.robot.filter((item) => Number.isInteger(item) && item >= 0 && item < 20) : [],
          "super-robot": Array.isArray(next["super-robot"]) ? next["super-robot"].filter((item) => Number.isInteger(item) && item >= 0 && item < 20) : [],
          equipment: Array.isArray(next.equipment) ? next.equipment.filter((item) => Number.isInteger(item) && item >= 0 && item < 20) : [],
          medal: Array.isArray(next.medal) ? next.medal.filter((item) => Number.isInteger(item) && item >= 0 && item < 20) : []
        };
      });
    }

    function getCollectionCategorySeen() {
      const value = getActiveProfile()?.progress?.collectionCategorySeen;
      return Array.isArray(value) ? clone(value) : null;
    }
    function setCollectionCategorySeen(value) {
      const allowed = new Set(["vehicle", "robot", "super-robot", "equipment", "medal"]);
      const next = Array.isArray(value) ? [...new Set(value.filter((item) => allowed.has(item)))] : [];
      return mutateActiveProfile((profile) => {
        profile.progress.collectionCategorySeen = next;
      });
    }

    function getAcquisitionHistory() { return clone(getActiveProfile()?.acquisitionHistory ?? []); }
    function appendAcquisitionHistory(entry) {
      if (!entry || typeof entry !== "object") throw new Error("acquisition entry is required");
      const vehicleId = typeof entry.vehicleId === "string" ? entry.vehicleId : "";
      const acquisitionType = typeof entry.acquisitionType === "string" ? entry.acquisitionType : "";
      const mode = typeof entry.mode === "string" ? entry.mode : "";
      const source = typeof entry.source === "string" ? entry.source : "normal";
      const eventKey = typeof entry.eventKey === "string" ? entry.eventKey : `${vehicleId}:${acquisitionType}`;
      const displayStage = Number(entry.displayStage);
      if (!vehicleId || !acquisitionType || !mode || !eventKey) throw new Error("acquisition entry is incomplete");
      let added = false;
      let record = null;
      mutateActiveProfile((profile) => {
        const history = normalizeAcquisitionHistory(profile.acquisitionHistory);
        const duplicate = history.find((item) => item.eventKey === eventKey);
        if (duplicate) { record = duplicate; profile.acquisitionHistory = history; return; }
        record = {
          eventKey,
          sequence: history.length + 1,
          timestamp: isoNow(now),
          mode,
          source,
          vehicleId,
          acquisitionType,
          displayForm: typeof entry.displayForm === "string" ? entry.displayForm : null,
          displayStage: Number.isInteger(displayStage) && displayStage >= 1 && displayStage <= 5 ? displayStage : null
        };
        history.push(record);
        profile.acquisitionHistory = history;
        added = true;
      });
      return { added, record: clone(record) };
    }

    function resetActiveProfileData() {
      return mutateActiveProfile((profile) => {
        profile.collection = { stages: null };
        profile.progress = { timeEnergy: { balance:0, allocation:null, completed:[] }, rewardProgressPhase1: null, recentVehicles: [], topCollectionLastUsedJst: null, openingMovieLastPlayedJst: null, dailyMission: { date:null, completedCounts:{} }, questBonusClaimDate: null, collectionSceneOrder: { vehicle: [], robot: [], "super-robot": [], equipment: [], medal: [] }, collectionCategorySeen: [], legacyHistory: null, legacyRanking: null };
        profile.bestRecords = { bestTimeMs: null };
        profile.acquisitionHistory = [];
        profile.pointLedger = null;
        profile.levelAcknowledged = null;
        profile.energyCapsuleCount = 0;
        profile.energyCapsuleAwardedLevel = null;
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
      getTimeEnergy, creditTimeEnergy, beginTimeEnergyAllocation, lockTimeEnergyVehicle, commitTimeEnergyAllocation,
      getPointLedger, initializePointLedger, commitRewardProgressWithPoints,
      getLevelAcknowledged, setLevelAcknowledged,
      getEnergyCapsuleCount, awardEnergyCapsulesThroughLevel, consumeEnergyCapsule,
      calculateVehiclePointValue: vehiclePointValue,
      getProgressSnapshot, restoreProgressSnapshot,
      getRecentVehicles, setRecentVehicles, getBestTime, setBestTime,
      getTopCollectionLastUsedJst, setTopCollectionLastUsedJst,
      getOpeningMovieLastPlayedJst, setOpeningMovieLastPlayedJst,
      getDailyMission, setDailyMission, getQuestBonusClaimDate,
      getProfileLearningSettings, setProfileLearningSettings,
      getCollectionSceneOrder, setCollectionSceneOrder,
      getCollectionCategorySeen, setCollectionCategorySeen,
      getAcquisitionHistory, appendAcquisitionHistory,
      resetActiveProfileData, getActiveQaState, setActiveQaState
    };
  }

  return { createProfileStorage, rewardProgressFromCollectionStages, keys, legacyKeys, SCHEMA_VERSION, MIGRATION_VERSION };
});
