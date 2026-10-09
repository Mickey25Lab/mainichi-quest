(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const appVersion = "0.0.128";
  const screens = ["start-screen", "mode-select-screen", "play-screen", "transition-screen", "reward-screen", "result-screen", "collection-screen", "collection-detail-screen"];
  const correctSoundPaths = ["./assets/audio/correct-grand-fanfare.wav", "./assets/audio/correct-arcade-celebration.wav", "./assets/audio/correct-applause-cheer.wav"];
  const startSoundPath = "./assets/audio/warizan-start-powerup.wav";
  const startKeyVisualPath = "./assets/ui/top/top_key_visual.webp";
  const topBackgroundPath = "./assets/ui/top/top_background.webp";
  const topStartButtonPath = "./assets/ui/top/top_button_start.webp";
  const topCollectionButtonPath = "./assets/ui/top/top_button_collection.webp";
  const topCollectionUsedButtonPath = "./assets/ui/top/top_button_no_collection.webp";
  const modeSelectPath = "./assets/ui/top/mode_select_background.webp";
  const rewardNextVehicleOverlayPath = "./assets/ui/reward_popup/vehicle_transition_next.webp";
  const vehicleTransitionFiveClearPath = "./assets/ui/reward_popup/vehicle_transition_five_clear.webp";
  const discoveryBubblePath = "./assets/ui/speech_bubble/stage1_no_vehicle_speech_bubble.webp";
  const rewardNextVehicleOverlayDurationMs = 2000;
  const incorrectNextVehicleNoticeDurationMs = 2000;
  const retryStartDelayMs = 3000;
  const idleGuideDelayMs = 60 * 1000;
  const collectionEndTransitionDurationMs = 1000 * 3;
  const correctFeedbackDurationMs = 560 * 1.5;
  const progressGainHoldDurationMs = 0;
  const timeBonusHoldDurationMs = 400;
  const progressGainAnimationDurationMs = 1180;
  const progressGainTotalDurationMs = progressGainHoldDurationMs + progressGainAnimationDurationMs;
  const progressGainCleanupDurationMs = 40;
  const vehicleDustCleanupMs = 980;
  const energyFullDisplayDurationMs = 240;
  // Temporary, Minato-only rule.  Keep the thresholds, amount, modes, and
  // copy together so the whole feature can be removed or tuned in one place.
  const timeBonusConfig = Object.freeze({
    enabled: true,
    amount: 1,
    label: "タイムボーナス +1",
    modes: Object.freeze(["normal", "longdivision", "multiplication", "multiplication2x2"]),
    limitMsByAnswerDigits: Object.freeze({ 1: 4000, 2: 5000, 3: 10000, 4: 15000, 5: 20000 })
  });
  // Keep the music asset, levels, and preference key together so a future
  // BGM swap or chooser remains independent from game progression.
  const bgmConfig = Object.freeze({
    filePath: "./assets/audio/bgm_pynchon.mp3",
    normalVolume: 0.22,
    rewardDuckMultiplier: 0.30,
    storageKey: "warizan-robot:bgm-enabled-v1"
  });
  const wrongFeedbackDurationMs = 500;
  const revealedAnswerDurationMs = 2000 * 2;
  const collectionStageWidth = 1400;
  const collectionStageHeight = 1050;
  const questionTimeoutMs = 5 * 60 * 1000;
  const rarityConfig = Object.freeze({
    normal: { label: "ノーマル", stars: "★", weight: 10 },
    special: { label: "スペシャル", stars: "★★", weight: 5 },
    rare: { label: "レア", stars: "★★★", weight: 2 },
    "super-rare": { label: "スーパーレア", stars: "★★★★", weight: 1 }
  });
  const storageKeys = {
    bestTime: "warizan-robot:best-time-ms",
    collection: "warizan-robot:vehicle-collection-v1",
    recentVehicles: "warizan-robot:recent-vehicles-v1",
    history: "warizan-robot:history",
    ranking: "warizan-robot:ranking",
    topCollectionLastUsedJst: "warizan-robot:top-collection-last-used-jst",
    resetMarker: "warizan-robot:records-reset-2026-09-19",
    rewardResetMarker: "warizan-robot:reward-reset-v40-done",
    collectionResetV60Marker: "warizan-robot:collection-reset-20260924-done",
    topCollectionAccessResetV60Marker: "warizan-robot:collection-access-reset-20260924-done",
    rewardProgressPhase1: "warizan-robot:reward-progress-phase1-v1",
    rewardProgressPhase1ResetMarker: "warizan-robot:reward-progress-phase1-reset-20260928-done"
  };
  const previewQaProgressPresetMarker = "warizan-robot:preview-qa-progress-v1";
  const vehicles = [
    ["Patrol Car", "パトカー", "01_Patrol_Car.webp", "01_patrol_car.webp", "#28aaff", "normal", 10],
    ["Fire Engine", "消防車", "02_Fire_Engine.webp", "02_fire_engine.webp", "#ff453a", "normal", 10],
    ["Ambulance", "救急車", "03_Ambulance.webp", "03_ambulance.webp", "#ff6b6b", "normal", 10],
    ["Delivery Truck", "宅配便車", "04_Delivery_Truck.webp", "04_delivery_truck.webp", "#35d471", "normal", 10],
    ["Mail Van", "郵便車", "05_Mail_Van.webp", "05_mail_van.webp", "#ef4450", "normal", 10],
    ["Garbage Truck", "ゴミ収集車", "06_Garbage_Truck.webp", "06_garbage_truck.webp", "#168fe5", "normal", 10],
    ["Tow Truck", "レッカー車", "07_Tow_Truck.webp", "07_tow_truck.webp", "#ffd42a", "normal", 5],
    ["Crane Truck", "クレーン車", "08_Crane_Truck.webp", "08_crane_truck.webp", "#41d66c", "special", 5],
    ["Concrete Mixer", "コンクリートミキサー車", "09_Concrete_Mixer.webp", "09_concrete_mixer.webp", "#27de75", "special", 5],
    ["Bulldozer", "ブルドーザー", "10_Bulldozer.webp", "10_bulldozer.webp", "#f4b21b", "special", 5],
    ["Road Roller", "ロードローラー", "11_Road_Roller.webp", "11_road_roller.webp", "#f0a515", "special", 5],
    ["Tank Lorry", "タンクローリー", "12_Tank_Lorry.webp", "12_tank_lorry.webp", "#ff8c22", "special", 5],
    ["Watering Truck", "散水車", "13_Watering_Truck.webp", "13_watering_truck.webp", "#27afff", "normal", 5],
    ["Kindergarten Bus", "幼稚園バス", "14_Kindergarten_Bus.webp", "14_kindergarten_bus.webp", "#ffd322", "normal", 10],
    ["Sightseeing Bus", "観光バス", "15_Sightseeing_Bus.webp", "15_sightseeing_bus.webp", "#f04b42", "normal", 5],
    ["Formula Racer", "F1カー", "16_Formula_Racer.webp", "16_formula_racer.webp", "#ca54ff", "super-rare", 1],
    ["Racing Bike", "レーシングバイク", "17_Racing_Bike.webp", "17_racing_bike.webp", "#ffd524", "rare", 2],
    ["Snowmobile", "スノーモービル", "18_Snowmobile.webp", "18_snowmobile.webp", "#63cfff", "rare", 2],
    ["Helicopter", "ヘリコプター", "19_Helicopter.webp", "19_helicopter.webp", "#f44943", "rare", 2],
    ["Airplane", "飛行機", "20_Airplane.webp", "20_airplane.webp", "#44a9ff", "super-rare", 1]
  ].map(([nameEn, nameJa, image, stemFile, color, rarity, weight], index) => ({
    index, nameEn, nameJa, image: `./assets/collection/09_complete/detail/${image}`,
    stem: stemFile.replace(/\.webp$/, ""), color, rarity,
    rarityLabel: rarityConfig[rarity].label, rarityStars: rarityConfig[rarity].stars, weight
  }));
  // Keep stable vehicle IDs for saved progress.  The garage uses this explicit
  // display order instead of reordering the persistent vehicles array.
  const collectionDisplayOrder = Object.freeze([0, 1, 2, 3, 4, 5, 6, 13, 14, 12, 11, 8, 7, 9, 10, 15, 16, 17, 18, 19]);
  const rewardTitles = ["", "のりもの発見！", "ロボットに進化！", "スーパーロボット！", "スペシャル装備をゲット！", "マスターメダルをゲット！"];
  const rewardLabels = ["", "のりもの", "ロボット", "スーパーロボット", "スペシャル装備", "マスターメダル"];
  const rewardBackplates = [null, "reward_stage01_vehicle.webp", "reward_stage02_robot.webp", "reward_stage03_super_robot.webp", "reward_stage04_special_equipment.webp"];
  const rewardArtwork = [null, "assets/collection/01_vehicle", "assets/collection/02_robot", "assets/collection/03_super_robot", "assets/collection/05_equipment"];
  const rewardArtworkSuffix = [null, "vehicle", "robot", "super_robot", "equipment"];
  const imagePreparationTimeoutMs = 8000;
  const answerArtFolders = [null, "", "assets/collection/01_vehicle", "assets/collection/02_robot", "assets/collection/03_super_robot", "assets/collection/04_super_robot_equipped"];
  const answerArtSuffixes = [null, "", "vehicle", "robot", "super_robot", "super_robot_equipped"];
  const answerBubbleFiles = [null, null, "stage2_vehicle_speech_bubble.webp", "stage3_robot_speech_bubble.webp", "stage4_super_robot_speech_bubble.webp", "stage5_super_robot_equipped_speech_bubble.webp"];
  const answerBubblePositions = [null, null, { top:305, width:400 }, { top:235, width:410 }, { top:null, width:420 }, { top:null, width:420 }];
  const answerArtCanvasScales = [0, 0, 0.39, 0.36, 0.55, 0.55];
  const listedTwoDigitQuotientProblems = [
    [20, 2], [22, 2], [24, 2], [26, 2], [28, 2], [40, 2], [42, 2], [44, 2], [46, 2], [48, 2],
    [60, 2], [62, 2], [64, 2], [66, 2], [68, 2], [80, 2], [82, 2], [84, 2], [86, 2], [88, 2],
    [30, 3], [33, 3], [36, 3], [39, 3], [60, 3], [63, 3], [66, 3], [69, 3],
    [90, 3], [93, 3], [96, 3], [99, 3], [40, 4], [44, 4], [48, 4], [80, 4], [84, 4], [88, 4]
  ];

  const state = {
    questions: [], queue: [], current: null, phase: "start", initialIndex: 0, initialCorrect: 0,
    missed: [], startedAt: 0, finalElapsedMs: 0, timerId: null, timerPaused: false, timerPausedAt: 0, pausedTimerMs: 0,
    transitioning: false, confirmingAnswer: false, runId: 0,
    inputMode: "quotient", quotientInput: "", remainderInput: "", correctSoundBuffers: [],
    correctSoundsLoading: null, lastCorrectSoundIndex: -1, startSound: null,
    collection: Array(20).fill(0), rewardProgress: [], currentVehicleIndex: 0, currentStage: 1, preparedInitialVehicleIndex: null,
    recentVehicleHistory: [], sessionUnlocks: [0, 0, 0, 0, 0, 0], sessionResultGets: [], resultStartProgress: [], collectionNewVehicleIndexes: new Set(), collectionUsed: false,
    collectionDeadline: 0, collectionTimerId: null, collectionClosing: false, detailVehicleIndex: 0, preparedNextQuestionVisual: null, pendingNextVehicleOverlay: null,
    questionDeadline: 0, questionTimeoutId: null, idleGuideTimer: null, retryAutoStartTimer: null, correctStreak: 0, vehicleChallengeQuestionCount: 0,
    energyDisplayOverride: null,
    mode: "normal", longDivision: null, numberCards: null, multiplication: null, multiplication2x2: null,
    bgmAudio: null, bgmBuffer: null, bgmBufferPromise: null, bgmSource: null, bgmGain: null, bgmEnabled: true, bgmDucked: false, bgmPriming: false
  };

  function resetStoredRecordsOnce() {
    try {
      if (localStorage.getItem(storageKeys.resetMarker) === "done") return;
      localStorage.removeItem(storageKeys.bestTime);
      localStorage.removeItem(storageKeys.history);
      localStorage.removeItem(storageKeys.ranking);
      localStorage.setItem(storageKeys.resetMarker, "done");
    } catch (_) {}
  }
  function resetRewardProgressOnce() {
    try {
      if (localStorage.getItem(storageKeys.rewardResetMarker) === "done") return;
      localStorage.removeItem(storageKeys.collection);
      localStorage.setItem(storageKeys.rewardResetMarker, "done");
    } catch (_) {}
  }
  function resetCollectionForV60Once() {
    try {
      if (localStorage.getItem(storageKeys.collectionResetV60Marker) === "done") return;
      localStorage.removeItem(storageKeys.collection);
      localStorage.setItem(storageKeys.collectionResetV60Marker, "done");
    } catch (_) {}
  }
  function resetTopCollectionAccessForV60Once() {
    try {
      if (localStorage.getItem(storageKeys.topCollectionAccessResetV60Marker) === "done") return;
      localStorage.removeItem(storageKeys.topCollectionLastUsedJst);
      localStorage.setItem(storageKeys.topCollectionAccessResetV60Marker, "done");
    } catch (_) {}
  }
  function emptyVehicleProgress() { return { discovered: false, friendship: 0, friendly: false, stage: 1, energy: 0, masterMedal: false }; }
  function resetRewardProgressPhase1Once() {
    try {
      if (localStorage.getItem(storageKeys.rewardProgressPhase1ResetMarker) === "done") return;
      localStorage.removeItem(storageKeys.collection);
      localStorage.removeItem(storageKeys.rewardProgressPhase1);
      localStorage.setItem(storageKeys.rewardProgressPhase1ResetMarker, "done");
    } catch (_) {}
  }
  function collectionStageForProgress(progress) {
    if (!progress?.discovered) return 0;
    if (progress.masterMedal) return 5;
    return Math.max(1, Math.min(4, (Number(progress.stage) || 2) - 1));
  }
  function normalizeVehicleProgress(value) {
    const fresh = emptyVehicleProgress();
    if (!value || typeof value !== "object") return fresh;
    const discovered = Boolean(value.discovered);
    const stage = discovered ? Math.max(2, Math.min(5, Number(value.stage) || 2)) : 1;
    return {
      discovered, friendship: discovered ? Math.max(0, Math.min(5, Number(value.friendship) || 0)) : 0,
      friendly: discovered && Boolean(value.friendly), stage,
      energy: Math.max(0, Number(value.energy) || 0), masterMedal: discovered && Boolean(value.masterMedal)
    };
  }
  function loadRewardProgress() {
    state.rewardProgress = Array.from({ length: vehicles.length }, emptyVehicleProgress);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKeys.rewardProgressPhase1));
      if (Array.isArray(saved) && saved.length === vehicles.length) state.rewardProgress = saved.map(normalizeVehicleProgress);
    } catch (_) {}
    syncCollectionFromRewardProgress();
  }
  function saveRewardProgress() {
    try { localStorage.setItem(storageKeys.rewardProgressPhase1, JSON.stringify(state.rewardProgress)); } catch (_) {}
  }
  function syncCollectionFromRewardProgress() {
    state.collection = state.rewardProgress.map(collectionStageForProgress);
    saveCollection();
  }
  function vehicleProgress(vehicleIndex) { return state.rewardProgress[vehicleIndex] || emptyVehicleProgress(); }
  function currentStageForVehicle(vehicleIndex) {
    const progress = vehicleProgress(vehicleIndex);
    return progress.discovered ? progress.stage : 1;
  }
  function requiredEnergyForStage(stage) { return ({ 2: 30, 3: 50, 4: 70, 5: 100 })[stage] || 0; }
  function energyStageForRequired(required) { return ({ 30: 2, 50: 3, 70: 4, 100: 5 })[required] || 0; }
  function progressSpeechBubbleSpec(vehicleIndex) {
    const progress = vehicleProgress(vehicleIndex);
    if (!progress.discovered || !progress.friendly || progress.masterMedal) return null;
    const visualEnergy = state.energyDisplayOverride?.vehicleIndex === vehicleIndex ? state.energyDisplayOverride : null;
    const required = visualEnergy?.required ?? requiredEnergyForStage(progress.stage);
    const energy = visualEnergy?.energy ?? progress.energy;
    const stage = visualEnergy ? energyStageForRequired(required) : progress.stage;
    const threshold = Math.floor(required * 0.8);
    if (!required || stage < 2 || stage > 5 || energy < threshold) return null;
    return { stage, energy, required, threshold, path: `./assets/ui/speech_bubble/${answerBubbleFiles[stage]}` };
  }
  function loadCollection() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKeys.collection));
      if (Array.isArray(saved) && saved.length === 20) state.collection = saved.map((value) => Math.max(0, Math.min(5, Number(value) || 0)));
    } catch (_) {}
  }
  function saveCollection() {
    try { localStorage.setItem(storageKeys.collection, JSON.stringify(state.collection)); } catch (_) {}
  }
  function seedPreviewQaProgressPreset() {
    const params = new URLSearchParams(window.location.search);
    const host = window.location.hostname;
    const isCloudflarePreview = host.endsWith(".mainichi-quest-63c.pages.dev") && host !== "mainichi-quest-63c.pages.dev";
    const isLocalPreview = host === "localhost" || host === "127.0.0.1";
    if (params.get("qa") !== "progress" || (!isCloudflarePreview && !isLocalPreview)) return null;
    try {
      if (params.get("reset") !== "1" && localStorage.getItem(previewQaProgressPresetMarker) === "done") return null;
      const preset = Array.from({ length: vehicles.length }, emptyVehicleProgress);
      const normalVehicleIndexes = collectionDisplayOrder.filter((index) => vehicles[index].rarity === "normal").slice(0, 10);
      const progressStates = [
        null,
        { discovered: true, friendship: 3, friendly: false, stage: 2, energy: 0, masterMedal: false },
        { discovered: true, friendship: 5, friendly: true, stage: 3, energy: 0, masterMedal: false },
        { discovered: true, friendship: 5, friendly: true, stage: 3, energy: 25, masterMedal: false },
        { discovered: true, friendship: 5, friendly: true, stage: 4, energy: 45, masterMedal: false },
        { discovered: true, friendship: 5, friendly: true, stage: 5, energy: 80, masterMedal: false },
        { discovered: true, friendship: 5, friendly: true, stage: 5, energy: 100, masterMedal: true }
      ];
      normalVehicleIndexes.forEach((vehicleIndex, displayIndex) => {
        const progress = progressStates[displayIndex % progressStates.length];
        if (progress) preset[vehicleIndex] = progress;
      });
      localStorage.setItem(storageKeys.rewardProgressPhase1, JSON.stringify(preset));
      localStorage.setItem(previewQaProgressPresetMarker, "done");
      return normalVehicleIndexes[3];
    } catch (_) { return null; }
  }
  function loadRecentVehicles() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKeys.recentVehicles));
      if (Array.isArray(saved)) state.recentVehicleHistory = saved.filter((id) => Number.isInteger(id) && id >= 0 && id < vehicles.length).slice(-3);
    } catch (_) {}
  }
  function saveRecentVehicles() {
    try { localStorage.setItem(storageKeys.recentVehicles, JSON.stringify(state.recentVehicleHistory)); } catch (_) {}
  }
  function getBestTime() {
    try {
      const value = Number(localStorage.getItem(storageKeys.bestTime));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch (_) { return null; }
  }
  function saveBestTime(ms) {
    try { localStorage.setItem(storageKeys.bestTime, String(ms)); } catch (_) {}
  }
  function japanDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  function topCollectionAlreadyUsedToday() {
    const host = window.location.hostname;
    const previewQa = new URLSearchParams(window.location.search).get("qa") === "progress"
      && ((host.endsWith(".mainichi-quest-63c.pages.dev") && host !== "mainichi-quest-63c.pages.dev") || host === "localhost" || host === "127.0.0.1");
    if (previewQa) return false;
    try { return localStorage.getItem(storageKeys.topCollectionLastUsedJst) === japanDateKey(); } catch (_) { return false; }
  }
  function updateTopCollectionButton() {
    const button = $("top-collection-button");
    const used = topCollectionAlreadyUsedToday();
    button.disabled = used;
    button.setAttribute("aria-label", used ? "今日はもう見たよ" : "コレクションを見る");
    const image = $("top-collection-button-image");
    image.src = used ? topCollectionUsedButtonPath : topCollectionButtonPath;
    image.alt = used ? "今日はもう見たよ" : "コレクションを見る";
  }
  function openTopCollection() {
    if (state.collectionUsed || topCollectionAlreadyUsedToday()) { updateTopCollectionButton(); return; }
    try { localStorage.setItem(storageKeys.topCollectionLastUsedJst, japanDateKey()); } catch (_) {}
    updateTopCollectionButton();
    openCollection({ showSessionMarkers: false });
  }
  function showScreen(id) {
    screens.forEach((screenId) => $(screenId).classList.toggle("active", screenId === id));
    if (id !== "play-screen") stopBackgroundMusic();
  }
  function showRewardOverPlay() {
    screens.forEach((screenId) => $(screenId).classList.toggle("active", screenId === "play-screen" || screenId === "reward-screen"));
  }
  let collectionScaleRequest = 0;
  function sizeCollectionStage() {
    const width = document.documentElement.clientWidth || window.innerWidth;
    const height = document.documentElement.clientHeight || window.innerHeight;
    const scale = Math.min(width / collectionStageWidth, height / collectionStageHeight);
    $("collection-stage").style.setProperty("--collection-scale", String(scale));
    return scale;
  }
  function scheduleCollectionStageSize() {
    const requestId = ++collectionScaleRequest;
    window.requestAnimationFrame(() => {
      if (requestId === collectionScaleRequest) sizeCollectionStage();
    });
  }
  function setNeutralBackground() {
    $("app").style.setProperty("--background-image", "none");
    $("app").classList.add("fixed-background");
    $("play-background").hidden = true;
    $("play-background-next").hidden = true;
  }
  const imagePreloads = new Map();
  const imagePreloadPriorities = new Map();
  const decodeQueues = { high: [], low: [] };
  const queuedDecodeTasks = new Map();
  let activeDecodes = 0;
  const maxConcurrentDecodes = 2;
  let visualRequestId = 0;
  function imageCacheKey(path) { return new URL(path, document.baseURI).href; }
  function hasPreloadedImage(path) { return imagePreloads.has(imageCacheKey(path)); }
  function runDecodeQueue() {
    while (activeDecodes < maxConcurrentDecodes) {
      const task = decodeQueues.high.shift() || decodeQueues.low.shift();
      if (!task) return;
      task.started = true;
      activeDecodes += 1;
      Promise.resolve().then(() => task.image.decode ? task.image.decode() : undefined)
        .then(() => task.resolve(task.image), task.reject)
        .finally(() => { activeDecodes -= 1; runDecodeQueue(); });
    }
  }
  function promoteQueuedDecode(path) {
    const task = queuedDecodeTasks.get(path);
    if (!task || task.started || task.priority === "high") return;
    const index = decodeQueues.low.indexOf(task);
    if (index >= 0) decodeQueues.low.splice(index, 1);
    task.priority = "high";
    decodeQueues.high.push(task);
  }
  function queueImageDecode(path, image) {
    return new Promise((resolve, reject) => {
      const priority = imagePreloadPriorities.get(path) || "high";
      const task = { path, image, resolve, reject, priority };
      queuedDecodeTasks.set(path, task);
      (priority === "low" ? decodeQueues.low : decodeQueues.high).push(task);
      runDecodeQueue();
    });
  }
  function preloadImage(path, priority = "high") {
    const key = imageCacheKey(path);
    if (imagePreloads.has(key)) {
      if (priority === "high") { imagePreloadPriorities.set(key, "high"); promoteQueuedDecode(key); }
      return imagePreloads.get(key);
    }
    imagePreloadPriorities.set(key, priority);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => queueImageDecode(key, image).then(resolve, reject);
      image.onerror = () => reject(new Error(`Image failed to load: ${path}`));
      image.src = path;
    });
    imagePreloads.set(key, promise);
    promise.then(() => queuedDecodeTasks.delete(key), () => { imagePreloads.delete(key); imagePreloadPriorities.delete(key); queuedDecodeTasks.delete(key); });
    return promise;
  }
  function withTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      promise.then(
        (value) => { window.clearTimeout(timeoutId); resolve(value); },
        (error) => { window.clearTimeout(timeoutId); reject(error); }
      );
    });
  }
  function rewardVisualPaths(stage, vehicleIndex, kind = "evolution") {
    const vehicle = vehicles[vehicleIndex];
    if (!vehicle || stage < 1 || stage > 4) return null;
    const stem = vehicle.stem;
    return {
      backplatePath: `./assets/ui/reward_popup/${kind === "friendship" ? "reward_stage01_nakayoshi.webp" : rewardBackplates[stage]}`,
      artworkPath: stage === 1 ? vehicleArtworkPath(vehicleIndex) : `./${rewardArtwork[stage]}/${stem}_${rewardArtworkSuffix[stage]}.webp`
    };
  }
  function preloadDecodedImage(path, priority = "high") {
    return withTimeout(preloadImage(path, priority), imagePreparationTimeoutMs, `Image preparation: ${path}`);
  }
  function preloadRewardVisuals(stage, vehicleIndex, kind = "evolution") {
    const paths = rewardVisualPaths(stage, vehicleIndex, kind);
    if (!paths) return Promise.reject(new Error(`Unsupported reward stage: ${stage}`));
    return Promise.all([paths.backplatePath, paths.artworkPath].map(preloadDecodedImage)).then(() => paths);
  }
  function preloadPotentialReward(question) {
    // Stage evolution now depends on accumulated energy, so it cannot be
    // predicted from a question alone. Reward assets are prepared only when a
    // threshold is actually reached.
    void question;
  }
  function decodeImageElement(element, path) {
    element.src = path;
    let ready;
    if (typeof element.decode === "function") ready = element.decode();
    else if (element.complete) ready = element.naturalWidth > 0 ? Promise.resolve() : Promise.reject(new Error(`Image failed to load: ${path}`));
    else ready = new Promise((resolve, reject) => {
      element.addEventListener("load", resolve, { once: true });
      element.addEventListener("error", () => reject(new Error(`Image failed to load: ${path}`)), { once: true });
    });
    return withTimeout(ready.then(() => {
      if (!element.naturalWidth) throw new Error(`Image is not drawable: ${path}`);
    }), imagePreparationTimeoutMs, `Image element decode: ${path}`);
  }
  function playBackgroundPath(vehicleIndex) {
    const stem = vehicles[vehicleIndex].stem;
    return `./assets/backgrounds/play/${stem}_background.webp`;
  }
  function vehicleArtworkPath(vehicleIndex) {
    const stem = vehicles[vehicleIndex].stem;
    return `./assets/collection/01_vehicle/${stem}_vehicle.webp`;
  }
  function robotArtworkPath(vehicleIndex) {
    const stem = vehicles[vehicleIndex].stem;
    return `./assets/collection/02_robot/${stem}_robot.webp`;
  }
  function superRobotArtworkPath(vehicleIndex) {
    const stem = vehicles[vehicleIndex].stem;
    return `./assets/collection/03_super_robot/${stem}_super_robot.webp`;
  }
  function equippedSuperRobotArtworkPath(vehicleIndex) {
    const stem = vehicles[vehicleIndex].stem;
    return `./assets/collection/04_super_robot_equipped/${stem}_super_robot_equipped.webp`;
  }
  function vehicleLogoTitlePath(vehicleIndex) {
    const stem = vehicles[vehicleIndex].stem;
    return `./assets/collection/07_vehicle_logo_title/${stem}_vehicle_logo_title.png`;
  }
  function answerArtworkPath(vehicleIndex, stage) {
    if (stage < 2) return null;
    if (stage === 2) return vehicleArtworkPath(vehicleIndex).replace(/^\.\//, "");
    const stem = vehicles[vehicleIndex].stem;
    return `${answerArtFolders[stage]}/${stem}_${answerArtSuffixes[stage]}.webp`;
  }
  function preloadVehicleVisuals(vehicleIndex, stage) {
    const bubblePath = stage >= 2 ? `./assets/ui/speech_bubble/${answerBubbleFiles[stage]}` : null;
    const paths = [playBackgroundPath(vehicleIndex), answerArtworkPath(vehicleIndex, stage), bubblePath].filter(Boolean);
    paths.forEach((path) => preloadDecodedImage(path).catch(() => {}));
  }
  function preloadStage5RewardVisuals(vehicleIndex) {
    const vehicle = vehicles[vehicleIndex];
    const completePath = `./assets/collection/09_complete/reward/${String(vehicleIndex + 1).padStart(2, "0")}_${vehicle.nameEn.replaceAll(" ", "_")}_complete.png`;
    return Promise.all([completePath, "./assets/ui/reward_popup/reward_stage05_master-medal-get-overlay.webp"].map(preloadDecodedImage));
  }
  function preloadNormalQuestionBackgrounds() {
    vehicles.filter((vehicle) => vehicle.rarity === "normal")
      .forEach((vehicle) => preloadDecodedImage(playBackgroundPath(vehicle.index), "low").catch(() => {}));
  }
  function preloadRemainingVehicleArtwork() {
    vehicles.forEach((vehicle) => {
      const path = vehicleArtworkPath(vehicle.index);
      if (!hasPreloadedImage(path)) preloadDecodedImage(path, "low").catch(() => {});
    });
  }
  function preloadCollectionVehicleArtwork() {
    return Promise.all(vehicles.flatMap((vehicle) => {
      const progress = vehicleProgress(vehicle.index);
      const formStage = progress.masterMedal ? 5 : Math.max(2, Math.min(5, progress.stage));
      const paths = [vehicleArtworkPath(vehicle.index)];
      if (progress.discovered) paths.push(answerArtworkPath(vehicle.index, formStage));
      if (progress.masterMedal) paths.push(resultArtworkPath(vehicle.index, formStage, true));
      return paths.filter(Boolean).map((path) => preloadDecodedImage(path).catch(() => null));
    }));
  }
  function showFixedScreenWhenReady(screenId, extraPaths = [], onShown = null) {
    const requestId = ++visualRequestId;
    const runId = state.runId;
    const fixedBackgroundPath = screenId === "start-screen" ? startKeyVisualPath : screenId === "mode-select-screen" ? modeSelectPath : screenId === "result-screen" ? topBackgroundPath : null;
    const paths = fixedBackgroundPath ? [fixedBackgroundPath, ...extraPaths] : extraPaths;
    return Promise.all(paths.map(preloadDecodedImage)).then(async () => {
      if (requestId !== visualRequestId || runId !== state.runId) return false;
      if (screenId === "start-screen") {
        updateTopCollectionButton();
        await Promise.all([
          decodeImageElement($("start-title"), startKeyVisualPath),
          decodeImageElement($("top-start-button-image"), topStartButtonPath),
          decodeImageElement($("top-collection-button-image"), topCollectionAlreadyUsedToday() ? topCollectionUsedButtonPath : topCollectionButtonPath)
        ]);
      }
      if (screenId === "mode-select-screen") await decodeImageElement($("mode-select-image"), modeSelectPath);
      if (screenId === "result-screen") await decodeImageElement($("result-background"), topBackgroundPath);
      if (requestId !== visualRequestId || runId !== state.runId) return false;
      setNeutralBackground();
      if (screenId === "start-screen") updateTopCollectionButton();
      showScreen(screenId);
      if (onShown) onShown();
      return true;
    }).catch((error) => {
      console.error(`Fixed screen failed to load: ${screenId}`, error);
      if (requestId !== visualRequestId || runId !== state.runId) return false;
      setNeutralBackground();
      if (screenId === "start-screen") updateTopCollectionButton();
      showScreen(screenId);
      if (onShown) onShown();
      return true;
    });
  }
  function resetResultScrollPosition() {
    const resultScreen = $("result-screen");
    const reset = () => {
      resultScreen.scrollTop = 0;
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      window.scrollTo(0, 0);
    };
    reset();
    window.requestAnimationFrame(reset);
  }
  function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }
  function preloadImages() {
    [startKeyVisualPath, topBackgroundPath, topStartButtonPath, topCollectionButtonPath, topCollectionUsedButtonPath, modeSelectPath, discoveryBubblePath, "./assets/ui/reward_popup/reward_stage01_nakayoshi.webp"].forEach((path) => preloadDecodedImage(path).catch(() => {}));
    rewardBackplates.slice(1).forEach((file) => preloadDecodedImage(`./assets/ui/reward_popup/${file}`, "low").catch(() => {}));
    preloadNormalQuestionBackgrounds();
  }
  let lastStableAppScale = null;
  let scaleUpdateRequest = 0;
  const viewportDiagnosticsEnabled = new URLSearchParams(window.location.search).get("viewport-diagnostics") === "1";
  const viewportDiagnosticsStorageKey = "mq-001:viewport-diagnostics-v1";
  // B-line preview auto-deploy verification: no runtime behavior change.
  let viewportDiagnostics = [];
  function viewportSnapshot() {
    const visualViewport = window.visualViewport;
    const playStage = $("play-stage");
    const playStageRect = playStage?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      visualViewportWidth: visualViewport?.width ?? null,
      visualViewportHeight: visualViewport?.height ?? null,
      visualViewportScale: visualViewport?.scale ?? null,
      visualViewportOffsetLeft: visualViewport?.offsetLeft ?? null,
      visualViewportOffsetTop: visualViewport?.offsetTop ?? null,
      devicePixelRatio: window.devicePixelRatio,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      pageHidden: document.hidden,
      stageScale: getComputedStyle(playStage).getPropertyValue("--stage-scale").trim() || null,
      stageRect: playStageRect ? {
        x: playStageRect.x,
        y: playStageRect.y,
        width: playStageRect.width,
        height: playStageRect.height
      } : null
    };
  }
  function recordViewportDiagnostic(event, detail = {}) {
    if (!viewportDiagnosticsEnabled) return;
    const entry = { ts: new Date().toISOString(), event, ...detail, snapshot: viewportSnapshot() };
    viewportDiagnostics.push(entry);
    if (viewportDiagnostics.length > 120) viewportDiagnostics = viewportDiagnostics.slice(-120);
    try { localStorage.setItem(viewportDiagnosticsStorageKey, JSON.stringify(viewportDiagnostics)); } catch (_) {}
  }
  function setupViewportDiagnostics() {
    if (!viewportDiagnosticsEnabled) return;
    try {
      const stored = JSON.parse(localStorage.getItem(viewportDiagnosticsStorageKey) || "[]");
      if (Array.isArray(stored)) viewportDiagnostics = stored.slice(-120);
    } catch (_) {}
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "MQ-001 LOG";
    Object.assign(button.style, {
      position: "fixed",
      right: "8px",
      top: "8px",
      zIndex: "2147483647",
      fontSize: "12px",
      padding: "6px 8px",
      opacity: "0.85"
    });
    button.addEventListener("click", async () => {
      const text = JSON.stringify(viewportDiagnostics, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "LOG COPIED";
        window.setTimeout(() => { button.textContent = "MQ-001 LOG"; }, 1400);
      } catch (_) {
        window.prompt("MQ-001 viewport log", text);
      }
    });
    document.body.appendChild(button);
    recordViewportDiagnostic("diagnostics-enabled");
  }
  async function updateVersionLabelWithPreviewMetadata() {
    const versionLabel = $("app-version");
    versionLabel.textContent = `Version ${appVersion}`;
    versionLabel.classList.remove("is-preview");
    try {
      const response = await fetch("./preview-meta.json", { cache: "no-store" });
      if (!response.ok) return;
      const metadata = await response.json();
      if (metadata?.environment !== "preview") return;
      const identity = metadata.prNumber
        ? `Preview PR #${metadata.prNumber}`
        : `Preview ${metadata.branch || "branch"}`;
      const commit = metadata.shortCommit ? ` · ${metadata.shortCommit}` : "";
      versionLabel.replaceChildren();
      const releaseLine = document.createElement("span");
      releaseLine.className = "version-release-line";
      releaseLine.textContent = `Version ${appVersion}`;
      const previewLine = document.createElement("span");
      previewLine.className = "version-preview-line";
      previewLine.textContent = `${identity}${commit}`;
      versionLabel.append(releaseLine, previewLine);
      versionLabel.classList.add("is-preview");
    } catch (_) {
      // GitHub Pages / local builds do not generate preview metadata.
    }
  }
  function isNormalViewport(snapshot) {
    const viewportScale = snapshot.visualViewportScale;
    if (Number.isFinite(viewportScale) && Math.abs(viewportScale - 1) > 0.01) return false;
    const widthTolerance = Math.max(2, snapshot.clientWidth * 0.02);
    const heightTolerance = Math.max(2, snapshot.clientHeight * 0.02);
    return Math.abs(snapshot.innerWidth - snapshot.clientWidth) <= widthTolerance
      && Math.abs(snapshot.innerHeight - snapshot.clientHeight) <= heightTolerance;
  }
  function viewportIsStable(first, second) {
    return Math.abs(first.innerWidth - second.innerWidth) <= 1
      && Math.abs(first.innerHeight - second.innerHeight) <= 1
      && Math.abs(first.clientWidth - second.clientWidth) <= 1
      && Math.abs(first.clientHeight - second.clientHeight) <= 1
      && (!Number.isFinite(first.visualViewportScale)
        || !Number.isFinite(second.visualViewportScale)
        || Math.abs(first.visualViewportScale - second.visualViewportScale) <= 0.005);
  }
  function sizePlayStage(snapshot = viewportSnapshot()) {
    if (!isNormalViewport(snapshot)) {
      recordViewportDiagnostic("size-rejected-abnormal", { candidate: snapshot });
      return false;
    }
    const scale = Math.min(snapshot.innerWidth / 1448, snapshot.innerHeight / 1086);
    $("play-stage").style.setProperty("--stage-scale", String(scale));
    lastStableAppScale = scale;
    recordViewportDiagnostic("size-applied", { scale, candidate: snapshot });
    return true;
  }
  function schedulePlayStageSize(reason) {
    const requestId = ++scaleUpdateRequest;
    recordViewportDiagnostic("schedule", { reason, requestId });
    window.requestAnimationFrame(() => {
      const first = viewportSnapshot();
      window.requestAnimationFrame(() => {
        if (requestId !== scaleUpdateRequest) {
          recordViewportDiagnostic("schedule-cancelled", { reason, requestId, currentRequestId: scaleUpdateRequest, first });
          return;
        }
        const second = viewportSnapshot();
        if (!viewportIsStable(first, second)) {
          recordViewportDiagnostic("schedule-unstable", { reason, requestId, first, second });
          return;
        }
        recordViewportDiagnostic("schedule-stable", { reason, requestId, first, second });
        sizePlayStage(second);
      });
    });
  }
  function assignQuestionVisualContext(question) {
    if (question.vehicleIndex === undefined) question.vehicleIndex = state.currentVehicleIndex;
    question.answerStage = currentStageForVehicle(question.vehicleIndex);
  }
  function questionVisualSpec(question) {
    const stage = question.answerStage;
    const vehicle = vehicles[question.vehicleIndex];
    const progress = vehicleProgress(question.vehicleIndex);
    const backgroundPath = playBackgroundPath(question.vehicleIndex);
    const path = vehicle && progress.discovered ? answerArtworkPath(question.vehicleIndex, stage) : null;
    const bubbleSpec = progressSpeechBubbleSpec(question.vehicleIndex);
    const bubblePath = path && !question.isReview && !question.hintUsed && !question.answerRevealed && bubbleSpec?.stage === stage
      ? bubbleSpec.path : null;
    return { stage, vehicle, backgroundPath, path, bubblePath, discoveryBubblePath, hasDiscoveryMessage: Boolean(vehicle && !progress.discovered) };
  }
  function preloadQuestionVisuals(question) {
    const spec = questionVisualSpec(question);
    const paths = [spec.backgroundPath, spec.path, spec.bubblePath, spec.hasDiscoveryMessage ? spec.discoveryBubblePath : null].filter(Boolean);
    return Promise.all(paths.map(preloadDecodedImage)).then(() => spec);
  }
  function prepareStagedImage(element, path) {
    element.hidden = false;
    element.style.visibility = "hidden";
    return decodeImageElement(element, path);
  }
  function positionAnswerBubble(bubble, stage, character) {
    const position = answerBubblePositions[stage];
    if (!bubble || !position || !character) return;
    const characterLeft = Number.parseFloat(character.style.left);
    const characterWidth = Number.parseFloat(character.style.width);
    if (Number.isFinite(characterLeft) && Number.isFinite(characterWidth)) {
      bubble.style.left = `${characterLeft + characterWidth / 2 - position.width / 2}px`;
    }
    let top = position.top;
    if (stage >= 4) {
      const playStage = $("play-stage");
      const timer = $("elapsed-time");
      const stageRect = playStage?.getBoundingClientRect();
      const timerRect = timer?.getBoundingClientRect();
      const stageScale = stageRect?.width ? stageRect.width / 1448 : 0;
      if (stageRect && timerRect && stageScale) {
        top = (timerRect.top + timerRect.height / 2 - stageRect.top) / stageScale;
      }
    }
    if (Number.isFinite(top)) bubble.style.top = `${top}px`;
    bubble.style.width = `${position.width}px`;
  }

  function clearCharacterMotion(element) {
    element.classList.remove("is-vehicle-entering", "is-vehicle-exiting", "is-robot-entering", "is-robot-exiting");
  }
  function clearRobotDissolveSparkle() {
    const sparkle = $("robot-dissolve-sparkle");
    if (!sparkle) return;
    sparkle.classList.remove("is-entering", "is-exiting");
    sparkle.replaceChildren();
    sparkle.hidden = true;
  }
  function playRobotDissolveSparkle(character, direction) {
    const sparkle = $("robot-dissolve-sparkle"), stage = $("play-stage");
    if (!sparkle || !stage || character.hidden) return;
    const stageRect = stage.getBoundingClientRect(), characterRect = character.getBoundingClientRect();
    const scale = stageRect.width / 1448 || 1;
    if (!characterRect.width || !characterRect.height || !scale) return;
    sparkle.style.left = `${(characterRect.left - stageRect.left) / scale}px`;
    sparkle.style.top = `${(characterRect.top - stageRect.top) / scale}px`;
    sparkle.style.width = `${characterRect.width / scale}px`;
    sparkle.style.height = `${characterRect.height / scale}px`;
    sparkle.replaceChildren();
    // Dense but still restrained: roughly the same sparkle count as the
    // +3 / heart trail, scattered across the robot instead of marching in
    // a straight line. Entry rises from below; exit mirrors it downward.
    for (let index = 0; index < 78; index += 1) {
      const particle = document.createElement("i");
      const hash = (seed) => {
        const value = Math.sin((index + 1) * seed) * 43758.5453123;
        return value - Math.floor(value);
      };
      const x = -2 + hash(12.9898) * 104;
      const startY = direction === "enter"
        ? 60 + hash(78.233) * 38
        : -2 + hash(78.233) * 34;
      // Let the sparkle field visibly follow more of the robot's body:
      // entry rises from the feet toward just under the face, while exit
      // travels from the upper body down through roughly the knees.
      const travel = direction === "enter"
        ? 58 + hash(39.425) * 38
        : 50 + hash(39.425) * 34;
      const driftX = -18 + hash(91.117) * 36;
      const size = 5 + hash(51.913) * 12;
      const delay = hash(27.631) * (direction === "enter" ? 520 : 340);
      const duration = (direction === "enter" ? 680 : 560) + hash(63.719) * (direction === "enter" ? 520 : 380);
      particle.style.setProperty("--robot-spark-x", `${x.toFixed(1)}%`);
      particle.style.setProperty("--robot-spark-start-y", `${startY.toFixed(1)}%`);
      particle.style.setProperty("--robot-spark-travel", `${travel.toFixed(1)}%`);
      particle.style.setProperty("--robot-spark-drift-x", `${driftX.toFixed(1)}px`);
      particle.style.setProperty("--robot-spark-size", `${size.toFixed(1)}px`);
      particle.style.setProperty("--robot-spark-delay", `${delay.toFixed(0)}ms`);
      particle.style.setProperty("--robot-spark-duration", `${duration.toFixed(0)}ms`);
      sparkle.appendChild(particle);
    }
    sparkle.hidden = false;
    sparkle.classList.remove("is-entering", "is-exiting");
    void sparkle.offsetWidth;
    sparkle.classList.add(direction === "enter" ? "is-entering" : "is-exiting");
  }
  function waitForCharacterAnimation(element, className, fallbackDurationMs) {
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        element.removeEventListener("animationend", onAnimationEnd);
        window.clearTimeout(fallbackTimer);
        element.classList.remove(className);
        resolve();
      };
      const onAnimationEnd = (event) => {
        if (event.target === element) finish();
      };
      const fallbackTimer = window.setTimeout(finish, fallbackDurationMs);
      element.addEventListener("animationend", onAnimationEnd);
      element.classList.add(className);
    });
  }
  function playVehicleDust(character, phase) {
    const stage = $("play-stage");
    if (!stage || !character || character.hidden) return null;
    const stageRect = stage.getBoundingClientRect();
    const charRect = character.getBoundingClientRect();
    const scale = stageRect.width / 1448 || 1;
    const dust = document.createElement("div");
    dust.className = `vehicle-dust is-${phase}`;
    dust.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 7; index += 1) {
      const plume = document.createElement("i");
      plume.style.setProperty("--dust-index", String(index));
      dust.appendChild(plume);
    }
    const charLeft = (charRect.left - stageRect.left) / scale;
    const charWidth = charRect.width / scale;
    const charBottom = (charRect.bottom - stageRect.top) / scale;
    const dustWidth = Math.max(360, charWidth * 0.72);
    const dustTipX = charLeft + charWidth * 0.36;
    dust.style.left = `${dustTipX - dustWidth}px`;
    dust.style.top = `${charBottom - 182}px`;
    dust.style.width = `${dustWidth}px`;
    stage.appendChild(dust);
    window.setTimeout(() => dust.remove(), vehicleDustCleanupMs);
    return dust;
  }

  function currentCharacterNeedsExit(prepared) {
    const currentCharacter = $("answer-character");
    const stagedCharacter = $("answer-character-next");
    return Boolean(!currentCharacter.hidden && currentCharacter.src && (!prepared.hasCharacter || currentCharacter.src !== stagedCharacter.src));
  }
  async function playCurrentCharacterExit(prepared) {
    if (!currentCharacterNeedsExit(prepared)) return;
    const currentCharacter = $("answer-character");
    const currentBubble = $("answer-bubble");
    const currentStage = Number(currentCharacter.dataset.answerStage || 0);
    if (currentStage === 2) {
      playVehicleDust(currentCharacter, "exiting");
      await waitForCharacterAnimation(currentCharacter, "is-vehicle-exiting", 720);
    } else if (currentStage === 3) {
      playRobotDissolveSparkle(currentCharacter, "exit");
      await waitForCharacterAnimation(currentCharacter, "is-robot-exiting", 780);
      clearRobotDissolveSparkle();
    }
    // The old character must be completely gone before any background peel
    // begins. Stages without an exit animation disappear immediately here.
    currentCharacter.hidden = true;
    currentBubble.hidden = true;
  }
  async function playPreparedCharacterEntry(prepared, shouldAnimate) {
    if (!prepared.hasCharacter || !shouldAnimate) return;
    const character = $("answer-character");
    if (prepared.characterStage === 2) {
      playVehicleDust(character, "entering");
      await waitForCharacterAnimation(character, "is-vehicle-entering", 920);
    } else if (prepared.characterStage === 3) {
      playRobotDissolveSparkle(character, "enter");
      await waitForCharacterAnimation(character, "is-robot-entering", 1020);
      clearRobotDissolveSparkle();
    }
  }
  function prepareQuestionVisuals(question, allowFutureQuestion = false) {
    const stagedBackground = $("play-background-next"), stagedCharacter = $("answer-character-next"), stagedBubble = $("answer-bubble-next");
    const requestId = ++visualRequestId;
    return preloadQuestionVisuals(question).then(async ({ stage, vehicle, backgroundPath, path, bubblePath, discoveryBubblePath, hasDiscoveryMessage }) => {
      if (requestId !== visualRequestId || (!allowFutureQuestion && state.current !== question)) return false;
      const discoveryBubble = $("answer-discovery-bubble");
      const elementPrepares = [prepareStagedImage(stagedBackground, backgroundPath)];
      if (hasDiscoveryMessage) elementPrepares.push(prepareStagedImage(discoveryBubble, discoveryBubblePath));
      else discoveryBubble.hidden = true;
      if (!path || !vehicle) {
        await Promise.all(elementPrepares);
        if (requestId !== visualRequestId || (!allowFutureQuestion && state.current !== question)) return false;
        return { backgroundPath, hasCharacter: false, hasBubble: false, hasDiscoveryMessage };
      }
      const characterPath = path.startsWith("./") ? path : `./${path}`;
      // All current answer artwork uses the same 1254×1254 canvas. Use one
      // common scale and one common placement per evolution stage so no vehicle
      // receives a per-asset size/position adjustment. The artwork itself now
      // owns its internal framing.
      const sourceCanvasSize = 1254;
      const scale = answerArtCanvasScales[stage];
      const flip = stage <= 3;
      stagedCharacter.alt = `${vehicle.nameJa}の${["", "", "乗り物", "ロボット", "スーパーロボット", "装備付きスーパーロボット"][stage]}`;
      stagedCharacter.style.width = `${sourceCanvasSize * scale}px`;
      // Keep every stage on the same centre line: halfway between the play
      // stage's left edge and the existing keyboard area's left edge.
      const keypadLeft = Number.parseFloat(window.getComputedStyle(document.querySelector(".game-area")).left);
      const characterCenterX = (Number.isFinite(keypadLeft) ? keypadLeft / 2 : 380) + 100;
      stagedCharacter.style.left = `${characterCenterX - sourceCanvasSize * scale / 2}px`;
      stagedCharacter.style.top = `${968 - sourceCanvasSize * scale}px`;
      stagedCharacter.style.setProperty("--character-static-transform", flip ? "scaleX(-1)" : "none");
      stagedCharacter.style.transform = "var(--character-static-transform)";
      stagedCharacter.dataset.answerStage = String(stage);
      clearCharacterMotion(stagedCharacter);
      elementPrepares.push(prepareStagedImage(stagedCharacter, characterPath));
      if (bubblePath) {
        positionAnswerBubble(stagedBubble, stage, stagedCharacter);
        elementPrepares.push(prepareStagedImage(stagedBubble, bubblePath));
      } else stagedBubble.hidden = true;
      await Promise.all(elementPrepares);
      if (requestId !== visualRequestId || (!allowFutureQuestion && state.current !== question)) return false;
      return { backgroundPath, hasCharacter: true, characterStage: stage, hasBubble: Boolean(bubblePath), hasDiscoveryMessage: false };
    }).catch((error) => {
      console.error("Question visual failed to load", error);
      if (requestId !== visualRequestId || (!allowFutureQuestion && state.current !== question)) return false;
      // Retain the complete old visual rather than exposing a partial fallback on failure.
      return { preserveCurrent: true };
    });
  }
  function swapVisualLayerIds() {
    const character = $("answer-character"), stagedCharacter = $("answer-character-next");
    const bubble = $("answer-bubble"), stagedBubble = $("answer-bubble-next");
    character.id = "answer-character-next"; stagedCharacter.id = "answer-character";
    bubble.id = "answer-bubble-next"; stagedBubble.id = "answer-bubble";
    character.setAttribute("aria-hidden", "true"); stagedCharacter.removeAttribute("aria-hidden");
    bubble.setAttribute("aria-hidden", "true"); stagedBubble.removeAttribute("aria-hidden");
  }
  function swapBackgroundLayerIds() {
    const background = $("play-background"), stagedBackground = $("play-background-next");
    background.id = "play-background-next"; stagedBackground.id = "play-background";
    background.setAttribute("aria-hidden", "true"); stagedBackground.removeAttribute("aria-hidden");
  }
  function waitForElementAnimation(element, className, fallbackDurationMs) {
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        element.removeEventListener("animationend", onAnimationEnd);
        window.clearTimeout(fallbackTimer);
        element.classList.remove(className);
        resolve();
      };
      const onAnimationEnd = (event) => {
        if (event.target === element) finish();
      };
      const fallbackTimer = window.setTimeout(finish, fallbackDurationMs);
      element.addEventListener("animationend", onAnimationEnd);
      element.classList.remove(className);
      void element.offsetWidth;
      element.classList.add(className);
    });
  }
  async function transitionQuestionBackground(prepared) {
    if (prepared.preserveCurrent) return;
    const background = $("play-background"), stagedBackground = $("play-background-next");
    // A fixed/transition screen hides both play-background layers. If the
    // first retry happens to reuse the same image URL as the previous question,
    // URL equality alone must not skip the reveal or both layers remain hidden.
    const sameBackground = !background.hidden && background.src === stagedBackground.src;
    if (sameBackground) {
      stagedBackground.hidden = true;
      stagedBackground.style.visibility = "hidden";
      prepared.backgroundCommitted = true;
      return;
    }
    const hasOutgoingBackground = !background.hidden && Boolean(background.src);
    stagedBackground.style.visibility = "";
    stagedBackground.hidden = false;
    stagedBackground.style.zIndex = "1";
    background.style.zIndex = "0";
    if (hasOutgoingBackground) {
      // Reveal the next background from bottom-left to top-right. The CSS
      // polygon keeps the moving reveal boundary as one straight segment
      // throughout the animation.
      await waitForElementAnimation(stagedBackground, "is-page-peeling-in", 900);
    }
    swapBackgroundLayerIds();
    const outgoingBackground = $("play-background-next");
    const incomingBackground = $("play-background");
    outgoingBackground.hidden = true;
    outgoingBackground.style.visibility = "hidden";
    outgoingBackground.style.zIndex = "";
    incomingBackground.style.zIndex = "";
    prepared.backgroundCommitted = true;
  }
  function commitQuestionVisuals(prepared) {
    if (prepared.preserveCurrent) return;
    const discoveryBubble = $("answer-discovery-bubble");
    discoveryBubble.hidden = !prepared.hasDiscoveryMessage;
    if (prepared.hasDiscoveryMessage) discoveryBubble.style.visibility = "";
    const background = $("play-background"), stagedBackground = $("play-background-next");
    const character = $("answer-character"), stagedCharacter = $("answer-character-next");
    const bubble = $("answer-bubble"), stagedBubble = $("answer-bubble-next");
    if (!prepared.backgroundCommitted) {
      const sameBackground = !background.hidden && background.src === stagedBackground.src;
      if (sameBackground) {
        stagedBackground.hidden = true;
        stagedBackground.style.visibility = "hidden";
      } else {
        stagedBackground.style.visibility = "";
        stagedBackground.hidden = false;
        stagedBackground.style.zIndex = "1";
        background.style.zIndex = "0";
        swapBackgroundLayerIds();
        const outgoingBackground = $("play-background-next");
        window.requestAnimationFrame(() => {
          outgoingBackground.hidden = true;
          outgoingBackground.style.zIndex = "";
          $("play-background").style.zIndex = "";
        });
      }
    }
    if (!prepared.hasCharacter) {
      character.hidden = true; stagedCharacter.hidden = true;
      bubble.hidden = true; stagedBubble.hidden = true;
      return;
    }
    character.hidden = true;
    bubble.hidden = true;
    stagedCharacter.style.visibility = "";
    stagedCharacter.hidden = false;
    if (prepared.hasBubble) {
      stagedBubble.style.visibility = "";
      stagedBubble.hidden = false;
    } else stagedBubble.hidden = true;
    swapVisualLayerIds();
  }
  function raritiesForDraw(streak, afterStage5 = false) {
    if (streak <= 1) return ["normal"];
    if (streak === 2) return ["normal", "special"];
    if (streak === 3) return ["normal", "special", "rare"];
    if (streak === 4) return ["special", "rare"];
    return afterStage5 ? ["special", "rare", "super-rare"] : ["normal", "special", "rare"];
  }
  function candidatesForDraw(streak, afterStage5 = false, recentHistory = state.recentVehicleHistory, pool = vehicles, excludeCurrent = false) {
    const allowedRarities = new Set(raritiesForDraw(streak, afterStage5));
    const recent = [...recentHistory].slice(-3);
    let candidates = [];
    while (candidates.length === 0) {
      const excluded = new Set(recent);
      candidates = pool.filter((vehicle) => allowedRarities.has(vehicle.rarity) && !excluded.has(vehicle.index) && (!excludeCurrent || vehicle.index !== state.currentVehicleIndex));
      if (candidates.length === 0 && recent.length > 0) recent.shift();
      else break;
    }
    return candidates;
  }
  function chooseNextVehicle({ afterStage5 = false, excludeCurrent = false } = {}) {
    const candidates = candidatesForDraw(state.correctStreak, afterStage5, state.recentVehicleHistory, vehicles, excludeCurrent);
    const totalWeight = candidates.reduce((sum, vehicle) => sum + vehicle.weight, 0);
    let ticket = Math.random() * totalWeight;
    let selected = candidates[candidates.length - 1];
    for (const vehicle of candidates) {
      ticket -= vehicle.weight;
      if (ticket < 0) { selected = vehicle; break; }
    }
    state.currentVehicleIndex = selected.index;
    state.currentStage = currentStageForVehicle(selected.index);
    preloadVehicleVisuals(selected.index, state.currentStage);
    state.recentVehicleHistory.push(selected.index);
    state.recentVehicleHistory = state.recentVehicleHistory.slice(-3);
    saveRecentVehicles();
  }
  // A vehicle challenge is independent from its evolution stage.  Every new
  // challenge starts at question one and never inherits the previous count.
  function startNextVehicleChallenge({ afterStage5 = false } = {}) {
    chooseNextVehicle({ afterStage5, excludeCurrent: true });
    state.vehicleChallengeQuestionCount = 0;
  }
  function prepareInitialVehicle() {
    if (Number.isInteger(state.previewQaInitialVehicleIndex)) {
      state.currentVehicleIndex = state.previewQaInitialVehicleIndex;
      state.currentStage = currentStageForVehicle(state.currentVehicleIndex);
      state.preparedInitialVehicleIndex = state.currentVehicleIndex;
      state.previewQaInitialVehicleIndex = null;
      preloadVehicleVisuals(state.currentVehicleIndex, state.currentStage);
      return;
    }
    if (Number.isInteger(state.preparedInitialVehicleIndex)) return;
    state.currentVehicleIndex = -1;
    state.currentStage = 1;
    state.correctStreak = 0;
    chooseNextVehicle();
    state.vehicleChallengeQuestionCount = 0;
    state.preparedInitialVehicleIndex = state.currentVehicleIndex;
    preloadVehicleVisuals(state.preparedInitialVehicleIndex, state.currentStage);
  }

  function makeQuestions() {
    const result = [], keys = new Set();
    function add(dividend, divisor) {
      const key = `${dividend}/${divisor}`;
      if (keys.has(key)) return false;
      keys.add(key);
      result.push({ dividend, divisor, quotient: Math.floor(dividend / divisor), remainder: dividend % divisor,
        hintUsed: false, answerRevealed: false, assistedCorrect: false, resultType: null, isReview: false });
      return true;
    }
    function addRegularWithRemainder() {
      for (let tries = 0; tries < 500; tries += 1) {
        const divisor = 2 + Math.floor(Math.random() * 8);
        const quotient = 1 + Math.floor(Math.random() * 9);
        const remainder = 1 + Math.floor(Math.random() * (divisor - 1));
        const dividend = divisor * quotient + remainder;
        if (dividend >= 10 && dividend <= 99 && add(dividend, divisor)) return;
      }
    }
    function addSingleDigitQuotientNoRemainder() {
      for (let tries = 0; tries < 500; tries += 1) {
        const divisor = 2 + Math.floor(Math.random() * 8);
        const minQ = Math.ceil(10 / divisor);
        const quotient = minQ + Math.floor(Math.random() * (10 - minQ));
        if (add(divisor * quotient, divisor)) return;
      }
    }
    add(0, 1 + Math.floor(Math.random() * 9));
    const smallDividend = 1 + Math.floor(Math.random() * 8);
    add(smallDividend, smallDividend + 1 + Math.floor(Math.random() * (9 - smallDividend)));
    for (let i = 0; i < 6; i += 1) addRegularWithRemainder();
    addSingleDigitQuotientNoRemainder();
    add(...listedTwoDigitQuotientProblems[Math.floor(Math.random() * listedTwoDigitQuotientProblems.length)]);
    return shuffle(result);
  }

  function analyzeLongDivisionCandidate(dividend, divisor) {
    const digits = String(dividend).split("").map(Number);
    const quotient = Math.floor(dividend / divisor);
    const remainder = dividend % divisor;
    if (digits.length === 2) {
      const [a, b] = digits;
      const r1 = a % divisor;
      return { dividend, divisor, quotient, remainder, digits, quotientDigits:String(quotient).length, r1, r2:remainder, firstGroupRemainder:r1, carryCount:r1 !== 0 ? 1 : 0 };
    }
    const [a, b, c] = digits;
    const r1 = a % divisor;
    const x2 = r1 * 10 + b;
    const r2 = x2 % divisor;
    const x3 = r2 * 10 + c;
    const r3 = x3 % divisor;
    const firstPair = a * 10 + b;
    return { dividend, divisor, quotient, remainder, digits, quotientDigits:String(quotient).length, r1, r2, r3, x2, x3, firstPair, firstGroupRemainder:firstPair % divisor, carryCount:(r1 !== 0 ? 1 : 0) + (r2 !== 0 ? 1 : 0) };
  }
  function makeLongDivisionCandidatePools() {
    const candidates = [];
    for (let dividend = 10; dividend <= 999; dividend += 1) {
      for (let divisor = 2; divisor <= 9; divisor += 1) candidates.push(analyzeLongDivisionCandidate(dividend, divisor));
    }
    const [question1, question2, question3, question4, question5, question6, question7, question8, question9, question10] = [
      (q) => q.digits.length === 2 && q.quotientDigits === 2 && q.remainder === 0 && q.digits[1] !== 0 && q.r1 === 0,
      (q) => q.digits.length === 2 && q.quotientDigits === 1 && q.remainder !== 0 && q.digits[1] !== 0,
      (q) => q.digits.length === 2 && q.quotientDigits === 2 && q.remainder === 0 && q.digits[1] === 0,
      (q) => q.digits.length === 2 && q.quotientDigits === 2 && q.remainder !== 0 && q.digits[1] !== 0 && q.r1 !== 0,
      (q) => q.digits.length === 2 && q.quotientDigits === 2 && q.remainder !== 0 && q.digits[1] !== 0 && q.r1 !== 0,
      (q) => q.digits.length === 3 && q.quotientDigits === 3 && q.remainder === 0 && (q.r1 !== 0 || q.r2 !== 0),
      (q) => q.digits.length === 3 && q.quotientDigits === 2 && q.remainder === 0 && q.digits[2] === 0,
      (q) => q.digits.length === 3 && q.quotientDigits === 2 && q.remainder !== 0 && q.firstGroupRemainder !== 0,
      (q) => q.digits.length === 3 && q.quotientDigits === 3 && q.r1 !== 0 && q.r2 !== 0 && q.r3 === 0,
      (q) => q.digits.length === 3 && q.quotientDigits === 2 && q.digits[1] === 0 && q.remainder !== 0 && q.firstGroupRemainder !== 0
    ];
    return [question1, question2, question3, question4, question5, question6, question7, question8, question9, question10].map((matches) => candidates.filter(matches));
  }
  function chooseLongDivisionCandidate(pool, usedExpressions, excludedDivisor = null) {
    const available = pool.filter((candidate) => !usedExpressions.has(`${candidate.dividend}/${candidate.divisor}`) && candidate.divisor !== excludedDivisor);
    if (available.length === 0) throw new Error("No valid long-division candidate is available for this question.");
    const selected = available[Math.floor(Math.random() * available.length)];
    usedExpressions.add(`${selected.dividend}/${selected.divisor}`);
    return selected;
  }
  function makeLongDivisionQuestions() {
    const pools = makeLongDivisionCandidatePools();
    const usedExpressions = new Set();
    const selected = [];
    pools.forEach((pool, index) => selected.push(chooseLongDivisionCandidate(pool, usedExpressions, index === 4 ? selected[3].divisor : null)));
    return selected.map(({ dividend, divisor, quotient, remainder }) => ({ dividend, divisor, quotient, remainder,
      hintUsed:false, answerRevealed:false, assistedCorrect:false, resultType:null, isReview:false }));
  }

  function makeNumberCardQuestions() {
    const ranges = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10];
    const layouts = ["two-across", "three-across", "two-by-two", "dice-five", "two-two-two", "two-three-two", "three-two-three", "three-by-three", "three-four-three", "three-four-three"];
    return ranges.map((range, index) => ({
      kind:"numbercards", id:`number-card-${index + 1}`, range, layout:layouts[index], progressGain:1,
      hintUsed:false, answerRevealed:false, assistedCorrect:false, resultType:null, isReview:false
    }));
  }
  function makeCountingQuestions(maxValue = 10) {
    let values = [];
    if (maxValue === 5) {
      const baseValues = [...Array.from({ length: 5 }, (_, index) => index + 1), ...Array.from({ length: 5 }, (_, index) => index + 1)];
      for (let attempt = 0; attempt < 1000; attempt += 1) {
        values = [...baseValues];
        for (let index = values.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(Math.random() * (index + 1));
          [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
        }
        const startsEasy = values[0] <= 3 && values[1] <= 3;
        const hasAdjacentRepeat = values.some((value, index) => index > 0 && value === values[index - 1]);
        if (startsEasy && !hasAdjacentRepeat) break;
      }
    } else {
      const easyValues = Array.from({ length: 5 }, (_, index) => index + 1);
      for (let index = easyValues.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [easyValues[index], easyValues[swapIndex]] = [easyValues[swapIndex], easyValues[index]];
      }
      const firstThree = easyValues.slice(0, 3);
      const remaining = Array.from({ length: 10 }, (_, index) => index + 1).filter((value) => !firstThree.includes(value));
      for (let index = remaining.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
      }
      values = [...firstThree, ...remaining];
    }
    return values.map((value, index) => ({ kind: "counting", id: `counting-${maxValue}-${index + 1}-${value}`, value, quotient: value, remainder: 0 }));
  }

  function makeMultiplicationQuestions() {
    const digitCounts = [2, 2, 2, 2, 2, 3, 3, 3, 4, 4];
    const usedExpressions = new Set();
    let previousMultiplier = null;
    return digitCounts.map((digits, index) => {
      const minimum = 10 ** (digits - 1);
      const maximum = 10 ** digits - 1;
      let multiplicand, multiplier, key;
      for (let attempt = 0; attempt < 1000; attempt += 1) {
        multiplicand = minimum + Math.floor(Math.random() * (maximum - minimum + 1));
        multiplier = 2 + Math.floor(Math.random() * 8);
        key = `${multiplicand}*${multiplier}`;
        if (multiplier !== previousMultiplier && !usedExpressions.has(key)) break;
      }
      if (multiplier === previousMultiplier || usedExpressions.has(key)) throw new Error("No valid multiplication problem is available.");
      usedExpressions.add(key);
      previousMultiplier = multiplier;
      const product = multiplicand * multiplier;
      return {
        kind: "multiplication", id: `multiplication-${index + 1}`,
        multiplicand, multiplier, product, quotient: product, remainder: 0,
        hintUsed: false, answerRevealed: false, assistedCorrect: false, resultType: null, isReview: false
      };
    });
  }

  function makeTwoDigitMultiplicationQuestions() {
    const values = [];
    const multiplierValues = [];
    for (let tens = 1; tens <= 5; tens += 1) {
      for (let ones = 0; ones <= 5; ones += 1) values.push(tens * 10 + ones);
      for (let ones = 1; ones <= 5; ones += 1) multiplierValues.push(tens * 10 + ones);
    }
    const pairs = [];
    const used = new Set();
    while (pairs.length < 10) {
      const multiplicand = values[Math.floor(Math.random() * values.length)];
      const multiplier = multiplierValues[Math.floor(Math.random() * multiplierValues.length)];
      const key = `${multiplicand}*${multiplier}`;
      if (used.has(key)) continue;
      used.add(key);
      const onesMultiplier = multiplier % 10;
      const tensMultiplier = Math.floor(multiplier / 10);
      const partial1 = multiplicand * onesMultiplier;
      const partial2 = multiplicand * tensMultiplier;
      const product = multiplicand * multiplier;
      pairs.push({
        kind: "multiplication2x2", id: `multiplication2x2-${pairs.length + 1}-${key}`,
        multiplicand, multiplier, partial1, partial2, product, quotient: product, remainder: 0,
        hintUsed: false, answerRevealed: false, assistedCorrect: false, resultType: null, isReview: false
      });
    }
    return pairs;
  }

  function setGameMode(mode) {
    const isLongDivision = mode === "longdivision";
    const isNumberCards = mode === "numbercards";
    const isMultiplication = mode === "multiplication";
    const isMultiplication2x2 = mode === "multiplication2x2";
    const isCounting = mode === "counting1" || mode === "counting2";
    state.mode = isLongDivision ? "longdivision" : isNumberCards ? "numbercards" : isMultiplication ? "multiplication" : isMultiplication2x2 ? "multiplication2x2" : isCounting ? mode : "normal";
    state.longDivision = null;
    state.numberCards = null;
    state.counting = null;
    state.multiplication = null;
    state.multiplication2x2 = null;
    state.inputMode = "quotient";
    state.quotientInput = "";
    state.remainderInput = "";
    $("long-division-panel").hidden = !isLongDivision;
    $("long-division-panel").classList.remove("is-assisted");
    $("long-division-slots").replaceChildren();
    $("long-division-divisor").textContent = "";
    $("long-division-dividend").replaceChildren();
    $("long-division-remainder-slot").textContent = "";
    $("long-division-panel").style.removeProperty("--long-division-line-width");
    $("number-card-panel").hidden = !isNumberCards;
    $("number-card-grid").hidden = !isNumberCards;
    $("number-card-grid").replaceChildren();
    $("counting-panel").hidden = !isCounting;
    $("counting-dots").replaceChildren();
    $("counting-keypad-grid").hidden = !isCounting;
    $("multiplication-panel").hidden = !isMultiplication;
    $("multiplication-2x2-panel").hidden = !isMultiplication2x2;
    $("multiplication-2x2-multiplicand").replaceChildren();
    $("multiplication-2x2-multiplier").replaceChildren();
    $("multiplication-2x2-partial-1").replaceChildren();
    $("multiplication-2x2-partial-2").replaceChildren();
    $("multiplication-2x2-total").replaceChildren();
    $("multiplication-multiplicand").replaceChildren();
    $("multiplication-multiplier").replaceChildren();
    $("multiplication-answer-row").replaceChildren();
    ["--multiplication-grid-columns", "--multiplication-multiplicand-start", "--multiplication-operator-column", "--multiplication-answer-start", "--multiplication-answer-slots"].forEach((property) => {
      $("multiplication-panel").style.removeProperty(property);
    });
    $("question-answer-card").classList.toggle("long-division-mode", isLongDivision);
    $("question-answer-card").classList.toggle("number-card-mode", isNumberCards);
    $("question-answer-card").classList.toggle("multiplication-mode", isMultiplication);
    $("question-answer-card").classList.toggle("multiplication-2x2-mode", isMultiplication2x2);
    $("question-answer-card").classList.toggle("counting-mode", isCounting);
    $("question-answer-card").classList.toggle("counting1-mode", mode === "counting1");
    $("keypad").classList.toggle("long-division-mode", isLongDivision);
    $("keypad").classList.toggle("number-card-mode", isNumberCards);
    $("keypad").classList.toggle("multiplication-mode", isMultiplication);
    $("keypad").classList.toggle("multiplication-2x2-mode", isMultiplication2x2);
    $("keypad").classList.toggle("counting-mode", isCounting);
    $("keypad").classList.toggle("counting1-mode", mode === "counting1");
    $("long-division-skip-key").disabled = !isLongDivision;
  }
  function resetAnswerCard() {
    $("question-answer-card").className = "question-answer-card";
    $("answer-card").className = "answer-card";
    $("answer-text").textContent = "";
    setGameMode(state.mode);
    setKeypadDisabled(false);
    updateAssistButton();
  }
  function setQuestionCardState(kind = "") {
    $("question-answer-card").className = `question-answer-card${kind ? ` ${kind}` : ""}${state.mode === "longdivision" ? " long-division-mode" : ""}${state.mode === "numbercards" ? " number-card-mode" : ""}${state.mode === "multiplication" ? " multiplication-mode" : ""}${state.mode === "multiplication2x2" ? " multiplication-2x2-mode" : ""}${(state.mode === "counting1" || state.mode === "counting2") ? " counting-mode" : ""}${state.mode === "counting1" ? " counting1-mode" : ""}`;
  }
  function setProgress() {
    const isRetry = state.phase === "retry";
    const number = isRetry ? state.retrySetPosition : state.initialIndex + 1;
    const total = isRetry ? state.retrySetTotal : 10;
    $("progress-mode").hidden = !isRetry;
    $("progress-badge").classList.toggle("is-retry", isRetry);
    $("progress-count").textContent = `${Math.min(number, total)} / ${total}`;
  }
  let gameplayFontsReadyPromise = null;
  function ensureGameplayFontsReady() {
    if (gameplayFontsReadyPromise) return gameplayFontsReadyPromise;
    if (!document.fonts?.load) return Promise.resolve();
    gameplayFontsReadyPromise = Promise.all([
      document.fonts.load('400 88px "Noto Sans JP"'),
      document.fonts.load('700 76px "Noto Sans JP"'),
      document.fonts.load('900 102px "Noto Sans JP"')
    ]).catch((error) => {
      console.warn("Gameplay font preload failed", error);
    });
    return gameplayFontsReadyPromise;
  }
  ensureGameplayFontsReady();

  function displayQuestion(question, onRevealed = null) {
    clearIdleGuide();
    state.energyDisplayOverride = null;
    clearRobotDissolveSparkle();
    state.current = question; state.confirmingAnswer = false;
    question.hintUsed = Boolean(question.hintUsed); question.answerRevealed = Boolean(question.answerRevealed);
    question.hadWrong = Boolean(question.hadWrong); question.progressPenalty = Boolean(question.progressPenalty);
    question.assistedCorrect = Boolean(question.assistedCorrect);
    question.resultType = question.resultType || null;
    question.isReview = state.phase === "retry";
    // Bind an initial-round question to a vehicle only when it is actually
    // about to be displayed.  This prevents speculative preloads from
    // consuming a challenge slot or leaving a question on the old vehicle.
    if (state.phase === "initial" && question.vehicleChallengePosition === undefined) {
      if (question.vehicleIndex === undefined) question.vehicleIndex = state.currentVehicleIndex;
      state.vehicleChallengeQuestionCount += 1;
      question.vehicleChallengePosition = state.vehicleChallengeQuestionCount;
    }
    assignQuestionVisualContext(question);
    preloadPotentialReward(question);
    const cachedVisual = state.preparedNextQuestionVisual;
    state.preparedNextQuestionVisual = null;
    const preparedVisualReady = cachedVisual && cachedVisual.question === question
      ? Promise.resolve(cachedVisual.prepared)
      : prepareQuestionVisuals(question);
    // Do not reveal the play screen while the tablet/browser is still swapping
    // from its fallback font to Noto Sans JP. This keeps problem digits and
    // number-card instructions visually stable from their first painted frame.
    const visualsReady = Promise.all([preparedVisualReady, ensureGameplayFontsReady()])
      .then(([prepared]) => prepared);
    const runId = state.runId;
    visualsReady.then(async (prepared) => {
      if (!prepared || runId !== state.runId || state.current !== question) return;
      // Keep the old complete scene in place while a vehicle drives away or a
      // robot dissolves.  The next scene has already been decoded by
      // prepareQuestionVisuals, so commitQuestionVisuals can remain atomic.
      const shouldAnimateCharacter = Boolean(prepared.hasCharacter && (currentCharacterNeedsExit(prepared) || $("answer-character").hidden));
      await playCurrentCharacterExit(prepared);
      if (runId !== state.runId || state.current !== question) return;
      await transitionQuestionBackground(prepared);
      if (runId !== state.runId || state.current !== question) return;
      $("problem-card").textContent = question.kind === "numbercards" || question.kind === "multiplication" || question.kind === "multiplication2x2" || question.kind === "counting" ? "" : `${question.dividend} ÷ ${question.divisor}`;
      resetAnswerCard(); setProgress();
      if (state.mode === "longdivision") setupLongDivision(question);
      if (state.mode === "numbercards") setupNumberCards(question);
      if (state.mode === "multiplication") setupMultiplication(question);
      if (state.mode === "multiplication2x2") setupTwoDigitMultiplication(question);
      if ((state.mode === "counting1" || state.mode === "counting2")) setupCounting(question);
      commitQuestionVisuals(prepared);
      renderVehicleProgressUi(question.vehicleIndex);
      $("incorrect-next-vehicle-notice").hidden = true;
      if (state.pendingNextVehicleOverlay) {
        state.pendingNextVehicleOverlay.hidden = true;
        state.pendingNextVehicleOverlay = null;
      }
      showScreen("play-screen");
      // Only the two early collection forms receive new character motion.
      // Super-robot and equipped-super-robot retain their existing static
      // presentation, including their final size and position.
      await playPreparedCharacterEntry(prepared, shouldAnimateCharacter);
      if (runId !== state.runId || state.current !== question) return;
      if (onRevealed) onRevealed();
      startQuestionTimeout();
      state.transitioning = false;
      if (state.phase === "initial" || state.phase === "retry") startBackgroundMusic();
      // Start the per-question bonus clock only after the rendered question is
      // visible and the answer controls have been unlocked.
      question.timeBonusStartedAt = performance.now();
      // Number cards are initially rendered while the next-question transition is
      // locked. Reflect the unlock immediately, independently of hint rendering.
      if (state.mode === "numbercards") renderNumberCards();
      if ((state.mode === "counting1" || state.mode === "counting2")) renderCounting();
      updateAssistButton();
      resumeGameTimer();
      resetIdleGuideTimer();
    });
  }
  function beginRound(mode = state.mode || "normal") {
    clearRetryAutoStartTimer(); clearIdleGuide();
    stopCollectionTimer();
    if (state.pendingNextVehicleOverlay) state.pendingNextVehicleOverlay.hidden = true;
    state.pendingNextVehicleOverlay = null;
    state.preparedNextQuestionVisual = null;
    setGameMode(mode); state.runId += 1; state.questions = state.mode === "longdivision" ? makeLongDivisionQuestions() : state.mode === "numbercards" ? makeNumberCardQuestions() : state.mode === "multiplication" ? makeMultiplicationQuestions() : state.mode === "multiplication2x2" ? makeTwoDigitMultiplicationQuestions() : state.mode === "counting1" ? makeCountingQuestions(5) : state.mode === "counting2" ? makeCountingQuestions(10) : makeQuestions(); state.queue = []; state.phase = "initial";
    state.initialIndex = 0; state.initialCorrect = 0; state.missed = []; state.retrySetPosition = 0; state.retrySetTotal = 0; state.vehicleChallengeQuestionCount = 0;
    state.finalElapsedMs = 0; state.confirmingAnswer = false;
    state.sessionUnlocks = [0, 0, 0, 0, 0, 0];
    // A display-only baseline for the result screen. It never feeds back into
    // reward decisions or persisted progress.
    state.resultStartProgress = state.rewardProgress.map((progress) => ({ ...progress }));
    state.sessionResultGets = [];
    state.collectionNewVehicleIndexes = new Set();
    state.collectionUsed = false;
    const preparedVehicleIndex = state.preparedInitialVehicleIndex;
    state.currentVehicleIndex = -1; state.correctStreak = 0;
    if (Number.isInteger(preparedVehicleIndex)) {
      state.currentVehicleIndex = preparedVehicleIndex;
      state.currentStage = currentStageForVehicle(preparedVehicleIndex);
      state.preparedInitialVehicleIndex = null;
    } else chooseNextVehicle();
    state.startedAt = 0; state.timerPaused = false; state.timerPausedAt = 0; state.pausedTimerMs = 0; state.transitioning = true;
    displayQuestion(state.questions[0], () => {
      state.startedAt = performance.now();
      startTimer();
    });
  }
  function openModeSelect() { showFixedScreenWhenReady("mode-select-screen"); }
  function startGameFromGesture(mode) { primeBackgroundMusicFromGesture(); playStartSound(); audioContext(); preloadCorrectSounds(); beginRound(mode); }
  function startApp() { startGameFromGesture("normal"); }
  function startLongDivisionApp() { startGameFromGesture("longdivision"); }
  function startNumberCardApp() { startGameFromGesture("numbercards"); }
  function startMultiplicationApp() { startGameFromGesture("multiplication"); }
  function startTwoDigitMultiplicationApp() { startGameFromGesture("multiplication2x2"); }
  function startCounting1App() { startGameFromGesture("counting1"); }
  function startCounting2App() { startGameFromGesture("counting2"); }
  function formatAnswer(answer) { return answer.usedRemainder ? `${answer.quotient}…${answer.remainder}` : String(answer.quotient); }
  function setKeypadDisabled(disabled) { $("keypad").setAttribute("aria-busy", disabled ? "true" : "false"); }
  function updateAssistButton() {
    if (state.mode === "numbercards" || (state.mode === "counting1" || state.mode === "counting2")) {
      $("assist-button").textContent = "ヒントを見る";
      $("assist-button").classList.remove("is-answer");
      $("assist-button").disabled = state.transitioning || state.confirmingAnswer;
      return;
    }
    if (state.mode === "multiplication2x2") {
      const model = state.multiplication2x2;
      const showAnswer = Boolean(model && model.inputStep >= model.inputOrder.length);
      $("assist-button").textContent = showAnswer ? "答えを見る" : "ヒントを見る";
      $("assist-button").classList.toggle("is-answer", showAnswer);
      $("assist-button").disabled = state.transitioning || state.confirmingAnswer;
      return;
    }
    if (state.mode === "multiplication") {
      const model = state.multiplication;
      const showAnswer = Boolean(model && model.hintableIndexes?.every((index) => model.cells[index]));
      $("assist-button").textContent = showAnswer ? "答えを見る" : "ヒントを見る";
      $("assist-button").classList.toggle("is-answer", showAnswer);
      $("assist-button").disabled = state.transitioning || state.confirmingAnswer;
      return;
    }
    const showingAnswer = Boolean(state.current && state.current.hintUsed);
    $("assist-button").textContent = showingAnswer ? "答えを見る" : "ヒントを見る";
    $("assist-button").classList.toggle("is-answer", showingAnswer);
    $("assist-button").disabled = state.transitioning || state.confirmingAnswer;
  }
  function renderInput() {
    if ((state.mode === "counting1" || state.mode === "counting2")) return;
    if (state.mode === "numbercards") { renderNumberCards(); return; }
    if (state.mode === "multiplication") { renderMultiplication(); return; }
    if (state.mode === "multiplication2x2") { renderTwoDigitMultiplication(); return; }
    if (state.mode === "longdivision") { renderLongDivision(); return; }
    if (!state.quotientInput) { $("answer-text").textContent = ""; return; }
    $("answer-text").textContent = state.inputMode === "remainder" ? `${state.quotientInput}…${state.remainderInput || "_"}` : state.quotientInput;
  }
  function setupCounting(question) {
    $("counting-panel").hidden = false;
    state.counting = { hinted: false };
    $("counting-dots").replaceChildren(...Array.from({ length: question.value }, () => {
      const dot = document.createElement("span");
      dot.className = "counting-dot";
      dot.setAttribute("aria-hidden", "true");
      return dot;
    }));
    $("counting-keypad-grid").hidden = false;
    renderCounting();
  }
  function renderCounting() {
    const model = state.counting; if (!model || !state.current) return;
    $("counting-keypad-grid").querySelectorAll(".counting-key").forEach((key) => {
      const number = Number(key.dataset.countingNumber);
      key.classList.toggle("is-hinted", model.hinted && number === state.current.value);
      key.disabled = state.transitioning;
    });
  }
  function inputCountingAnswer(value) {
    if (state.transitioning || !state.current) return;
    noteQuestionActivity();
    if (value === state.current.value) {
      judge({ quotient: value, remainder: 0, usedRemainder: false });
      return;
    }
    state.transitioning = true;
    state.current.resultType = "self_wrong";
    state.current.hadWrong = true;
    setQuestionCardState("wrong");
    playWrongSound();
    const runId = state.runId;
    window.setTimeout(() => {
      if (runId !== state.runId || !state.current) return;
      setQuestionCardState(); state.transitioning = false; renderCounting(); resetIdleGuideTimer();
    }, wrongFeedbackDurationMs);
  }
  function setupLongDivision(question) {
    const slots = String(question.dividend).length;
    state.longDivision = { slots, cells:Array(slots).fill(""), history:[], phase:"quotient", quotientDigits:0, remainderUnused:false };
    $("long-division-divisor").textContent = question.divisor;
    const holder = $("long-division-slots");
    holder.replaceChildren(...Array.from({ length:slots }, () => {
      const cell = document.createElement("span");
      cell.className = "long-division-slot";
      return cell;
    }));
    const dividend = $("long-division-dividend");
    dividend.replaceChildren(...String(question.dividend).split("").map((digit) => {
      const cell = document.createElement("span");
      cell.className = "long-division-digit";
      cell.textContent = digit;
      return cell;
    }));
    $("long-division-panel").style.setProperty("--long-division-line-width", `${54 + slots * 64 + (slots - 1) * 13 + 10}px`);
    renderLongDivision();
  }
  function numberCardPlacements(layout, range) {
    if (layout === "two-across") return [[1, 1], [1, 2]];
    if (layout === "three-across") return [[1, 1], [1, 2], [1, 3]];
    if (layout === "one-column") return Array.from({length:range}, (_, index) => [index + 1, 1]);
    if (layout === "two-by-two") return [[1, 1], [1, 2], [2, 1], [2, 2]];
    if (layout === "dice-five") return [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]];
    if (layout === "two-two-two") return [[1, 1], [1, 2], [2, 1], [2, 2], [3, 1], [3, 2]];
    if (layout === "two-three-two") return [[1, 1], [1, 3], [2, 1], [2, 2], [2, 3], [3, 1], [3, 3]];
    if (layout === "three-two-three") return [[1, 1], [1, 2], [1, 3], [2, 1], [2, 3], [3, 1], [3, 2], [3, 3]];
    if (layout === "three-by-three") return Array.from({length:range}, (_, index) => [Math.floor(index / 3) + 1, index % 3 + 1]);
    return [[1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3], [2, 4], [3, 2], [3, 3], [3, 4]];
  }
  function numberCardGridShape(layout) {
    if (layout === "two-across") return [2, 1];
    if (layout === "three-across") return [3, 1];
    if (layout === "one-column") return [1, 3];
    if (layout === "two-by-two") return [2, 2];
    if (layout === "two-two-two") return [2, 3];
    if (layout === "dice-five" || layout === "two-three-two" || layout === "three-two-three" || layout === "three-by-three") return [3, 3];
    return [4, 3];
  }
  function setupNumberCards(question) {
    const cards = shuffle(Array.from({length:question.range}, (_, index) => index + 1));
    state.numberCards = { range:question.range, layout:question.layout, cards, nextNumber:1, lastCorrectNumber:null, hinted:false, wrongNumber:null };
    const [columns, rows] = numberCardGridShape(question.layout);
    const grid = $("number-card-grid");
    grid.dataset.layout = question.layout;
    grid.style.setProperty("--number-card-columns", columns);
    grid.style.setProperty("--number-card-rows", rows);
    const placements = numberCardPlacements(question.layout, question.range);
    grid.replaceChildren(...cards.map((number, index) => {
      const card = document.createElement("button");
      card.className = "number-card";
      card.type = "button";
      card.dataset.number = String(number);
      const [row, column] = placements[index];
      card.style.gridRowStart = String(row);
      card.style.gridColumnStart = String(column);
      card.textContent = String(number);
      card.setAttribute("aria-label", `${number}`);
      card.addEventListener("click", () => chooseNumberCard(number));
      return card;
    }));
    renderNumberCards();
    speakNumberCardInstruction();
  }
  function renderNumberCards() {
    const model = state.numberCards; if (!model) return;
    $("number-card-grid").querySelectorAll(".number-card").forEach((card) => {
      const number = Number(card.dataset.number);
      const correct = number < model.nextNumber;
      card.classList.toggle("is-correct", correct);
      card.classList.toggle("is-last-correct", correct && number === model.lastCorrectNumber);
      card.classList.toggle("is-hinted", model.hinted && number === model.nextNumber);
      card.classList.toggle("is-wrong", number === model.wrongNumber);
      card.disabled = correct || state.transitioning || number === model.wrongNumber;
    });
  }
  function speakNumberCardInstruction() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("1から じゅんばんに おしてね！");
    utterance.lang = "ja-JP"; utterance.rate = .88;
    window.speechSynthesis.speak(utterance);
  }
  function chooseNumberCard(number) {
    const model = state.numberCards;
    if (!model || state.transitioning || number < model.nextNumber) return;
    noteQuestionActivity();
    if (number !== model.nextNumber) {
      state.current.hadWrong = true;
      playWrongSound();
      model.wrongNumber = number;
      renderNumberCards();
      window.setTimeout(() => {
        if (state.numberCards !== model || model.wrongNumber !== number) return;
        model.wrongNumber = null;
        renderNumberCards();
      }, 500);
      return;
    }
    playNumberCardCorrectSound();
    model.hinted = false;
    model.lastCorrectNumber = number;
    model.nextNumber += 1;
    renderNumberCards();
    if (model.nextNumber > model.range) completeNumberCardQuestion();
  }
  function completeNumberCardQuestion() {
    if (state.transitioning || !state.current) return;
    state.transitioning = true; stopQuestionTimeout(); setKeypadDisabled(true); renderNumberCards();
    setQuestionCardState("correct");
    const assistedCorrect = state.phase === "initial" && state.current.hintUsed;
    let reward = null;
    state.current.resultType = assistedCorrect ? "hint_correct" : "self_correct";
    if (state.phase === "initial") {
      if (!assistedCorrect) {
        state.initialCorrect += 1;
        if (state.current.hadWrong) state.correctStreak = 0;
        else state.correctStreak += 1;
      }
      const progression = progressCollectionForCorrect(state.current);
      reward = progression.reward;
      if (progression.friendshipGain) playProgressGainAnimation({ kind: "friendship" });
      else if (progression.energyGain) playProgressGainAnimation({ kind: "energy", amount: progression.energyGain, completed: Boolean(reward) });
    }
    if (reward && reward.stage < 5) preloadRewardVisuals(reward.stage, reward.vehicleIndex, reward.kind).catch(() => {});
    if (reward?.isNew || reward?.replay) playCorrectSound();
    const runId = state.runId;
    window.setTimeout(() => {
      if (runId !== state.runId) return;
      runAnswerTransition(() => {
        if (state.phase === "initial") finishInitialQuestion({ reward, challengeEnds: challengeMustEndAfterCorrect(state.current, reward) });
        else advance();
      });
    }, Math.max(correctFeedbackDurationMs, progressGainTotalDurationMs));
  }

  function makeMultiplicationDigits(holder, value) {
    holder.replaceChildren(...String(value).split("").map((digit) => {
      const cell = document.createElement("span");
      cell.className = "multiplication-problem-digit";
      cell.textContent = digit;
      return cell;
    }));
  }
  function multiplicationInputOrder(multiplicand, product) {
    const factorDigits = String(multiplicand).length;
    const productDigits = String(product).length;
    const lowerPlaceCount = Math.min(factorDigits - 1, productDigits - 1);
    const order = [];
    for (let index = productDigits - 1; index >= productDigits - lowerPlaceCount; index -= 1) order.push(index);
    for (let index = 0; index < productDigits - lowerPlaceCount; index += 1) order.push(index);
    return order;
  }
  function setupMultiplication(question) {
    const answerSlots = String(question.product).length;
    const multiplicandDigits = String(question.multiplicand).length;
    const gridColumns = Math.max(answerSlots, multiplicandDigits + 1);
    const multiplicandStart = gridColumns - multiplicandDigits + 1;
    const operatorColumn = multiplicandStart - 1;
    const answerStart = gridColumns - answerSlots + 1;
    const inputOrder = multiplicationInputOrder(question.multiplicand, question.product);
    const lowerPlaceCount = Math.min(multiplicandDigits - 1, answerSlots - 1);
    state.multiplication = {
      answerSlots, cells: Array(answerSlots).fill(""), history: [],
      inputOrder, inputStep: 0, hinted: false, hintedIndexes: new Set(),
      // Lower-place digits are disclosed in the same order as written input.
      // The final multiplication's one or two leading digits remain hidden.
      hintableIndexes: inputOrder.slice(0, lowerPlaceCount)
    };
    makeMultiplicationDigits($("multiplication-multiplicand"), question.multiplicand);
    makeMultiplicationDigits($("multiplication-multiplier"), question.multiplier);
    const panel = $("multiplication-panel");
    panel.style.setProperty("--multiplication-grid-columns", gridColumns);
    panel.style.setProperty("--multiplication-multiplicand-start", multiplicandStart);
    panel.style.setProperty("--multiplication-operator-column", operatorColumn);
    panel.style.setProperty("--multiplication-answer-start", answerStart);
    panel.style.setProperty("--multiplication-answer-slots", answerSlots);
    $("multiplication-answer-row").replaceChildren(...Array.from({ length: answerSlots }, () => {
      const slot = document.createElement("span");
      slot.className = "multiplication-answer-slot";
      return slot;
    }));
    renderMultiplication();
  }
  function renderMultiplication() {
    const model = state.multiplication; if (!model) return;
    model.cells.forEach((value, index) => {
      const slot = $("multiplication-answer-row").children[index];
      if (!slot) return;
      slot.textContent = value;
      const activeIndex = model.inputOrder[model.inputStep];
      slot.classList.toggle("is-active", index === activeIndex);
      slot.classList.toggle("is-hinted", model.hintedIndexes.has(index));
    });
  }
  function advanceMultiplicationInputStep(model) {
    while (model.inputStep < model.inputOrder.length && model.cells[model.inputOrder[model.inputStep]]) model.inputStep += 1;
  }
  function inputMultiplicationNumber(number) {
    const model = state.multiplication;
    if (!model || model.inputStep >= model.inputOrder.length) return;
    noteQuestionActivity();
    const index = model.inputOrder[model.inputStep];
    model.cells[index] = String(number);
    model.history.push(index);
    model.inputStep += 1;
    advanceMultiplicationInputStep(model);
    model.hinted = false;
    renderMultiplication();
    if (model.inputStep >= model.inputOrder.length) {
      judge({ quotient: Number(model.cells.join("")), remainder: 0, usedRemainder: false });
    }
  }
  function clearMultiplicationInput() {
    const model = state.multiplication;
    if (!model || !model.history.length) return;
    const index = model.history.pop();
    model.cells[index] = "";
    model.inputStep = 0;
    advanceMultiplicationInputStep(model);
    model.hinted = false;
    renderMultiplication();
  }

  function twoDigitRowOrder(multiplicand, value) {
    return multiplicationInputOrder(multiplicand, value);
  }
  function makeTwoDigitSlots(holder, count) {
    holder.replaceChildren(...Array.from({ length: count }, () => {
      const slot = document.createElement("span");
      slot.className = "multiplication-2x2-slot";
      return slot;
    }));
  }
  function setupTwoDigitMultiplication(question) {
    const partial1Text = String(question.partial1);
    const partial2Text = String(question.partial2);
    const totalText = String(question.product);
    const rows = [
      { key: "partial1", value: partial1Text, holder: $("multiplication-2x2-partial-1"), order: twoDigitRowOrder(question.multiplicand, question.partial1) },
      { key: "partial2", value: partial2Text, holder: $("multiplication-2x2-partial-2"), order: twoDigitRowOrder(question.multiplicand, question.partial2) },
      { key: "total", value: totalText, holder: $("multiplication-2x2-total"), order: Array.from({ length: totalText.length }, (_, offset) => totalText.length - 1 - offset) }
    ];
    rows.forEach((row) => makeTwoDigitSlots(row.holder, row.value.length));
    makeMultiplicationDigits($("multiplication-2x2-multiplicand"), question.multiplicand);
    makeMultiplicationDigits($("multiplication-2x2-multiplier"), question.multiplier);
    $("multiplication-2x2-partial-1").style.gridColumn = `${5 - partial1Text.length} / 5`;
    $("multiplication-2x2-partial-2").style.gridColumn = `${4 - partial2Text.length} / 4`;
    $("multiplication-2x2-total").style.gridColumn = `${5 - totalText.length} / 5`;
    const inputOrder = [];
    rows.forEach((row, rowIndex) => row.order.forEach((cellIndex) => inputOrder.push({ rowIndex, cellIndex })));
    state.multiplication2x2 = {
      rows: rows.map((row) => ({ ...row, cells: Array(row.value.length).fill(""), hintedIndexes: new Set() })),
      inputOrder, inputStep: 0, history: [],
      firstRowGuideVisible: false,
      secondRowGuideVisible: false,
      secondGuideTimer: null
    };
    renderTwoDigitMultiplication();
  }
  function renderTwoDigitMultiplication() {
    const model = state.multiplication2x2; if (!model) return;
    const active = model.inputOrder[model.inputStep] || null;
    model.rows.forEach((row, rowIndex) => {
      Array.from(row.holder.children).forEach((slot, cellIndex) => {
        slot.textContent = row.cells[cellIndex];
        slot.classList.toggle("is-active", Boolean(active && active.rowIndex === rowIndex && active.cellIndex === cellIndex));
        slot.classList.toggle("is-hinted", row.hintedIndexes.has(cellIndex));
      });
    });
    const multiplierDigits = Array.from($("multiplication-2x2-multiplier").children);
    multiplierDigits.forEach((digit, index) => {
      digit.classList.toggle("is-crossed", index === multiplierDigits.length - 1 && model.firstRowGuideVisible);
    });
    $("multiplication-2x2-shift-guide").hidden = !model.secondRowGuideVisible;
  }
  function showTwoDigitSecondRowGuides(model) {
    if (!model || model.firstRowGuideVisible) return;
    model.firstRowGuideVisible = true;
    renderTwoDigitMultiplication();
    model.secondGuideTimer = window.setTimeout(() => {
      if (state.multiplication2x2 !== model) return;
      model.secondRowGuideVisible = true;
      renderTwoDigitMultiplication();
    }, 500);
  }
  function advanceTwoDigitMultiplicationStep(model) {
    while (model.inputStep < model.inputOrder.length) {
      const step = model.inputOrder[model.inputStep];
      if (!model.rows[step.rowIndex].cells[step.cellIndex]) break;
      model.inputStep += 1;
    }
  }
  function inputTwoDigitMultiplicationNumber(number) {
    const model = state.multiplication2x2;
    if (!model || model.inputStep >= model.inputOrder.length) return;
    noteQuestionActivity();
    const step = model.inputOrder[model.inputStep];
    model.rows[step.rowIndex].cells[step.cellIndex] = String(number);
    model.history.push({ ...step });
    model.inputStep += 1;
    advanceTwoDigitMultiplicationStep(model);
    const nextStep = model.inputOrder[model.inputStep] || null;
    if (step.rowIndex === 0 && (!nextStep || nextStep.rowIndex !== 0)) showTwoDigitSecondRowGuides(model);
    renderTwoDigitMultiplication();
    if (model.inputStep >= model.inputOrder.length) {
      const allRowsCorrect = model.rows.every((row) => row.cells.join("") === row.value);
      const total = Number(model.rows[2].cells.join(""));
      judge({ quotient: allRowsCorrect ? total : total + 1, remainder: 0, usedRemainder: false });
    }
  }
  function clearTwoDigitMultiplicationInput() {
    const model = state.multiplication2x2;
    if (!model || !model.history.length) return;
    const step = model.history.pop();
    model.rows[step.rowIndex].cells[step.cellIndex] = "";
    model.inputStep = 0;
    advanceTwoDigitMultiplicationStep(model);
    renderTwoDigitMultiplication();
  }
  function fillTwoDigitMultiplicationAnswer(question) {
    const model = state.multiplication2x2; if (!model) return;
    const values = [String(question.partial1), String(question.partial2), String(question.product)];
    model.rows.forEach((row, rowIndex) => { row.cells = values[rowIndex].split(""); });
    model.inputStep = model.inputOrder.length;
    renderTwoDigitMultiplication();
  }

  function longDivisionQuotient() { return (state.longDivision?.cells || []).filter(Boolean).join(""); }
  function renderLongDivision() {
    const model = state.longDivision; if (!model) return;
    state.quotientInput = longDivisionQuotient();
    const holder = $("long-division-slots");
    model.cells.forEach((value, index) => {
      const slot = holder.children[index];
      const skipped = model.history[index]?.kind === "skip";
      slot.textContent = value;
      slot.classList.toggle("is-active", model.phase === "quotient" && index === model.history.length);
      slot.classList.toggle("is-skipped-or-unused", skipped);
    });
    const remainder = $("long-division-remainder-slot"); remainder.textContent = model.phase === "remainder" ? (state.remainderInput || "") : "";
    remainder.classList.toggle("is-active", model.phase === "remainder");
    remainder.classList.toggle("is-skipped-or-unused", Boolean(model.remainderUnused));
    $("long-division-skip-key").disabled = model.quotientDigits > 0 || model.phase !== "quotient" || model.history.length >= model.slots;
  }
  function longDivisionCompleteQuotient() {
    const model=state.longDivision; return model && model.history.length === model.slots;
  }
  function inputLongDivisionNumber(number) {
    const model=state.longDivision; if (!model) return;
    if (model.phase === "remainder") {
      if (state.remainderInput) return;
      model.remainderUnused=false; state.remainderInput=number; renderLongDivision();
      judge({ quotient:Number(state.quotientInput), remainder:Number(state.remainderInput), usedRemainder:true }); return;
    }
    if (model.history.length >= model.slots) return;
    model.remainderUnused=false; model.cells[model.history.length]=number; model.history.push({kind:"digit", value:number}); model.quotientDigits += 1;
    if (longDivisionCompleteQuotient()) model.phase="remainder";
    renderLongDivision();
  }
  function skipLongDivisionSlot() {
    const model=state.longDivision; if (!model || model.phase !== "quotient" || model.quotientDigits || model.history.length >= model.slots) return;
    noteQuestionActivity();
    model.remainderUnused=false; model.cells[model.history.length]=""; model.history.push({kind:"skip"});
    if (longDivisionCompleteQuotient()) model.phase="remainder";
    renderLongDivision();
  }
  function clearLongDivisionInput() {
    const model=state.longDivision; if (!model) return;
    if (model.phase === "remainder" && state.remainderInput) { model.remainderUnused=false; state.remainderInput=""; renderLongDivision(); return; }
    if (!model.history.length) return;
    const last=model.history.pop(); model.cells[model.history.length]=""; if (last.kind === "digit") model.quotientDigits -= 1;
    model.phase="quotient"; model.remainderUnused=false; state.remainderInput=""; renderLongDivision();
  }
  function updateAnswerAssistanceHighlight() {
    const isAssisted = Boolean(state.current && (state.current.hintUsed || state.current.answerRevealed));
    $("answer-card").classList.toggle("is-assisted", isAssisted);
    $("long-division-panel").classList.toggle("is-assisted", state.mode === "longdivision" && isAssisted);
  }
  function inputNumber(number) {
    if (state.transitioning) return;
    noteQuestionActivity();
    if (state.mode === "multiplication") { inputMultiplicationNumber(number); return; }
    if (state.mode === "multiplication2x2") { inputTwoDigitMultiplicationNumber(number); return; }
    if (state.mode === "longdivision") { inputLongDivisionNumber(number); return; }
    if (state.current.hintUsed && state.inputMode === "quotient") {
      state.inputMode = "remainder"; state.remainderInput = number;
      renderInput();
      judge({ quotient: Number(state.quotientInput), remainder: Number(state.remainderInput), usedRemainder: true });
      return;
    }
    if (state.inputMode === "quotient") {
      if (state.quotientInput.length >= 2) return;
      if (state.quotientInput === "0") state.quotientInput = "";
      state.quotientInput += number; renderInput(); return;
    }
    if (state.remainderInput) return;
    state.remainderInput = number; renderInput();
    judge({ quotient: Number(state.quotientInput), remainder: Number(state.remainderInput), usedRemainder: true });
  }
  function chooseRemainder() {
    if (!state.quotientInput || state.transitioning) return;
    noteQuestionActivity();
    if (state.mode === "longdivision") { if (!longDivisionCompleteQuotient()) return; state.longDivision.phase="remainder"; state.remainderInput=""; renderLongDivision(); return; }
    state.inputMode = "remainder"; state.remainderInput = ""; renderInput();
  }
  function chooseNoRemainder() {
    if (!state.quotientInput || state.transitioning) return;
    noteQuestionActivity();
    if (state.mode === "longdivision" && !longDivisionCompleteQuotient()) return;
    judge({ quotient: Number(state.quotientInput), remainder: 0, usedRemainder: false });
  }
  function clearInput() {
    if (state.transitioning) return;
    noteQuestionActivity();
    if (state.mode === "multiplication") { clearMultiplicationInput(); return; }
    if (state.mode === "multiplication2x2") { clearTwoDigitMultiplicationInput(); return; }
    if (state.mode === "longdivision") { clearLongDivisionInput(); return; }
    state.inputMode = "quotient"; state.quotientInput = state.current.hintUsed ? String(state.current.quotient) : ""; state.remainderInput = "";
    renderInput();
  }
  function fillLongDivisionQuotient(question) {
    const model=state.longDivision; if (!model) return;
    const digits=String(question.quotient); const blanks=model.slots-digits.length;
    model.cells=Array(blanks).fill("").concat([...digits]);
    model.history=Array.from({length:model.slots}, (_,index) => index < blanks ? {kind:"skip"} : {kind:"digit", value:digits[index-blanks]});
    model.quotientDigits=digits.length; model.phase="remainder"; model.remainderUnused=false; state.quotientInput=digits;
  }

  function questionKey(question) {
    if (question.kind === "numbercards" || question.kind === "multiplication" || question.kind === "multiplication2x2") return question.id;
    return `${question.dividend}/${question.divisor}`;
  }
  function makeReviewQuestion(question) {
    return { ...question, hintUsed: false, hadWrong: false, progressPenalty: Boolean(question.progressPenalty || question.hintUsed || question.hadWrong || question.answerRevealed), answerRevealed: false, assistedCorrect: false, resultType: null, isReview: true };
  }
  function enqueueReview(target, question) {
    const key = questionKey(question);
    if (!target.some((item) => questionKey(item) === key)) target.push(makeReviewQuestion(question));
  }
  function useHint() {
    if (state.transitioning || !state.current) return;
    if ((state.mode === "counting1" || state.mode === "counting2")) {
      state.current.hintUsed = true;
      state.counting.hinted = true;
      renderCounting();
      return;
    }
    if (state.mode === "numbercards") {
      state.current.hintUsed = true;
      state.numberCards.hinted = true;
      renderNumberCards();
      return;
    }
    if (state.mode === "multiplication2x2") {
      state.current.hintUsed = true;
      const model = state.multiplication2x2;
      const step = model?.inputOrder[model.inputStep];
      if (!step) {
        if (state.current.isReview || state.phase === "retry") revealAnswer(); else openAnswerConfirmation();
        return;
      }
      const row = model.rows[step.rowIndex];
      row.cells[step.cellIndex] = row.value[step.cellIndex];
      row.hintedIndexes.add(step.cellIndex);
      model.inputStep += 1;
      advanceTwoDigitMultiplicationStep(model);
      renderTwoDigitMultiplication();
      updateAssistButton();
      return;
    }
    if (state.mode === "multiplication") {
      state.current.hintUsed = true;
      const model = state.multiplication;
      const nextHintIndex = model.hintableIndexes.find((index) => !model.cells[index]);
      if (nextHintIndex === undefined) {
        if (state.current.isReview || state.phase === "retry") revealAnswer(); else openAnswerConfirmation();
        return;
      }
      model.cells[nextHintIndex] = String(state.current.product)[nextHintIndex];
      model.hintedIndexes.add(nextHintIndex);
      model.hinted = true;
      advanceMultiplicationInputStep(model);
      renderMultiplication();
      updateAssistButton();
      return;
    }
    state.current.hintUsed = true;
    $("answer-bubble").hidden = true;
    if (state.phase === "initial") enqueueReview(state.missed, state.current);
    if (state.mode === "longdivision") { fillLongDivisionQuotient(state.current); state.remainderInput=""; }
    else { state.quotientInput = String(state.current.quotient); state.remainderInput = ""; state.inputMode = "quotient"; }
    renderInput(); updateAnswerAssistanceHighlight(); updateAssistButton();
  }
  function openAnswerConfirmation() {
    state.confirmingAnswer = true; setKeypadDisabled(true); updateAssistButton();
    $("answer-confirm").hidden = false; $("answer-confirm-back").focus();
  }
  function closeAnswerConfirmation() {
    if (!state.confirmingAnswer) return;
    state.confirmingAnswer = false; $("answer-confirm").hidden = true; setKeypadDisabled(false); updateAssistButton();
    $("assist-button").focus();
  }
  function formatRevealedAnswer(question) {
    return question.remainder === 0 ? `${question.quotient}（あまりなし）` : `${question.quotient}…${question.remainder}`;
  }
  function renderRevealedAnswer(question) {
    if (state.mode === "multiplication2x2") { fillTwoDigitMultiplicationAnswer(question); return; }
    if (state.mode === "multiplication") {
      const model = state.multiplication;
      if (model) {
        model.cells = String(question.product).split("");
        model.inputStep = model.inputOrder.length;
        renderMultiplication();
      }
      return;
    }
    if (state.mode === "longdivision") {
      fillLongDivisionQuotient(question);
      state.remainderInput = question.remainder ? String(question.remainder) : "";
      state.longDivision.remainderUnused = question.remainder === 0;
      renderLongDivision();
      return;
    }
    const answerCard = $("answer-card"), answerText = $("answer-text");
    answerCard.classList.remove("is-revealed-no-remainder");
    if (question.remainder !== 0) { answerText.textContent = formatRevealedAnswer(question); return; }
    answerCard.classList.add("is-revealed-no-remainder");
    answerText.replaceChildren(document.createTextNode(String(question.quotient)), Object.assign(document.createElement("span"), {
      className: "answer-no-remainder", textContent: "（あまりなし）"
    }));
  }
  function revealAnswer() {
    if (!state.current || state.transitioning) return;
    stopQuestionTimeout();
    const question = state.current, isReview = question.isReview || state.phase === "retry";
    state.confirmingAnswer = false; $("answer-confirm").hidden = true;
    question.answerRevealed = true; question.resultType = "answer_revealed"; state.transitioning = true;
    state.quotientInput = String(question.quotient); state.remainderInput = String(question.remainder);
    setQuestionCardState();
    $("answer-card").className = "answer-card";
    renderRevealedAnswer(question); updateAnswerAssistanceHighlight(); setKeypadDisabled(true); updateAssistButton();
    if (!isReview) {
      enqueueReview(state.missed, question);
      state.correctStreak = 0;
      if (!isFinalInitialQuestion()) startNextVehicleChallenge();
    }
    const runId = state.runId;
    window.setTimeout(() => { if (runId === state.runId) advance(); }, revealedAnswerDurationMs);
  }
  function useAssist() {
    if (state.transitioning || state.confirmingAnswer || !state.current) return;
    noteQuestionActivity();
    if (state.mode === "numbercards" || (state.mode === "counting1" || state.mode === "counting2") || state.mode === "multiplication" || state.mode === "multiplication2x2") { useHint(); return; }
    if (!state.current.hintUsed) { useHint(); return; }
    if (state.current.isReview || state.phase === "retry") revealAnswer(); else openAnswerConfirmation();
  }

  function renderVehicleProgressUi(vehicleIndex = state.current?.vehicleIndex ?? state.currentVehicleIndex) {
    const root = $("vehicle-progress-ui"), friendship = $("friendship-progress"), energy = $("energy-progress");
    const progress = vehicleProgress(vehicleIndex);
    root.hidden = !progress.discovered;
    friendship.hidden = !progress.discovered || progress.friendly;
    energy.hidden = !progress.discovered || !progress.friendly;
    if (!progress.discovered) return;
    $("friendship-hearts").querySelectorAll(".friendship-heart").forEach((heart, index) => {
      heart.classList.toggle("is-filled", index >= 5 - progress.friendship);
    });
    if (!progress.friendly) return;
    const visualEnergy = state.energyDisplayOverride?.vehicleIndex === vehicleIndex ? state.energyDisplayOverride : null;
    const needed = visualEnergy?.required ?? requiredEnergyForStage(progress.stage);
    const currentEnergy = visualEnergy?.energy ?? progress.energy;
    const capsule = $("energy-capsule");
    capsule.style.setProperty("--capsule-height", `${({ 30: 194, 50: 254, 70: 314, 100: 374 })[needed] || 194}px`);
    $("energy-fill").style.height = `${Math.max(0, Math.min(100, (currentEnergy / needed) * 100))}%`;
    $("energy-current").textContent = String(currentEnergy);
    $("energy-required").textContent = String(needed);
  }
  function showProgressSpeechBubbleForCurrentQuestion(vehicleIndex) {
    const question = state.current;
    if (!question || question.vehicleIndex !== vehicleIndex || question.isReview || question.hintUsed || question.answerRevealed) return;
    const spec = progressSpeechBubbleSpec(vehicleIndex);
    if (!spec || spec.stage !== question.answerStage) return;
    const bubble = $("answer-bubble");
    const character = $("answer-character");
    if (!bubble || !character) return;
    positionAnswerBubble(bubble, spec.stage, character);
    const reveal = () => {
      if (state.current !== question) return;
      const currentSpec = progressSpeechBubbleSpec(vehicleIndex);
      if (!currentSpec || currentSpec.stage !== question.answerStage || question.hintUsed || question.answerRevealed) return;
      bubble.style.visibility = "";
      bubble.hidden = false;
    };
    preloadDecodedImage(spec.path)
      .then(() => decodeImageElement(bubble, spec.path))
      .then(reveal)
      .catch(() => {});
  }

  function flashEnergyCapsule() {
    const capsule = $("energy-capsule");
    capsule.classList.remove("is-complete");
    void capsule.offsetWidth;
    capsule.classList.add("is-complete");
  }
  function playProgressGainAnimation({ kind, amount = null, completed = false, holdDurationMs = progressGainHoldDurationMs, onArrive = null, onComplete = null }) {
    // Each gain owns its own element so a time bonus can overlap the normal
    // energy gain without replacing it midway through its flight.
    const gain = document.createElement("div");
    gain.className = "progress-gain-fly";
    gain.setAttribute("aria-hidden", "true");
    $("play-stage").appendChild(gain);
    const stage = $("play-stage");
    const source = document.querySelector(".answer-mark") || document.querySelector(".question-answer-card");
    const target = kind === "friendship" ? $("friendship-progress") : $("energy-capsule");
    const stageRect = stage.getBoundingClientRect();
    const sourceRect = source?.getBoundingClientRect();
    const targetRect = target?.getBoundingClientRect();
    const scale = stageRect.width / 1448 || 1;
    let dx = -875, dy = -150, waveAmplitude = 46;
    if (sourceRect && targetRect && scale > 0) {
      // Start just outside the lower-left of the correct mark, rather than
      // from its centre, so the gain visibly flies out toward the progress UI.
      const startX = (sourceRect.left + sourceRect.width * 0.14 - stageRect.left) / scale;
      const startY = (sourceRect.top + sourceRect.height * 0.78 - stageRect.top) / scale;
      const endX = (targetRect.left + targetRect.width / 2 - stageRect.left) / scale;
      const endY = (targetRect.top + targetRect.height / 2 - stageRect.top) / scale;
      gain.style.left = `${startX}px`;
      gain.style.top = `${startY}px`;
      dx = endX - startX;
      dy = endY - startY;
      waveAmplitude = Math.max(34, Math.min(58, Math.abs(dy) * 0.16 + 34));
      gain.style.setProperty("--gain-translate-x", `${dx}px`);
      gain.style.setProperty("--gain-translate-y", `${dy}px`);
    }
    gain.textContent = kind === "friendship" ? "♥" : kind === "time-bonus" ? timeBonusConfig.label : `+${amount}`;
    gain.classList.toggle("is-heart", kind === "friendship");
    gain.classList.toggle("is-time-bonus", kind === "time-bonus");
    const sparkleTrail = document.createElement("span");
    sparkleTrail.className = "progress-gain-sparkle-trail";
    sparkleTrail.setAttribute("aria-hidden", "true");
    // Scatter the sparkles with a small deterministic hash instead of rows /
    // lanes. This keeps the trail visually random while remaining stable for
    // the duration of each flight.
    for (let index = 0; index < 60; index += 1) {
      const sparkle = document.createElement("i");
      const hash = (seed) => {
        const value = Math.sin((index + 1) * seed) * 43758.5453123;
        return value - Math.floor(value);
      };
      const nearOrigin = index % 5 < 2;
      const x = nearOrigin
        ? 2 + Math.pow(hash(12.9898), 1.65) * 74
        : 18 + Math.pow(hash(12.9898), 0.72) * 268;
      const y = -78 + hash(78.233) * 156;
      const size = 5 + hash(39.425) * 14;
      const delay = -(hash(91.117) * 620);
      const driftX = 18 + hash(51.913) * 34;
      const driftY = -18 + hash(27.631) * 34;
      sparkle.style.setProperty("--spark-x", `${x.toFixed(1)}px`);
      sparkle.style.setProperty("--spark-y", `${y.toFixed(1)}px`);
      sparkle.style.setProperty("--spark-size", `${size.toFixed(1)}px`);
      sparkle.style.setProperty("--spark-delay", `${delay.toFixed(0)}ms`);
      sparkle.style.setProperty("--spark-drift-x", `${driftX.toFixed(1)}px`);
      sparkle.style.setProperty("--spark-drift-y", `${driftY.toFixed(1)}px`);
      sparkle.style.setProperty("--spark-duration", `${(460 + hash(63.719) * 430).toFixed(0)}ms`);
      sparkleTrail.appendChild(sparkle);
    }
    gain.appendChild(sparkleTrail);
    void gain.offsetWidth;
    // Keep the gain beside the correct mark long enough to be recognised,
    // then send it to the shared left-side progress panel.
    let arrived = false;
    let fallbackTimer = null;
    let flightAnimation = null;
    const arrive = () => {
      if (arrived) return;
      arrived = true;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      if (onArrive) onArrive();
      else renderVehicleProgressUi();
      if (completed) flashEnergyCapsule();
      window.setTimeout(() => { gain.remove(); if (onComplete) onComplete(); }, progressGainCleanupDurationMs);
    };
    const startFlight = () => {
      gain.classList.add("is-flying");
      if (typeof gain.animate === "function") {
        const frames = Array.from({ length: 33 }, (_, index) => {
          const t = index / 32;
          // Constant forward progress prevents the object from ever pausing at
          // the wave crest/trough. One gentle sine wave is layered over that
          // uninterrupted right-to-left movement.
          const x = dx * t;
          const y = dy * t + Math.sin(t * Math.PI * 2) * waveAmplitude;
          const scaleValue = 1 - 0.78 * t;
          const opacity = t < 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28);
          return {
            offset: t,
            opacity,
            transform: `translate(${x}px,${y}px) scale(${scaleValue})`
          };
        });
        flightAnimation = gain.animate(frames, {
          duration: progressGainAnimationDurationMs,
          easing: "linear",
          fill: "forwards"
        });
        flightAnimation.finished.then(arrive, arrive);
      }
      fallbackTimer = window.setTimeout(arrive, progressGainAnimationDurationMs + 120);
    };
    if (holdDurationMs > 0) window.setTimeout(startFlight, holdDurationMs);
    else window.requestAnimationFrame(startFlight);
  }
  function timeBonusAnswerDigits(question) {
    if (question.kind === "multiplication" || question.kind === "multiplication2x2") return String(question.product).length;
    return String(question.quotient).length + (question.remainder === 0 ? 0 : String(question.remainder).length);
  }
  function getTimeBonusForCorrect(question = state.current) {
    if (!timeBonusConfig.enabled || state.phase !== "initial" || !question || question.isReview) return null;
    if (!timeBonusConfig.modes.includes(state.mode) || question.hintUsed || question.hadWrong || question.answerRevealed || question.progressPenalty) return null;
    const progress = vehicleProgress(question.vehicleIndex ?? state.currentVehicleIndex);
    if (!progress.friendly || progress.masterMedal) return null;
    const answerDigits = timeBonusAnswerDigits(question);
    const limitMs = timeBonusConfig.limitMsByAnswerDigits[answerDigits];
    const startedAt = Number(question.timeBonusStartedAt);
    const elapsedMs = performance.now() - startedAt;
    if (!limitMs || !Number.isFinite(startedAt) || startedAt <= 0 || elapsedMs > limitMs) return null;
    return { amount: timeBonusConfig.amount, answerDigits, limitMs, elapsedMs };
  }
  function addCompletedRewardToSession(reward) {
    if (!reward?.isNew) return;
    const key = `${reward.vehicleIndex}:${reward.stage}:${reward.kind}`;
    if (!state.sessionResultGets.some((item) => `${item.vehicleIndex}:${item.stage}:${item.kind}` === key)) state.sessionResultGets.push({ ...reward });
    state.collectionNewVehicleIndexes.add(reward.vehicleIndex);
  }
  function saveCollectionProgress() {
    saveRewardProgress();
    syncCollectionFromRewardProgress();
  }
  function completeEnergyStage(progress, vehicleIndex) {
    const completedStage = progress.stage;
    progress.energy = 0;
    if (completedStage === 5) progress.masterMedal = true;
    else progress.stage += 1;
    state.sessionUnlocks[completedStage] += 1;
    const reward = { stage: completedStage, vehicleIndex, isNew: true, kind: "evolution", endsChallenge: true };
    if (vehicleIndex === state.currentVehicleIndex) state.currentStage = currentStageForVehicle(vehicleIndex);
    return reward;
  }
  function applyEnergyGain(progress, vehicleIndex, amount, { completeStage = true } = {}) {
    const required = requiredEnergyForStage(progress.stage);
    progress.energy = Math.min(required, progress.energy + amount);
    const appliedEnergy = progress.energy;
    const reward = completeStage && progress.energy >= required ? completeEnergyStage(progress, vehicleIndex) : null;
    return { reward, required, appliedEnergy };
  }
  function finishDeferredTimeBonusProgress(deferred) {
    const progress = vehicleProgress(deferred.vehicleIndex);
    const gain = applyEnergyGain(progress, deferred.vehicleIndex, deferred.timeBonus.amount, { completeStage: false });
    const { required, appliedEnergy } = gain;
    const reward = progress.energy >= required ? completeEnergyStage(progress, deferred.vehicleIndex) : null;
    addCompletedRewardToSession(reward);
    saveCollectionProgress();
    return { reward, energyVisual: { vehicleIndex: deferred.vehicleIndex, energy: appliedEnergy, required } };
  }
  function playTimeBonusSequence(deferred, onResolved) {
    const runId = state.runId;
    let timeBonusReward = null;
    playProgressGainAnimation({ kind: "energy", amount: deferred.energyGain, onArrive: () => {
      if (runId !== state.runId) return;
      const progress = vehicleProgress(deferred.vehicleIndex);
      const gain = applyEnergyGain(progress, deferred.vehicleIndex, deferred.energyGain, { completeStage: false });
      state.energyDisplayOverride = { vehicleIndex: deferred.vehicleIndex, energy: gain.appliedEnergy, required: gain.required };
      renderVehicleProgressUi(deferred.vehicleIndex);
      showProgressSpeechBubbleForCurrentQuestion(deferred.vehicleIndex);
    }});
    // Show the longer time-bonus label still for 0.4 seconds before it flies.
    window.setTimeout(() => playProgressGainAnimation({
      kind: "time-bonus", amount: deferred.timeBonus.amount, holdDurationMs: timeBonusHoldDurationMs,
      onArrive: () => {
        if (runId !== state.runId) return;
        const resolved = finishDeferredTimeBonusProgress(deferred);
        timeBonusReward = resolved.reward;
        state.energyDisplayOverride = resolved.energyVisual;
        renderVehicleProgressUi(deferred.vehicleIndex);
        showProgressSpeechBubbleForCurrentQuestion(deferred.vehicleIndex);
        if (timeBonusReward) flashEnergyCapsule();
      },
      onComplete: () => {
        if (runId !== state.runId) return;
        window.setTimeout(() => {
          if (runId === state.runId) onResolved(timeBonusReward);
        }, timeBonusReward ? energyFullDisplayDurationMs : 0);
      }
    }), 600);
  }
  function progressCollectionForCorrect(question = state.current) {
    const vehicleIndex = question.vehicleIndex ?? state.currentVehicleIndex;
    const progress = vehicleProgress(vehicleIndex);
    let reward = null, energyGain = 0, friendshipGain = 0, deferredTimeBonus = null, energyVisual = null;
    if (!progress.discovered) {
      progress.discovered = true; progress.stage = 2; progress.friendship = 0; progress.friendly = false; progress.energy = 0;
      reward = { stage: 1, vehicleIndex, isNew: true, kind: "discovery", endsChallenge: false };
    } else if (!progress.friendly) {
      progress.friendship = Math.min(5, progress.friendship + 1);
      friendshipGain = 1;
      if (progress.friendship === 5) {
        // Friendship itself awards the vehicle. Energy starts on the next
        // encounter, never on this fifth-heart answer.
        progress.friendly = true;
        state.sessionUnlocks[1] += 1;
        reward = { stage: 1, vehicleIndex, isNew: true, kind: "friendship", endsChallenge: true };
      }
    } else if (!progress.masterMedal) {
      energyGain = question.hintUsed || question.hadWrong || question.progressPenalty ? 1 : 3;
      const timeBonus = getTimeBonusForCorrect(question);
      if (timeBonus) deferredTimeBonus = { vehicleIndex, energyGain, timeBonus };
      else {
        const gain = applyEnergyGain(progress, vehicleIndex, energyGain);
        reward = gain.reward;
        energyVisual = { vehicleIndex, energy: gain.appliedEnergy, required: gain.required };
      }
    }
    if (vehicleIndex === state.currentVehicleIndex) state.currentStage = currentStageForVehicle(vehicleIndex);
    // Completed state changes are shown as GET entries, including discovery
    // and friendship. Ordinary point gains remain progress-only.
    addCompletedRewardToSession(reward);
    if (!deferredTimeBonus) saveCollectionProgress();
    return { reward, energyGain, friendshipGain, deferredTimeBonus, energyVisual };
  }
  function isFinalInitialQuestion() {
    return state.phase === "initial" && state.initialIndex >= state.questions.length - 1;
  }
  function challengeMustEndAfterCorrect(question, reward) {
    if (state.phase !== "initial") return false;
    return Boolean(reward?.endsChallenge) || Boolean(question.hadWrong) || state.vehicleChallengeQuestionCount >= 5;
  }
  function finishInitialQuestion({ reward = null, challengeEnds = false } = {}) {
    const finalQuestion = isFinalInitialQuestion();
    if (reward) {
      // The reward screen itself prepares exactly one next vehicle only when
      // another initial question exists.  On the final question it returns
      // directly to the existing retry/result flow without the search overlay.
      showReward(reward, !finalQuestion && challengeEnds);
      return;
    }
    if (!finalQuestion && challengeEnds) {
      if (state.current?.hadWrong && state.mode !== "numbercards" && (state.mode !== "counting1" && state.mode !== "counting2")) { showIncorrectNextVehicleNotice(); return; }
      if (state.vehicleChallengeQuestionCount >= 5) { showFiveQuestionClearTransition(); return; }
      startNextVehicleChallenge();
    }
    advance();
  }
  function runAnswerTransition(step) {
    try { step(); } catch (error) { state.transitioning = false; console.error("Answer transition failed", error); }
  }
  function judge(answer) {
    if (state.transitioning) return;
    state.transitioning = true;
    try {
    if (state.current.answerRevealed) { state.transitioning = false; return; }
    stopQuestionTimeout(); setKeypadDisabled(true); if (state.mode === "longdivision") renderLongDivision(); else $("answer-text").textContent = formatAnswer(answer);
    const hintInputTypeMatches = !state.current.hintUsed || Boolean(answer.usedRemainder) === (state.current.remainder !== 0);
    const correct = answer.quotient === state.current.quotient && answer.remainder === state.current.remainder && hintInputTypeMatches;
    const assistedCorrect = correct && state.phase === "initial" && state.current.hintUsed;
    let reward = null, progression = null;
    if (correct) {
      setQuestionCardState("correct");
      state.current.resultType = state.current.hintUsed ? "hint_correct" : "self_correct";
      if (assistedCorrect) { state.current.assistedCorrect = true; enqueueReview(state.missed, state.current); }
      if (state.phase === "initial") {
        if (!assistedCorrect) {
          state.initialCorrect += 1;
          if (state.current.hadWrong) state.correctStreak = 0;
          else state.correctStreak += 1;
        }
        progression = progressCollectionForCorrect(state.current);
        reward = progression.reward;
        if (progression.friendshipGain) playProgressGainAnimation({ kind: "friendship" });
        else if (progression.energyGain && !progression.deferredTimeBonus) playProgressGainAnimation({
          kind: "energy", amount: progression.energyGain, completed: Boolean(reward),
          onArrive: () => {
            if (progression.energyVisual) state.energyDisplayOverride = progression.energyVisual;
            renderVehicleProgressUi(state.current.vehicleIndex);
            showProgressSpeechBubbleForCurrentQuestion(state.current.vehicleIndex);
          }
        });
      }
      if (reward && reward.stage < 5) preloadRewardVisuals(reward.stage, reward.vehicleIndex, reward.kind).catch(() => {});
      if (reward?.isNew || reward?.replay) playCorrectSound(); else playSimpleCorrectSound();
    } else {
      state.current.resultType = state.current.hintUsed ? "hint_wrong" : "self_wrong";
      state.current.hadWrong = true;
      setQuestionCardState("wrong");
      playWrongSound();
      if (state.phase === "initial") {
        enqueueReview(state.missed, state.current);
        state.correctStreak = 0;
      } else enqueueReview(state.queue, state.current);
    }
    if (correct && progression?.deferredTimeBonus) {
      playTimeBonusSequence(progression.deferredTimeBonus, (timeBonusReward) => {
        if (timeBonusReward && timeBonusReward.stage < 5) preloadRewardVisuals(timeBonusReward.stage, timeBonusReward.vehicleIndex, timeBonusReward.kind).catch(() => {});
        runAnswerTransition(() => finishInitialQuestion({
          reward: timeBonusReward,
          challengeEnds: challengeMustEndAfterCorrect(state.current, timeBonusReward)
        }));
      });
      return;
    }
    const runId = state.runId;
    window.setTimeout(() => {
      if (runId !== state.runId) return;
      runAnswerTransition(() => {
        if (state.phase === "initial") {
          finishInitialQuestion({ reward, challengeEnds: correct ? challengeMustEndAfterCorrect(state.current, reward) : true });
        } else advance();
      });
    }, correct ? Math.max(
      correctFeedbackDurationMs,
      progressGainTotalDurationMs + (reward && progression?.energyGain ? energyFullDisplayDurationMs : 0)
    ) : wrongFeedbackDurationMs);
    } catch (error) { state.transitioning = false; throw error; }
  }
  function showReward({ stage, vehicleIndex, isNew, replay = false, kind = "evolution" }, drawAfterReward = false) {
    const vehicle = vehicles[vehicleIndex];
    const nextVehicleOverlay = $("reward-next-vehicle-overlay");
    const rewardMeta = $("reward-vehicle-meta");
    const hasNextInitialQuestion = state.phase === "initial" && state.initialIndex + 1 < state.questions.length;
    const shouldShowNextVehicleOverlay = (isNew || replay) && drawAfterReward && hasNextInitialQuestion;
    const nextVehicleOverlayPath = rewardNextVehicleOverlayPath;
    const nextVehicleOverlayAlt = "さあ、新しいのりものをさがしに行こう!!";
    nextVehicleOverlay.hidden = true;
    nextVehicleOverlay.alt = nextVehicleOverlayAlt;
    rewardMeta.hidden = false;
    $("reward-vehicle-name").textContent = vehicle.nameJa;
    $("reward-vehicle-rarity").textContent = `${vehicle.rarityLabel} ${vehicle.rarityStars}`;
    $("reward-stage").dataset.stage = String(stage);
    $("reward-stage").dataset.rewardKind = kind;
    $("reward-image").alt = `${vehicle.nameJa}の獲得演出`;
    $("reward-screen").classList.toggle("reward-overlay", stage < 5);
    const runId = state.runId;
    const nextVehicleOverlayReady = shouldShowNextVehicleOverlay
      ? preloadDecodedImage(nextVehicleOverlayPath)
        .then(() => decodeImageElement(nextVehicleOverlay, nextVehicleOverlayPath))
        .then(() => true)
        .catch((error) => { console.error("Next vehicle overlay failed to load", error); return false; })
      : Promise.resolve(false);
    function prepareNextVisuals() {
      if (!drawAfterReward || runId !== state.runId) return Promise.resolve();
      // Every acquisition/evolution closes its vehicle challenge.  Pick the
      // successor once here, after the reward has finished, and prepare it
      // behind the current scene before the single visual swap.
      startNextVehicleChallenge({ afterStage5: stage === 5 });
      const nextQuestion = state.phase === "initial" ? state.questions[state.initialIndex + 1] : null;
      if (nextQuestion) {
        assignQuestionVisualContext(nextQuestion);
        return prepareQuestionVisuals(nextQuestion, true).then((prepared) => {
          if (prepared && runId === state.runId) state.preparedNextQuestionVisual = { question: nextQuestion, prepared };
          return prepared;
        }).catch(() => null);
      }
      return preloadImage(startKeyVisualPath).catch(() => null);
    }
    function finishAfter(duration, nextVisualsReady) {
      window.setTimeout(() => {
        if (runId !== state.runId) return;
        Promise.all([nextVisualsReady, nextVehicleOverlayReady]).then(([, overlayReady]) => {
          if (runId !== state.runId) return;
          if (!overlayReady) {
            runAnswerTransition(advance);
            return;
          }
          nextVehicleOverlay.hidden = false;
          window.requestAnimationFrame(() => {
            if (runId !== state.runId) { nextVehicleOverlay.hidden = true; return; }
            window.setTimeout(() => {
              if (runId !== state.runId) return;
              state.pendingNextVehicleOverlay = nextVehicleOverlay;
              runAnswerTransition(advance);
            }, rewardNextVehicleOverlayDurationMs);
          });
        });
      }, duration);
    }
    if (stage === 5) {
      const backplate = $("reward-backplate"), artwork = $("reward-image");
      const backplatePath = `./assets/collection/09_complete/reward/${String(vehicleIndex + 1).padStart(2, "0")}_${vehicle.nameEn.replaceAll(" ", "_")}_complete.png`;
      const artworkPath = "./assets/ui/reward_popup/reward_stage05_master-medal-get-overlay.webp";
      backplate.style.visibility = "hidden";
      artwork.style.visibility = "hidden";
      artwork.hidden = replay;
      Promise.all((replay ? [backplatePath] : [backplatePath, artworkPath]).map(preloadDecodedImage))
        .then(() => Promise.all([decodeImageElement(backplate, backplatePath), replay ? Promise.resolve() : decodeImageElement(artwork, artworkPath)]))
        .then(() => {
          if (runId !== state.runId) return;
          backplate.style.visibility = "";
          if (!replay) { artwork.hidden = false; artwork.style.visibility = ""; }
          pauseGameTimer();
          // Keep the prepared play scene mounted beneath Stage 5 as well, so
          // its dismissal can reveal the next vehicle without a blank frame.
          setBackgroundMusicDucked(true);
          showRewardOverPlay();
          window.requestAnimationFrame(() => finishAfter((isNew || replay) ? 5000 : 1400, prepareNextVisuals()));
        }).catch((error) => {
          if (runId !== state.runId) return;
          console.error("Stage 5 reward visual failed to load", error);
          prepareNextVisuals().then(() => {
            if (runId === state.runId) runAnswerTransition(advance);
          });
        });
      return;
    }

    const backplate = $("reward-backplate"), artwork = $("reward-image");
    backplate.hidden = false;
    artwork.hidden = false;
    backplate.style.visibility = "hidden";
    artwork.style.visibility = "hidden";
    preloadRewardVisuals(stage, vehicleIndex, kind).then((paths) => {
      if (runId !== state.runId) return false;
      return Promise.all([
        decodeImageElement(backplate, paths.backplatePath),
        decodeImageElement(artwork, paths.artworkPath)
      ]).then(() => true);
    }).then((ready) => {
      if (!ready || runId !== state.runId) return;
      backplate.style.visibility = "";
      artwork.style.visibility = "";
      pauseGameTimer();
      setBackgroundMusicDucked(true);
      showRewardOverPlay();
      window.requestAnimationFrame(() => {
        if (runId !== state.runId) return;
        const nextVisualsReady = new Promise((resolve) => {
          window.requestAnimationFrame(() => prepareNextVisuals().then(resolve));
        });
        finishAfter(isNew ? 3000 : 1400, nextVisualsReady);
      });
    }).catch((error) => {
      if (runId !== state.runId) return;
      console.error("Reward visual failed to load", error);
      prepareNextVisuals().then(() => {
        if (runId !== state.runId) return;
        runAnswerTransition(advance);
      });
    });
  }
  function showIncorrectNextVehicleNotice() {
    const runId = state.runId;
    const notice = $("incorrect-next-vehicle-notice");
    // The × has completed; keep the solved problem visible behind the notice.
    setQuestionCardState("");
    pauseGameTimer();
    notice.hidden = false;
    const prepareNextVisuals = () => {
      startNextVehicleChallenge();
      const nextQuestion = state.questions[state.initialIndex + 1];
      if (!nextQuestion) return Promise.resolve(null);
      assignQuestionVisualContext(nextQuestion);
      return prepareQuestionVisuals(nextQuestion, true).then((prepared) => {
        if (prepared && runId === state.runId) state.preparedNextQuestionVisual = { question: nextQuestion, prepared };
        return prepared;
      }).catch(() => null);
    };
    const nextVisualsReady = prepareNextVisuals();
    window.setTimeout(() => {
      if (runId !== state.runId) return;
      nextVisualsReady.then(() => {
        if (runId !== state.runId) return;
        notice.hidden = true;
        runAnswerTransition(advance);
      });
    }, incorrectNextVehicleNoticeDurationMs);
  }
  function showFiveQuestionClearTransition() {
    const runId = state.runId;
    const overlay = $("vehicle-transition-five-clear");
    pauseGameTimer();
    const prepareNextVisuals = () => {
      startNextVehicleChallenge();
      const nextQuestion = state.questions[state.initialIndex + 1];
      if (!nextQuestion) return Promise.resolve(null);
      assignQuestionVisualContext(nextQuestion);
      return prepareQuestionVisuals(nextQuestion, true).then((prepared) => {
        if (prepared && runId === state.runId) state.preparedNextQuestionVisual = { question: nextQuestion, prepared };
        return prepared;
      }).catch(() => null);
    };
    const nextVisualsReady = prepareNextVisuals();
    preloadDecodedImage(vehicleTransitionFiveClearPath)
      .then(() => decodeImageElement(overlay, vehicleTransitionFiveClearPath))
      .catch((error) => { console.error("Five-question transition overlay failed to load", error); })
      .then(() => {
        if (runId !== state.runId) return;
        overlay.hidden = false;
        window.setTimeout(() => {
          if (runId !== state.runId) return;
          overlay.hidden = true;
          nextVisualsReady.then(() => {
            if (runId === state.runId) runAnswerTransition(advance);
          });
        }, rewardNextVehicleOverlayDurationMs);
      });
  }
  function advance() {
    if (state.phase === "initial") {
      state.initialIndex += 1;
      if (state.initialIndex < state.questions.length) {
        displayQuestion(state.questions[state.initialIndex]); return;
      }
      if (state.mode === "numbercards" || (state.mode === "counting1" || state.mode === "counting2")) { finishRound(); return; }
      if (state.missed.length === 0) { finishRound(); return; }
      state.phase = "retry"; state.queue = [...state.missed]; state.retrySetPosition = 1; state.retrySetTotal = state.queue.length;
      stopBackgroundMusic();
      $("retry-count").textContent = `あと${state.queue.length}問！`;
      showFixedScreenWhenReady("transition-screen", [topBackgroundPath], scheduleRetryAutoStart);
      return;
    }
    if (state.retrySetPosition >= state.retrySetTotal) {
      if (state.queue.length === 0) { finishRound(); return; }
      state.retrySetTotal = state.queue.length; state.retrySetPosition = 1;
    } else state.retrySetPosition += 1;
    if (state.queue.length === 0) { finishRound(); return; }
    displayQuestion(state.queue.shift());
  }
  function finishRound() {
    state.transitioning = true; state.phase = "result"; state.finalElapsedMs = getElapsedTime(); stopQuestionTimeout(); stopTimer(); stopBackgroundMusic();
    $("elapsed-time").textContent = formatTime(state.finalElapsedMs); $("result-time").textContent = formatTime(state.finalElapsedMs);
    const previousBest = getBestTime();
    if (previousBest === null) {
      saveBestTime(state.finalElapsedMs);
    } else if (state.finalElapsedMs < previousBest) {
      saveBestTime(state.finalElapsedMs);
    }
    renderResultSummary();
    $("collection-button").disabled = false;
    $("collection-button").innerHTML = '<svg class="ui-icon collection-gem" aria-hidden="true"><use href="./assets/ui/icons/ui-icons.svg#gem"></use></svg><span class="collection-copy">コレクションを見る</span>';
    showFixedScreenWhenReady("result-screen", [], () => {
      resetResultScrollPosition();
      playFinishSound(); state.transitioning = false;
      preloadRemainingVehicleArtwork();
    });
  }
  function resultArtworkPath(vehicleIndex, stage, masterMedal = false) {
    const vehicle = vehicles[vehicleIndex];
    if (!vehicle) return "";
    if (masterMedal) return `./assets/collection/09_complete/reward/${String(vehicleIndex + 1).padStart(2, "0")}_${vehicle.nameEn.replaceAll(" ", "_")}_complete.png`;
    const path = answerArtworkPath(vehicleIndex, Math.max(2, Math.min(5, stage)));
    return path ? `./${path.replace(/^\.\//, "")}` : vehicleArtworkPath(vehicleIndex);
  }
  function resultRewardLabel(item) {
    if (item.kind === "discovery") return "のりもの発見！";
    if (item.kind === "friendship") return "なかよしになったよ！";
    return ({ 2: "ロボットに進化！", 3: "スーパーロボットに進化！", 4: "スペシャル装備GET!", 5: "マスターメダルGET!" })[item.stage] || "GET!";
  }
  function renderResultSummary() {
    const progressItems = vehicles.map((vehicle) => {
      const before = state.resultStartProgress[vehicle.index] || emptyVehicleProgress();
      const after = vehicleProgress(vehicle.index);
      const gotReward = state.sessionResultGets.some((item) => item.vehicleIndex === vehicle.index);
      if (gotReward) return null;
      if (!after.friendly && after.friendship > before.friendship) {
        return { vehicle, after, type: "friendship", from: before.friendship, to: after.friendship };
      }
      if (after.friendly) {
        // Evolution resets energy. If the current stage gained energy later in
        // this play, show only that stage and highlight its new portion.
        const from = after.stage === before.stage ? before.energy : 0;
        if (after.energy > from) return { vehicle, after, type: "energy", from, to: after.energy, required: requiredEnergyForStage(after.stage) };
      }
      return null;
    }).filter(Boolean);
    const progressSection = $("result-progress-section");
    progressSection.hidden = progressItems.length === 0;
    $("result-progress-list").innerHTML = progressItems.map((item) => {
      const image = resultArtworkPath(item.vehicle.index, item.after.stage, item.after.masterMedal);
      const meter = item.type === "friendship"
        ? `<div class="result-new-hearts" aria-label="なかよし ${item.to} / 5">${[5,4,3,2,1].map((level) => `<span class="${level <= item.to ? "is-earned" : ""} ${level > item.from && level <= item.to ? "is-gained" : ""}">♥</span>`).join("")}</div>`
        : `<div class="result-new-energy" aria-label="エネルギー ${item.to} / ${item.required}"><div class="result-new-energy-tank"><span class="result-new-energy-stack${item.from ? "" : " is-only-gain"}"><i style="height:${Math.min(100, item.from / item.required * 100)}%"></i><b style="height:${Math.min(100, Math.max(0, item.to - item.from) / item.required * 100)}%"></b></span></div><strong>${item.to}<small>/ ${item.required}</small></strong></div>`;
      return `<article class="result-new-progress-card"><div class="result-new-progress-vehicle"><img src="${image}" alt="${item.vehicle.nameJa}" decoding="async"><span>${item.vehicle.nameEn}</span></div><div class="result-new-meter"><b>${item.type === "friendship" ? "なかよし" : "エネルギー"}</b>${meter}</div></article>`;
    }).join("");
    const getSection = $("result-gets-section");
    getSection.hidden = state.sessionResultGets.length === 0;
    $("result-gets-list").innerHTML = state.sessionResultGets.map((item) => {
      const vehicle = vehicles[item.vehicleIndex];
      const master = item.stage === 5;
      const image = resultArtworkPath(item.vehicleIndex, Math.min(5, item.stage + 1), master);
      return `<article class="result-new-get-card"><img src="${image}" alt="${vehicle.nameJa}" decoding="async"><div><span>${resultRewardLabel(item)}</span><strong>GET!</strong></div><i aria-hidden="true">✦</i></article>`;
    }).join("");
    $("result-correct-count").textContent = `${state.initialCorrect} / ${state.questions.length}`;
  }
  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000), minutes = Math.floor(totalSeconds / 60), seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  }
  function getElapsedTime(now = performance.now()) {
    if (!state.startedAt) return 0;
    const currentPauseMs = state.timerPaused ? now - state.timerPausedAt : 0;
    return Math.max(0, now - state.startedAt - state.pausedTimerMs - currentPauseMs);
  }
  function updateElapsedTime() {
    if (state.startedAt && state.phase !== "start" && state.phase !== "result") $("elapsed-time").textContent = formatTime(getElapsedTime());
  }
  function startTimer() { stopTimer(); updateElapsedTime(); state.timerId = window.setInterval(updateElapsedTime, 250); }
  function stopTimer() { if (state.timerId !== null) { window.clearInterval(state.timerId); state.timerId = null; } }
  function pauseGameTimer() {
    if (!state.startedAt || state.timerPaused) return;
    updateElapsedTime();
    state.timerPaused = true;
    state.timerPausedAt = performance.now();
    stopTimer();
  }
  function resumeGameTimer() {
    if (!state.timerPaused) return;
    state.pausedTimerMs += performance.now() - state.timerPausedAt;
    state.timerPaused = false;
    state.timerPausedAt = 0;
    if (state.startedAt && state.phase !== "start" && state.phase !== "result") startTimer();
  }
  function startQuestionTimeout() {
    stopQuestionTimeout();
    state.questionDeadline = Date.now() + questionTimeoutMs;
    const runId = state.runId;
    state.questionTimeoutId = window.setTimeout(() => {
      if (runId === state.runId) checkQuestionTimeout();
    }, questionTimeoutMs + 50);
  }
  function stopQuestionTimeout() {
    if (state.questionTimeoutId !== null) { window.clearTimeout(state.questionTimeoutId); state.questionTimeoutId = null; }
    state.questionDeadline = 0;
  }
  function clearRetryAutoStartTimer() {
    if (state.retryAutoStartTimer !== null) { window.clearTimeout(state.retryAutoStartTimer); state.retryAutoStartTimer = null; }
  }
  function scheduleRetryAutoStart() {
    clearRetryAutoStartTimer();
    const runId = state.runId;
    state.retryAutoStartTimer = window.setTimeout(() => {
      state.retryAutoStartTimer = null;
      if (runId !== state.runId || state.phase !== "retry" || !state.transitioning || state.queue.length === 0) return;
      runAnswerTransition(() => displayQuestion(state.queue.shift()));
    }, retryStartDelayMs);
  }
  function clearIdleGuide() {
    if (state.idleGuideTimer !== null) { window.clearTimeout(state.idleGuideTimer); state.idleGuideTimer = null; }
    const guide = $("idle-guide");
    if (guide) guide.hidden = true;
  }
  function showIdleGuide() {
    state.idleGuideTimer = null;
    if (!state.current || state.transitioning || state.confirmingAnswer || !$("play-screen").classList.contains("active")) return;
    const stage = $("play-stage");
    const target = state.mode === "numbercards"
      ? $("number-card-grid").querySelector(`.number-card[data-number="${state.numberCards?.nextNumber}"]`)
      : (state.mode === "counting1" || state.mode === "counting2")
        ? $("counting-keypad-grid").querySelector(`.counting-key[data-counting-number="${state.current?.value}"]`)
        : $("assist-button");
    if (!target || target.disabled) return;
    const stageRect = stage.getBoundingClientRect(), targetRect = target.getBoundingClientRect();
    const scale = stageRect.width / 1448 || 1;
    const guide = $("idle-guide");
    const targetCenterX = (targetRect.left + targetRect.width / 2 - stageRect.left) / scale;
    const targetCenterY = (targetRect.top + targetRect.height / 2 - stageRect.top) / scale;
    guide.style.left = `${targetCenterX + 74}px`;
    guide.style.top = `${Math.max(74, targetCenterY - 46)}px`;
    guide.hidden = false;
  }
  function resetIdleGuideTimer() {
    clearIdleGuide();
    if (!state.current || state.transitioning || state.confirmingAnswer || (state.phase !== "initial" && state.phase !== "retry")) return;
    state.idleGuideTimer = window.setTimeout(showIdleGuide, idleGuideDelayMs);
  }
  function noteQuestionActivity() {
    clearIdleGuide();
    if (!state.transitioning && state.current) resetIdleGuideTimer();
  }
  function checkQuestionTimeout() {
    if (!state.questionDeadline || Date.now() < state.questionDeadline) return;
    if ((state.phase !== "initial" && state.phase !== "retry") || state.transitioning || !state.current) return;
    handleQuestionTimeout();
  }
  function handleQuestionTimeout() {
    stopQuestionTimeout(); saveCollection();
    if (state.pendingNextVehicleOverlay) state.pendingNextVehicleOverlay.hidden = true;
    state.pendingNextVehicleOverlay = null;
    state.preparedNextQuestionVisual = null;
    state.runId += 1; state.phase = "start"; state.transitioning = false; state.startedAt = 0; state.timerPaused = false; state.timerPausedAt = 0; state.pausedTimerMs = 0; state.current = null;
    state.confirmingAnswer = false; state.quotientInput = ""; state.remainderInput = ""; state.inputMode = "quotient";
    state.preparedInitialVehicleIndex = null;
    prepareInitialVehicle();
    clearRetryAutoStartTimer(); clearIdleGuide(); stopTimer(); stopCollectionTimer(); stopBackgroundMusic(); state.collectionUsed = false; setKeypadDisabled(false);
    $("answer-confirm").hidden = true; $("time-up").hidden = true;
    showFixedScreenWhenReady("start-screen");
  }
  function endToStart({ keepTimeUp = false } = {}) {
    if (state.pendingNextVehicleOverlay) state.pendingNextVehicleOverlay.hidden = true;
    state.pendingNextVehicleOverlay = null;
    state.preparedNextQuestionVisual = null;
    state.runId += 1; state.phase = "start"; clearRetryAutoStartTimer(); clearIdleGuide(); stopQuestionTimeout(); stopTimer(); stopCollectionTimer(); stopBackgroundMusic(); state.startedAt = 0; state.timerPaused = false; state.timerPausedAt = 0; state.pausedTimerMs = 0;
    state.confirmingAnswer = false; state.current = null; state.collectionUsed = false; state.collectionNewVehicleIndexes = new Set(); state.preparedInitialVehicleIndex = null;
    window.speechSynthesis?.cancel();
    prepareInitialVehicle();
    $("answer-confirm").hidden = true;
    if (!keepTimeUp) $("time-up").hidden = true;
    showFixedScreenWhenReady("start-screen", [], () => {
      if (keepTimeUp) $("time-up").hidden = true;
      state.collectionClosing = false;
    });
  }

  function endToModeSelect() {
    if (state.pendingNextVehicleOverlay) state.pendingNextVehicleOverlay.hidden = true;
    state.pendingNextVehicleOverlay = null;
    state.preparedNextQuestionVisual = null;
    state.runId += 1; state.phase = "start"; clearRetryAutoStartTimer(); clearIdleGuide(); stopQuestionTimeout(); stopTimer(); stopCollectionTimer(); stopBackgroundMusic(); state.startedAt = 0; state.timerPaused = false; state.timerPausedAt = 0; state.pausedTimerMs = 0;
    state.confirmingAnswer = false; state.current = null; state.collectionUsed = false; state.collectionNewVehicleIndexes = new Set(); state.preparedInitialVehicleIndex = null;
    window.speechSynthesis?.cancel();
    prepareInitialVehicle();
    $("answer-confirm").hidden = true;
    $("time-up").hidden = true;
    showFixedScreenWhenReady("mode-select-screen", [], () => {
      state.collectionClosing = false;
    });
  }

  async function openCollection({ showSessionMarkers = true } = {}) {
    if (state.collectionUsed || state.collectionClosing) return;
    state.collectionUsed = true;
    $("collection-button").disabled = true;
    $("collection-button").innerHTML = '<svg class="ui-icon collection-gem" aria-hidden="true"><use href="./assets/ui/icons/ui-icons.svg#gem"></use></svg><span class="collection-copy">コレクション<small>みおわったよ</small></span>';
    const runId = state.runId;
    await preloadCollectionVehicleArtwork();
    if (runId !== state.runId || !state.collectionUsed) return;
    state.collectionDeadline = Date.now() + 60000;
    setCollectionCategory("vehicle"); renderCollectionGrid({ showSessionMarkers }); sizeCollectionStage(); showScreen("collection-screen"); updateCollectionClock();
    state.collectionTimerId = window.setInterval(updateCollectionClock, 200);
  }
  function updateCollectionClock() {
    const seconds = Math.max(0, Math.ceil((state.collectionDeadline - Date.now()) / 1000));
    const displaySeconds = seconds <= 10 ? seconds : Math.ceil(seconds / 10) * 10;
    $("collection-seconds").textContent = String(displaySeconds); $("detail-seconds").textContent = String(displaySeconds);
    if (seconds === 0) collectionTimeUp();
  }
  function collectionTimeUp() {
    if (state.collectionClosing) return;
    state.collectionClosing = true;
    stopCollectionTimer(); playCollectionEndSound(); $("time-up").hidden = false;
    window.setTimeout(() => endToStart({ keepTimeUp:true }), collectionEndTransitionDurationMs);
  }
  function stopCollectionTimer() {
    if (state.collectionTimerId !== null) { window.clearInterval(state.collectionTimerId); state.collectionTimerId = null; }
  }
  function setCollectionCategory(category) {
    document.querySelectorAll(".category-button").forEach((button) => {
      const selected = button.dataset.category === category;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $("collection-grid").hidden = category !== "vehicle";
  }
  function exitCollection() { $("collection-exit-confirm").hidden = false; $("collection-exit-no").focus(); }
  function closeCollectionExit() { $("collection-exit-confirm").hidden = true; $("collection-exit").focus(); }
  function renderCollectionGrid({ showSessionMarkers = true } = {}) {
    $("medal-count").textContent = `${state.collection.filter((stage) => stage === 5).length} / 20`;
    $("collection-grid").innerHTML = collectionDisplayOrder.map((vehicleIndex) => {
      const vehicle = vehicles[vehicleIndex];
      const progress = vehicleProgress(vehicle.index);
      const discovered = progress.discovered, complete = progress.masterMedal;
      const formStage = complete ? 5 : Math.max(2, Math.min(5, progress.stage));
      const status = !discovered ? "" : !progress.friendly
        ? `<span class="collection-card-status collection-card-hearts" aria-label="なかよし ${progress.friendship} / 5">${[5,4,3,2,1].map((level) => `<i class="${level <= progress.friendship ? "is-earned" : ""}">♥</i>`).join("")}</span>`
        : `<span class="collection-card-status collection-card-energy" aria-label="エネルギー ${progress.energy} / ${requiredEnergyForStage(progress.stage)}"><i style="height:${Math.min(100, progress.energy / requiredEnergyForStage(progress.stage) * 100)}%"></i></span>`;
      const artPath = discovered ? answerArtworkPath(vehicle.index, formStage) : vehicleArtworkPath(0);
      const formClass = formStage === 2 ? "is-vehicle-form" : formStage === 3 ? "is-evolved-form is-robot-form" : "is-evolved-form";
      const grayscaleClass = formStage === 2 && !progress.friendly ? " is-pre-friendship" : "";
      const artwork = discovered ? `<img class="card-vehicle ${formClass}${grayscaleClass}" src="${artPath}" alt="" decoding="async">`
        : `<img class="card-vehicle card-silhouette-image" src="${vehicleArtworkPath(0)}" alt="" decoding="async">`;
      const medal = complete ? `<img class="card-master-medal-bg" src="${resultArtworkPath(vehicle.index, formStage, true)}" alt="" decoding="async">` : "";
      const isNew = showSessionMarkers && state.collectionNewVehicleIndexes.has(vehicle.index);
      const before = state.resultStartProgress[vehicle.index] || emptyVehicleProgress();
      const friendshipGrew = progress.friendship > before.friendship;
      const energyGrew = progress.stage === before.stage && progress.energy > before.energy;
      const isUp = showSessionMarkers && !isNew && (friendshipGrew || energyGrew);
      return `<button class="collection-card ${discovered ? "" : "locked"} ${complete ? "complete" : ""} ${isNew ? "is-new" : ""} ${isUp ? "is-up" : ""}" data-vehicle="${vehicle.index}" data-stage="${formStage}" aria-label="${discovered ? `${vehicle.nameEn}、進捗${formStage}` : "未発見"}" style="--card-color:${vehicle.color}">
        <span class="card-garage"></span><span class="vehicle-area">${medal}${artwork}</span>
        <span class="name-band"><span class="name-band-text">${discovered ? vehicle.nameEn : "???"}</span></span>
        ${discovered ? `<span class="card-rarity">${vehicle.rarityStars}</span>` : ""}${status}${isNew ? '<span class="collection-card-new-ribbon"><i>NEW</i></span>' : isUp ? '<span class="collection-card-up-ribbon"><i>UP</i></span>' : ""}</button>`;
    }).join("");
    document.querySelectorAll(".collection-card").forEach((card) => card.addEventListener("click", () => openVehicleDetail(Number(card.dataset.vehicle))));
  }
  function openVehicleDetail(index) { state.detailVehicleIndex = index; renderVehicleDetail(); showScreen("collection-detail-screen"); }
  function renderVehicleDetail() {
    const vehicleIndex = state.detailVehicleIndex;
    const vehicle = vehicles[vehicleIndex];
    const progress = vehicleProgress(vehicleIndex);
    const discovered = progress.discovered;
    const threeUp = discovered && progress.stage >= 4;
    const picture = $("detail-picture");
    const layout = $("detail-evolution-layout");
    const logo = $("detail-vehicle-logo");
    const vehicleArt = $("detail-vehicle-art");
    const robotArt = $("detail-robot-art");
    const superArt = $("detail-super-art");

    $("detail-background").src = playBackgroundPath(vehicleIndex);
    $("detail-background").alt = `${vehicle.nameJa}の背景`;
    picture.className = `detail-picture ${threeUp ? "is-three-up" : "is-two-up"}${discovered ? "" : " is-undiscovered"}`;
    logo.hidden = !discovered;
    layout.hidden = !discovered;
    if (!discovered) return;

    logo.src = vehicleLogoTitlePath(vehicleIndex);
    logo.alt = vehicle.nameEn;
    layout.className = `detail-evolution-layout ${threeUp ? "is-three-up" : "is-two-up"}`;
    vehicleArt.src = vehicleArtworkPath(vehicleIndex);
    vehicleArt.alt = vehicle.nameJa;
    vehicleArt.className = `detail-character${progress.friendly ? "" : " is-grayscale"}`;
    robotArt.src = robotArtworkPath(vehicleIndex);
    robotArt.alt = `${vehicle.nameJa}のロボット`;
    robotArt.className = `detail-character${progress.stage >= 3 ? "" : " is-silhouette"}`;
    $("detail-evolution-layout").querySelector(".detail-slot-super").hidden = !threeUp;
    $("detail-evolution-layout").querySelector(".detail-chevron-two").hidden = !threeUp;
    if (threeUp) {
      superArt.src = progress.stage >= 5 ? equippedSuperRobotArtworkPath(vehicleIndex) : superRobotArtworkPath(vehicleIndex);
      superArt.alt = progress.stage >= 5 ? `${vehicle.nameJa}のスペシャル装備付きスーパーロボット` : `${vehicle.nameJa}のスーパーロボット`;
    }
  }
  function moveVehicleDetail(direction) {
    state.detailVehicleIndex = (state.detailVehicleIndex + direction + vehicles.length) % vehicles.length; renderVehicleDetail();
  }

  let audioVisibilitySuspendTimer = null;
  let audioResumePromise = null;
  let audioMutedForBackground = false;
  function restoreAudioGainAfterVisibility() {
    const ctx = state.audio, gain = state.bgmGain;
    if (!audioMutedForBackground || !ctx || ctx.state !== "running" || document.hidden || !gain) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), ctx.currentTime);
    gain.gain.linearRampToValueAtTime(backgroundMusicVolume(), ctx.currentTime + 0.06);
    audioMutedForBackground = false;
  }
  function resumeAudioContext() {
    const ctx = state.audio;
    if (!ctx || ctx.state === "running" || ctx.state === "closed" || document.hidden) return;
    if (audioResumePromise) return audioResumePromise;
    try {
      audioResumePromise = Promise.resolve(ctx.resume()).finally(() => { audioResumePromise = null; });
      return audioResumePromise;
    } catch (_) {
      audioResumePromise = null;
    }
  }
  function suspendAudioForBackground(reason, { requireHidden = true, fadeMs = 80, suspendDelayMs = 100 } = {}) {
    const ctx = state.audio;
    if (!ctx || ctx.state === "closed") return;
    if (audioVisibilitySuspendTimer !== null) window.clearTimeout(audioVisibilitySuspendTimer);
    if (state.bgmGain && ctx.state === "running") {
      const gain = state.bgmGain.gain;
      gain.cancelScheduledValues(ctx.currentTime);
      gain.setValueAtTime(Math.max(0.0001, gain.value), ctx.currentTime);
      gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeMs / 1000);
      audioMutedForBackground = true;
    }
    audioVisibilitySuspendTimer = window.setTimeout(() => {
      audioVisibilitySuspendTimer = null;
      if ((requireHidden && !document.hidden) || !state.audio || state.audio.state === "closed" || state.audio.state === "suspended") return;
      try { state.audio.suspend(); } catch (_) {}
    }, suspendDelayMs);
  }
  function resumeAudioAfterVisible(reason) {
    if (audioVisibilitySuspendTimer !== null) {
      window.clearTimeout(audioVisibilitySuspendTimer);
      audioVisibilitySuspendTimer = null;
    }
    resumeAudioContext(reason);
    restoreAudioGainAfterVisibility();
  }
  function audioContext() {
    if (!state.audio) {
      state.audio = new (window.AudioContext || window.webkitAudioContext)();
      state.audio.addEventListener?.("statechange", () => {
        if (state.audio?.state === "running" && !document.hidden) restoreAudioGainAfterVisibility();
      });
    }
    if (state.audio.state === "suspended" && !document.hidden) resumeAudioContext();
    return state.audio;
  }
  function loadBgmEnabledPreference() {
    try { return localStorage.getItem(bgmConfig.storageKey) !== "false"; } catch (_) { return true; }
  }
  function backgroundMusicVolume() {
    return bgmConfig.normalVolume * (state.bgmDucked ? bgmConfig.rewardDuckMultiplier : 1);
  }
  function detectBgmLoopBounds(buffer) {
    const sampleRate = buffer.sampleRate;
    const maxTrimSamples = Math.min(Math.floor(sampleRate * 0.35), Math.floor(buffer.length * 0.08));
    const threshold = 0.0015;
    let first = 0, last = buffer.length;
    outerStart:
    for (let i = 0; i < maxTrimSamples; i += 1) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        if (Math.abs(buffer.getChannelData(channel)[i]) >= threshold) { first = Math.max(0, i - 32); break outerStart; }
      }
    }
    outerEnd:
    for (let i = buffer.length - 1; i >= buffer.length - maxTrimSamples; i -= 1) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        if (Math.abs(buffer.getChannelData(channel)[i]) >= threshold) { last = Math.min(buffer.length, i + 33); break outerEnd; }
      }
    }
    if (last - first < sampleRate) return { start: 0, end: buffer.duration };
    return { start: first / sampleRate, end: last / sampleRate };
  }
  function ensureBackgroundMusic() {
    if (state.bgmBuffer) return Promise.resolve(state.bgmBuffer);
    if (state.bgmBufferPromise) return state.bgmBufferPromise;
    const ctx = audioContext();
    state.bgmBufferPromise = fetch(bgmConfig.filePath)
      .then((response) => { if (!response.ok) throw new Error(bgmConfig.filePath); return response.arrayBuffer(); })
      .then((arrayBuffer) => decodeAudio(ctx, arrayBuffer))
      .then((buffer) => { state.bgmBuffer = buffer; return buffer; })
      .catch(() => null);
    return state.bgmBufferPromise;
  }
  function ensureBgmGain() {
    if (state.bgmGain) return state.bgmGain;
    const ctx = audioContext();
    const gain = ctx.createGain();
    gain.gain.value = backgroundMusicVolume();
    gain.connect(ctx.destination);
    state.bgmGain = gain;
    return gain;
  }
  function startDecodedBackgroundMusic(buffer) {
    if (!buffer || state.bgmSource || !canPlayBackgroundMusic()) return;
    const ctx = audioContext();
    const gain = ensureBgmGain();
    const source = ctx.createBufferSource();
    const bounds = detectBgmLoopBounds(buffer);
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = bounds.start;
    source.loopEnd = bounds.end;
    source.connect(gain);
    source.onended = () => {
      if (state.bgmSource === source) state.bgmSource = null;
    };
    state.bgmSource = source;
    source.start(0, bounds.start);
  }
  function updateBgmToggleButton() {
    const button = $("bgm-toggle-button");
    button.textContent = state.bgmEnabled ? "🔊" : "🔇";
    button.setAttribute("aria-pressed", String(state.bgmEnabled));
    button.setAttribute("aria-label", state.bgmEnabled ? "BGMをオフにする" : "BGMをオンにする");
  }
  function stopBackgroundMusic() {
    const source = state.bgmSource;
    state.bgmSource = null;
    if (source) {
      try { source.stop(); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
    }
    state.bgmDucked = false;
    if (state.bgmGain) state.bgmGain.gain.value = bgmConfig.normalVolume;
  }
  function setBackgroundMusicDucked(ducked) {
    state.bgmDucked = Boolean(ducked);
    if (state.bgmGain) {
      const ctx = audioContext();
      state.bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      state.bgmGain.gain.setTargetAtTime(backgroundMusicVolume(), ctx.currentTime, 0.025);
    }
  }
  function canPlayBackgroundMusic() {
    return !document.hidden && state.bgmEnabled && (state.phase === "initial" || state.phase === "retry") && Boolean(state.current) && $("play-screen").classList.contains("active");
  }
  function startBackgroundMusic() {
    if (!canPlayBackgroundMusic()) return;
    state.bgmPriming = false;
    setBackgroundMusicDucked(false);
    ensureBackgroundMusic().then((buffer) => startDecodedBackgroundMusic(buffer));
  }
  function primeBackgroundMusicFromGesture() {
    if (!state.bgmEnabled) return;
    // Decode the local MP3 into a Web Audio buffer after the child's explicit
    // gesture. BufferSource looping is sample-accurate, avoiding the audible
    // media-element restart gap at the end of the MP3.
    state.bgmPriming = true;
    audioContext();
    ensureBackgroundMusic().then((buffer) => {
      if (!state.bgmPriming) return;
      state.bgmPriming = false;
      if (buffer && canPlayBackgroundMusic()) startDecodedBackgroundMusic(buffer);
    });
  }
  function setBgmEnabled(enabled) {
    state.bgmEnabled = Boolean(enabled);
    try { localStorage.setItem(bgmConfig.storageKey, String(state.bgmEnabled)); } catch (_) {}
    updateBgmToggleButton();
    if (!state.bgmEnabled) stopBackgroundMusic();
    else startBackgroundMusic();
  }
  function toggleBackgroundMusic() { setBgmEnabled(!state.bgmEnabled); }
  function tone(frequency, start, duration, type = "sine", volume = .17) {
    const ctx = audioContext(), oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + start + duration);
    oscillator.connect(gain).connect(ctx.destination); oscillator.start(ctx.currentTime + start); oscillator.stop(ctx.currentTime + start + duration);
  }
  function decodeAudio(ctx, arrayBuffer) { return new Promise((resolve, reject) => ctx.decodeAudioData(arrayBuffer, resolve, reject)); }
  function preloadCorrectSounds() {
    if (state.correctSoundsLoading) return state.correctSoundsLoading;
    const ctx = audioContext();
    state.correctSoundsLoading = Promise.all(correctSoundPaths.map(async (path) => {
      const response = await fetch(path); if (!response.ok) throw new Error(path); return decodeAudio(ctx, await response.arrayBuffer());
    })).then((buffers) => { state.correctSoundBuffers = buffers; return buffers; }).catch(() => []);
    return state.correctSoundsLoading;
  }
  function preloadStartSound() { state.startSound = new Audio(startSoundPath); state.startSound.preload = "auto"; state.startSound.load(); }
  function playStartSound() { if (!state.startSound) preloadStartSound(); state.startSound.currentTime = 0; state.startSound.play().catch(() => {}); }
  function playCorrectSound() {
    const buffers = state.correctSoundBuffers;
    if (buffers.length !== correctSoundPaths.length) { preloadCorrectSounds(); tone(660, 0, .15, "sine", .364); tone(880, .16, .3, "sine", .364); return; }
    let index = Math.floor(Math.random() * buffers.length);
    if (buffers.length > 1 && index === state.lastCorrectSoundIndex) index = (index + 1) % buffers.length;
    state.lastCorrectSoundIndex = index;
    const ctx = audioContext(), source = ctx.createBufferSource(), gain = ctx.createGain(), compressor = ctx.createDynamicsCompressor();
    source.buffer = buffers[index]; gain.gain.value = 1.55; compressor.threshold.value = -10; compressor.ratio.value = 4;
    source.connect(gain).connect(compressor).connect(ctx.destination); source.start();
  }
  function playSimpleCorrectSound() { tone(880, 0, .12, "sine", .234); tone(1320, .14, .18, "sine", .234); }
  function playWrongSound() { tone(170, 0, .42, "sawtooth", .143); }
  // 数字カード専用の、各カードを押した瞬間の軽い入力フィードバック。
  // 問題クリアや他モードの正誤SEとは分離している。
  function playNumberCardCorrectSound() { tone(620, 0, .12, "sine", .238); tone(880, .065, .12, "sine", .179); }
  function playFinishSound() { tone(523, 0, .14); tone(659, .14, .14); tone(784, .28, .3); }
  function playCollectionEndSound() { tone(660, 0, .22, "sine", .12); tone(523, .2, .24, "sine", .12); tone(392, .4, .35, "sine", .1); }
  let developerResetInProgress = false;
  function closeDeveloperResetConfirm() {
    if (developerResetInProgress) return;
    $("developer-reset-confirm").hidden = true;
    $("developer-reset-button").focus();
  }
  function resetDeveloperUserData() {
    if (developerResetInProgress) return;
    developerResetInProgress = true;
    $("developer-reset-confirm-button").disabled = true;
    $("developer-reset-cancel").disabled = true;
    try {
      Object.values(storageKeys).forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error("Developer data reset failed", error);
      developerResetInProgress = false;
      $("developer-reset-confirm-button").disabled = false;
      $("developer-reset-cancel").disabled = false;
      return;
    }
    window.location.reload();
  }

  setupViewportDiagnostics();
  state.bgmEnabled = loadBgmEnabledPreference();
  updateBgmToggleButton();
  ensureBackgroundMusic();
  updateVersionLabelWithPreviewMetadata();
  resetStoredRecordsOnce(); resetRewardProgressOnce(); resetCollectionForV60Once(); resetTopCollectionAccessForV60Once(); resetRewardProgressPhase1Once(); const previewQaInitialVehicleIndex = seedPreviewQaProgressPreset(); loadRewardProgress(); loadRecentVehicles(); state.previewQaInitialVehicleIndex = previewQaInitialVehicleIndex; setNeutralBackground(); prepareInitialVehicle(); preloadImages(); preloadStartSound(); updateTopCollectionButton(); schedulePlayStageSize("initial");
  window.setInterval(updateTopCollectionButton, 60000);
  window.addEventListener("resize", () => schedulePlayStageSize("resize"));
  window.addEventListener("resize", scheduleCollectionStageSize);
  window.addEventListener("pageshow", (event) => {
    resumeAudioAfterVisible("pageshow");
    schedulePlayStageSize("pageshow");
  });
  window.addEventListener("pageshow", scheduleCollectionStageSize);
  window.addEventListener("orientationchange", () => schedulePlayStageSize("orientationchange"));
  window.addEventListener("orientationchange", scheduleCollectionStageSize);
  window.visualViewport?.addEventListener("resize", () => schedulePlayStageSize("visualViewport.resize"));
  window.visualViewport?.addEventListener("resize", scheduleCollectionStageSize);
  $("start-button").addEventListener("click", openModeSelect); $("mode-select-back").addEventListener("click", () => showFixedScreenWhenReady("start-screen")); $("mode-select-number-cards").addEventListener("click", startNumberCardApp); $("mode-select-counting-1").addEventListener("click", startCounting1App); $("mode-select-counting-2").addEventListener("click", startCounting2App); $("mode-select-multiplication").addEventListener("click", startMultiplicationApp); $("mode-select-multiplication-2x2").addEventListener("click", startTwoDigitMultiplicationApp); $("mode-select-normal").addEventListener("click", startApp); $("mode-select-long-division").addEventListener("click", startLongDivisionApp); $("again-button").addEventListener("click", () => { primeBackgroundMusicFromGesture(); beginRound(state.mode || "normal"); });
  $("top-collection-button").addEventListener("click", openTopCollection);
  $("finish-button").addEventListener("click", endToStart); $("quit-button").addEventListener("click", endToModeSelect); $("bgm-toggle-button").addEventListener("click", toggleBackgroundMusic);
  $("collection-button").addEventListener("click", openCollection); $("collection-exit").addEventListener("click", exitCollection);
  $("developer-reset-button").addEventListener("click", () => { $("developer-reset-confirm").hidden = false; $("developer-reset-cancel").focus(); });
  $("developer-reset-cancel").addEventListener("click", closeDeveloperResetConfirm);
  $("developer-reset-confirm-button").addEventListener("click", resetDeveloperUserData);
  $("collection-exit-no").addEventListener("click", closeCollectionExit);
  $("collection-exit-yes").addEventListener("click", () => { $("collection-exit-confirm").hidden = true; endToStart(); });
  document.querySelectorAll(".category-button").forEach((button) => button.addEventListener("click", () => setCollectionCategory(button.dataset.category)));
  $("detail-back").addEventListener("click", () => { sizeCollectionStage(); showScreen("collection-screen"); });
  document.querySelectorAll(".number-key").forEach((button) => button.addEventListener("click", () => inputNumber(button.dataset.number)));
  document.querySelectorAll(".counting-key").forEach((button) => button.addEventListener("click", () => inputCountingAnswer(Number(button.dataset.countingNumber))));
  $("clear-key").addEventListener("click", clearInput); $("long-division-skip-key").addEventListener("click", skipLongDivisionSlot); $("remainder-key").addEventListener("click", chooseRemainder); $("no-remainder-key").addEventListener("click", chooseNoRemainder);
  $("assist-button").addEventListener("click", useAssist);
  $("answer-confirm-back").addEventListener("click", closeAnswerConfirmation);
  $("answer-confirm-proceed").addEventListener("click", revealAnswer);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && state.confirmingAnswer) closeAnswerConfirmation(); });
  document.addEventListener("visibilitychange", () => {
    recordViewportDiagnostic("visibilitychange", { hidden: document.hidden });
    if (document.hidden) {
      suspendAudioForBackground("visibilitychange:hidden");
    } else {
      resumeAudioAfterVisible("visibilitychange:visible");
      schedulePlayStageSize("visibilitychange:visible");
      updateTopCollectionButton();
      checkQuestionTimeout();
    }
  });
  window.addEventListener("pagehide", (event) => {
    recordViewportDiagnostic("pagehide", { persisted: event.persisted });
  });
  window.addEventListener("blur", () => {
    // iOS can interrupt Web Audio before visibilitychange fires when switching
    // to another app. Fade and suspend on blur first so the OS handoff is silent.
    suspendAudioForBackground("blur", { requireHidden: false, fadeMs: 24, suspendDelayMs: 40 });
  });
  window.addEventListener("focus", () => {
    recordViewportDiagnostic("focus");
    resumeAudioAfterVisible("focus");
    checkQuestionTimeout();
  });
  document.addEventListener("pointerdown", () => {
    resumeAudioAfterVisible("pointerdown");
  }, { passive: true });
  document.addEventListener("touchstart", () => {
    resumeAudioAfterVisible("touchstart");
  }, { passive: true });
  let touchStartX = 0;
  $("detail-picture").addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
  $("detail-picture").addEventListener("touchend", (event) => {
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 55) moveVehicleDetail(delta > 0 ? -1 : 1);
  }, { passive: true });
})();
