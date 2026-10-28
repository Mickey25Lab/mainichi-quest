(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const appVersion = "0.3.52";
  const adminPin = "3710";
  // Separate parent and admin PIN settings intentionally. They happen to share
  // the same digits today, but can diverge later without changing either flow.
  const parentPin = "3710";
  const parentModeDefinitions = Object.freeze([
    Object.freeze({ id:"numbercards", label:"すうじあつめ", detail:"" }),
    Object.freeze({ id:"counting1", label:"かずかぞえ1", detail:"" }),
    Object.freeze({ id:"counting2", label:"かずかぞえ2", detail:"" }),
    Object.freeze({ id:"multiplication", label:"かけ算ひっ算", detail:"2けた×1けた" }),
    Object.freeze({ id:"multiplication2x2", label:"かけ算ひっ算", detail:"2けた×2けた その1（ヒントつき）" }),
    Object.freeze({ id:"multiplication2x2-unguided", label:"かけ算ひっ算", detail:"2けた×2けた その2" }),
    Object.freeze({ id:"multiplication2x2-zero", label:"かけ算ひっ算", detail:"2けた×2けた その3（2段目に0あり）" }),
    Object.freeze({ id:"normal", label:"わり算計算", detail:"" }),
    Object.freeze({ id:"longdivision", label:"わり算ひっ算", detail:"" }),
    Object.freeze({ id:"phonics-part-1", label:"フォニックス", detail:"パート1　A〜F" }),
    Object.freeze({ id:"phonics-part-2", label:"フォニックス", detail:"パート2　G〜K" }),
    Object.freeze({ id:"phonics-part-3", label:"フォニックス", detail:"パート3　L〜P" }),
    Object.freeze({ id:"phonics-part-4", label:"フォニックス", detail:"パート4　Q〜U" }),
    Object.freeze({ id:"phonics-part-5", label:"フォニックス", detail:"パート5　V〜Z" }),
    Object.freeze({ id:"phonics-review", label:"フォニックス", detail:"まとめ　A〜Z" })
  ]);
  const parentEnergyLevels = Object.freeze([
    Object.freeze({ id:"almost-zero", label:"ほぼ0" }),
    Object.freeze({ id:"small", label:"小" }),
    Object.freeze({ id:"medium", label:"中" }),
    Object.freeze({ id:"large", label:"大" })
  ]);
  const screens = ["start-screen", "mode-select-screen", "phonics-intro-screen", "phonics-youtube-screen", "play-screen", "transition-screen", "reward-screen", "result-screen", "collection-screen", "collection-detail-screen"];
  const fanfareSoundPaths = ["./assets/audio/correct-grand-fanfare.wav", "./assets/audio/correct-arcade-celebration.wav", "./assets/audio/correct-applause-cheer.wav"];
  const startSoundPath = "./assets/audio/warizan-start-powerup.wav";
  const startKeyVisualPath = "./assets/ui/top/top_key_visual.webp";
  const topBackgroundPath = "./assets/ui/top/top_background.webp";
  const topStartButtonPath = "./assets/ui/top/top_button_start.webp";
  const topCollectionButtonPath = "./assets/ui/top/top_button_collection.webp";
  const topCollectionUsedButtonPath = "./assets/ui/top/top_button_no_collection.webp";
  const modeSelectPath = "./assets/ui/top/mode_select_background.webp";
  // This is a playback-only technical proof of concept. It deliberately has no
  // score, progress, reward, storage, or collection integration.
  // Saved global settings from the rhythm review tool. A-1 is the only
  // manually adjusted exception; every other A-2-to-Z-2 frame is mechanical.
  const phonicsFrameSettings = Object.freeze({
    a1FrameSeconds: 4.59,
    followingFrameSeconds: 5.05,
    jumpEndOffsetSeconds: 0,
    jumpStartOffsetSeconds: 0.39,
    frameCount: 52
  });
  function roundPhonicsTime(seconds) { return Number(seconds.toFixed(2)); }
  function phonicsFrameAt(globalIndex, letter) {
    const start = globalIndex === 0
      ? 0
      : roundPhonicsTime(phonicsFrameSettings.a1FrameSeconds + (globalIndex - 1) * phonicsFrameSettings.followingFrameSeconds);
    const end = roundPhonicsTime(start + phonicsFrameSettings.followingFrameSeconds);
    return Object.freeze({
      id: `${letter}-${(globalIndex % 2) + 1}`,
      letter,
      start,
      jumpEnd: end,
      jumpStart: roundPhonicsTime(start + phonicsFrameSettings.jumpStartOffsetSeconds),
      end
    });
  }
  function phonicsFramesForLetters(letters, firstGlobalIndex) {
    return Object.freeze(letters.flatMap((letter, letterIndex) => [
      phonicsFrameAt(firstGlobalIndex + letterIndex * 2, letter),
      phonicsFrameAt(firstGlobalIndex + letterIndex * 2 + 1, letter)
    ]));
  }
  const phonicsPart1Frames = Object.freeze([
    // The review tool saved A-1 as -0.40 / 4.84 / 0.00 / 4.84. YouTube cannot
    // seek before zero, so playback begins at 0 while retaining the saved end.
    Object.freeze({ id:"A-1", letter:"A", sourceStart:-0.4, start:0, jumpEnd:4.84, jumpStart:0, end:4.84 }),
    ...phonicsFramesForLetters(["A", "B", "C", "D", "E", "F"], 0).slice(1)
  ]);
  const phonicsYoutubeLessons = Object.freeze({
    "part-1": Object.freeze({ id:"part-1", title:"フォニックス パート1（A〜F）", letters:"A〜F", frames:phonicsPart1Frames }),
    "part-2": Object.freeze({ id:"part-2", title:"フォニックス パート2（G〜K）", letters:"G〜K", frames:phonicsFramesForLetters(["G", "H", "I", "J", "K"], 12) }),
    "part-3": Object.freeze({ id:"part-3", title:"フォニックス パート3（L〜P）", letters:"L〜P", frames:phonicsFramesForLetters(["L", "M", "N", "O", "P"], 22) }),
    "part-4": Object.freeze({ id:"part-4", title:"フォニックス パート4（Q〜U）", letters:"Q〜U", frames:phonicsFramesForLetters(["Q", "R", "S", "T", "U"], 32) }),
    "part-5": Object.freeze({ id:"part-5", title:"フォニックス パート5（V〜Z）", letters:"V〜Z", frames:phonicsFramesForLetters(["V", "W", "X", "Y", "Z"], 42) }),
    "review": Object.freeze({ id:"review", title:"フォニックス まとめ（A〜Z）", letters:"A〜Z", uninterrupted:true, frames:Object.freeze([...phonicsPart1Frames, ...phonicsFramesForLetters("GHIJKLMNOPQRSTUVWXYZ".split(""), 12)]) })
  });
  let activePhonicsYoutubeLesson = phonicsYoutubeLessons["part-2"];
  const phonicsYoutubeConfig = Object.freeze({
    videoId: "ChqnN3cKzXQ",
    iframeApiUrl: "https://www.youtube.com/iframe_api",
    lessons: phonicsYoutubeLessons
  });
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
    modes: Object.freeze(["normal", "longdivision", "multiplication", "multiplication2x2", "multiplication2x2-unguided", "multiplication2x2-zero"]),
    limitMsByAnswerDigits: Object.freeze({ 1: 4000, 2: 5000, 3: 10000, 4: 15000, 5: 20000 })
  });
  // All screens share one preference and one Web Audio controller. Screens only
  // select a music group; the controller owns loading, switching, looping, and volume.
  const bgmConfig = Object.freeze({
    storageKey: "warizan-robot:bgm-enabled-v1",
    rewardDuckMultiplier: 0.30,
    transitionDurationSeconds: 0.5,
    tracks: Object.freeze({
      game: Object.freeze({ filePath: "./assets/audio/bgm_pynchon.mp3", normalVolume: 0.38 }),
      heroic: Object.freeze({ filePath: "./assets/audio/heroic_loop.wav", normalVolume: 0.18 }),
      collection: Object.freeze({ filePath: "./assets/audio/collection_sci_fi_loop.mp3", normalVolume: 0.18 })
    }),
    screenGroups: Object.freeze({
      "start-screen": "heroic",
      "mode-select-screen": "heroic",
      "phonics-intro-screen": "heroic",
      "play-screen": "game",
      "transition-screen": "game",
      "reward-screen": "game",
      "result-screen": "heroic",
      "collection-screen": "collection",
      "collection-detail-screen": "collection"
    })
  });
  const wrongFeedbackDurationMs = 500;
  const revealedAnswerDurationMs = 2000 * 2;
  // All interactive scenes use the native size of the delivered backgrounds.
  // Keeping this in one place avoids a second coordinate system creeping back
  // into play, phonics, or the collection garage.
  const stageCanvasWidth = 1400;
  const stageCanvasHeight = 1050;
  const collectionCategoryBackgroundPaths = Object.freeze({
    vehicle: "./assets/collection/category_backgrounds/01_vehicle_collection_background.webp",
    robot: "./assets/collection/category_backgrounds/02_robot_collection_background.webp",
    "super-robot": "./assets/collection/category_backgrounds/03_super_robot_collection_background.webp",
    equipment: "./assets/collection/category_backgrounds/05_special_equipment_collection_background.webp",
    medal: "./assets/collection/category_backgrounds/06_master_medal_collection_background.webp"
  });
  const vehicleCollectionRows = Object.freeze([
    Object.freeze({ ids:[16,17,18,19,20], size:160, contactY:360, centers:[354.4,527.2,700,872.8,1045.6] }),
    Object.freeze({ ids:[11,12,13,14,15], size:190, contactY:508, centers:[289.6,494.8,700,905.2,1110.4] }),
    Object.freeze({ ids:[6,7,8,9,10], size:220, contactY:689.3, centers:[224.8,462.4,700,937.6,1175.2] }),
    Object.freeze({ ids:[1,2,3,4,5], size:250, contactY:921.7, centers:[160,430,700,970,1240] })
  ]);
  const robotCollectionRows = Object.freeze([
    Object.freeze({ localIds:[9,10], size:205, contactY:349, centers:[520,880] }),
    Object.freeze({ localIds:[6,7,8], size:250, contactY:499, centers:[325,700,1075] }),
    Object.freeze({ localIds:[4,5], size:295, contactY:676, centers:[460,940] }),
    Object.freeze({ localIds:[1,2,3], size:340, contactY:908, centers:[250,700,1150] })
  ]);
  const superRobotCollectionSlots = Object.freeze([
    Object.freeze({ x:250, contactY:690, size:595, anchorY:.9338, shadowWidth:387, shadowHeight:54, shadowOffsetY:-7, shadowVariant:"front" }),
    Object.freeze({ x:870, contactY:690, size:595, anchorY:.9338, shadowWidth:387, shadowHeight:54, shadowOffsetY:-7, shadowVariant:"front", flip:true }),
    Object.freeze({ x:545, contactY:545, size:351, anchorY:.9338, shadowWidth:228, shadowHeight:32, shadowOffsetY:-7, shadowVariant:"rear" }),
    Object.freeze({ x:1180, contactY:545, size:351, anchorY:.9338, shadowWidth:228, shadowHeight:32, shadowOffsetY:-7, shadowVariant:"rear", flip:true })
  ]);
  const equipmentCollectionSlots = Object.freeze([
    Object.freeze({ x:385, contactY:700, size:430, anchorY:.5, shadowWidth:330, shadowHeight:120, shadowOffsetY:0 }),
    Object.freeze({ x:1015, contactY:700, size:430, anchorY:.5, shadowWidth:330, shadowHeight:120, shadowOffsetY:0 }),
    Object.freeze({ x:385, contactY:330, size:430, anchorY:.5, shadowWidth:330, shadowHeight:120, shadowOffsetY:0 }),
    Object.freeze({ x:1015, contactY:330, size:430, anchorY:.5, shadowWidth:330, shadowHeight:120, shadowOffsetY:0 })
  ]);
  const medalCollectionSlots = Object.freeze([805,615,420,230].flatMap((centerY) =>
    [230,465,700,935,1170].map((x) => Object.freeze({ x, contactY:centerY, size:140, anchorY:.5 }))
  ));
  const questionTimeoutMs = 5 * 60 * 1000;
  const rarityConfig = Object.freeze({
    normal: { label: "ノーマル", stars: "★", weight: 10 },
    special: { label: "スペシャル", stars: "★★", weight: 5 },
    rare: { label: "レア", stars: "★★★", weight: 2 },
    "super-rare": { label: "スーパーレア", stars: "★★★★", weight: 1 }
  });
  const profileStore = window.MQProfileStorage.createProfileStorage(window.localStorage);
  let capsuleSpendPending = false;
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
  const answerArtCanvasScales = [0, 0, 0.39, 0.36];
  // Patrol-car measurement on the 768 canvas: (768 - 170.8708134) / (768 - 229.0526316).
  // This one factor is shared by all equipped-super-robot display surfaces.
  const equippedSuperRobotEyeScale = 1.1079545454545456;
  document.documentElement.style.setProperty("--equipped-super-robot-eye-scale", String(equippedSuperRobotEyeScale));
  // These settings plus the one shared eye scale are the only placement inputs
  // for the two super-robot series. They deliberately describe the full square
  // image canvas; vehicle identity and visible alpha bounds never participate.
  const superRobotDisplaySettings = Object.freeze({
    answer: Object.freeze({
      superRobot: Object.freeze({ scale:0.55, x:138.15, y:278.3 }),
      superRobotEquipped: Object.freeze({ scale:0.55, x:138.15, y:278.3 })
    }),
    collectionDetail: Object.freeze({
      superRobot: Object.freeze({ scale:2, x:"10.5%", y:"8%" }),
      superRobotEquipped: Object.freeze({ scale:2 * equippedSuperRobotEyeScale, x:"10.5%", y:"8%" })
    })
  });
  const listedTwoDigitQuotientProblems = [
    [20, 2], [22, 2], [24, 2], [26, 2], [28, 2], [40, 2], [42, 2], [44, 2], [46, 2], [48, 2],
    [60, 2], [62, 2], [64, 2], [66, 2], [68, 2], [80, 2], [82, 2], [84, 2], [86, 2], [88, 2],
    [30, 3], [33, 3], [36, 3], [39, 3], [60, 3], [63, 3], [66, 3], [69, 3],
    [90, 3], [93, 3], [96, 3], [99, 3], [40, 4], [44, 4], [48, 4], [80, 4], [84, 4], [88, 4]
  ];

  const state = {
    questions: [], queue: [], current: null, phase: "start", initialIndex: 0, initialCorrect: 0,
    missed: [], startedAt: 0, finalElapsedMs: 0, timerId: null, timerPaused: false, timerPausedAt: 0, pausedTimerMs: 0,
    transitioning: false, confirmingAnswer: false, confirmingQuit: false, runId: 0,
    inputMode: "quotient", quotientInput: "", remainderInput: "", fanfareSoundBuffers: [],
    fanfareSoundsLoading: null, lastFanfareSoundIndex: -1, startSound: null,
    collection: Array(20).fill(0), rewardProgress: [], currentVehicleIndex: 0, currentStage: 1, preparedInitialVehicleIndex: null,
    recentVehicleHistory: [], sessionUnlocks: [0, 0, 0, 0, 0, 0], sessionResultGets: [], resultStartProgress: [], collectionNewVehicleIndexes: new Set(), collectionUsed: false, collectionShowSessionMarkers: true,
    collectionDeadline: 0, collectionTimerId: null, collectionClosing: false, detailVehicleIndex: 0, preparedNextQuestionVisual: null, pendingNextVehicleOverlay: null,
    questionDeadline: 0, questionTimeoutId: null, idleGuideTimer: null, retryAutoStartTimer: null, correctStreak: 0, vehicleChallengeQuestionCount: 0,
    energyDisplayOverride: null, collectionCategory: "summary", collectionCategoryPage: 0, collectionSwipeStartX: null, collectionNewCategoryKeys: new Set(),
    collectionMode: "browse", phonicsRewardSelectedVehicleIndex: null, phonicsLastRewardVehicleIndex: null, phonicsScanInProgress: false,
    mode: "normal", longDivision: null, numberCards: null, multiplication: null, multiplication2x2: null,
    bgmBuffers: Object.create(null), bgmBufferPromises: Object.create(null), bgmSource: null, bgmGain: null, bgmEnabled: true, bgmDucked: false, bgmGroup: null, desiredBgmGroup: null, bgmRequestId: 0, bgmTransitionId: 0, bgmFadeTimer: null
  };

  function emptyVehicleProgress() { return { discovered: false, friendship: 0, friendly: false, stage: 1, energy: 0, masterMedal: false }; }
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
      const saved = profileStore.getRewardProgress();
      if (Array.isArray(saved) && saved.length === vehicles.length) state.rewardProgress = saved.map(normalizeVehicleProgress);
      else {
        const legacyCollection = profileStore.getCollectionStages();
        if (Array.isArray(legacyCollection) && legacyCollection.length === vehicles.length && legacyCollection.some((value) => Number(value) > 0)) {
          const converted = window.MQProfileStorage.rewardProgressFromCollectionStages(legacyCollection);
          state.rewardProgress = converted.map(normalizeVehicleProgress);
          profileStore.setRewardProgress(state.rewardProgress);
        }
      }
    } catch (_) {}
    syncCollectionFromRewardProgress();
  }
  // Unfinished rounds modify only the in-memory working state.
  let roundTransaction = null;
  function discardRoundTransaction() {
    if (!roundTransaction) return;
    state.rewardProgress = roundTransaction.rewardProgress;
    state.collection = roundTransaction.collection;
    state.recentVehicleHistory = roundTransaction.recentVehicleHistory;
    roundTransaction = null;
    capsuleSpendPending = false;
  }
  function beginRoundTransaction() {
    discardRoundTransaction();
    roundTransaction = {
      profileId: profileStore.getActiveProfileId(),
      rewardProgress: state.rewardProgress.map((entry) => ({ ...entry })),
      collection: [...state.collection],
      recentVehicleHistory: [...state.recentVehicleHistory],
      acquisitionHistory: []
    };
  }
  function commitRoundTransaction() {
    const pending = roundTransaction;
    if (!pending) return;
    if (pending.profileId !== profileStore.getActiveProfileId()) {
      discardRoundTransaction();
      throw new Error("Active profile changed during a round");
    }
    roundTransaction = null;
    saveCollectionProgress();
    saveRecentVehicles();
    for (const acquisition of pending.acquisitionHistory) {
      try { profileStore.appendAcquisitionHistory(acquisition); }
      catch (error) { console.error("Acquisition history save failed", error); }
    }
  }
  let questBonusSelecting = false;
  let questBonusClaimPendingDate = null;
  let questBonusSelectionDate = null;
  let questBonusSelectionProfileId = null;
  let questBonusTimerId = null;
  let questBonusDeadline = 0;
  function stopQuestBonusTimer() {
    if (questBonusTimerId !== null) window.clearInterval(questBonusTimerId);
    questBonusTimerId = null;
    questBonusDeadline = 0;
  }
  function updateQuestBonusTimer() {
    if (!questBonusSelecting || questBonusDeadline === 0) { stopQuestBonusTimer(); return; }
    const remaining = Math.max(0, Math.ceil((questBonusDeadline - Date.now()) / 1000));
    const displayed = remaining <= 10 ? remaining : Math.ceil(remaining / 10) * 10;
    $("collection-seconds").textContent = String(displayed);
    if (remaining !== 0) return;
    stopQuestBonusTimer();
    const candidates = collectionDisplayOrder.filter(index => vehicleProgress(index).discovered);
    if (!candidates.length) return;
    $("phonics-grow-confirm").hidden = true;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    void runPhonicsCrossScan({selectedVehicleIndex:choice,skipSearch:true});
  }
  function startQuestBonusTimer() {
    stopQuestBonusTimer();
    questBonusDeadline = Date.now() + 30000;
    updateQuestBonusTimer();
    questBonusTimerId = window.setInterval(updateQuestBonusTimer, 200);
  }
  function saveRewardProgress() {
    if (roundTransaction) return;
    // QA presets must never become permanent player points.
    if (qaProgressModeEnabled()) {
      profileStore.setRewardProgress(state.rewardProgress);
      capsuleSpendPending = false; // QA capsules are virtual and never deducted.
      return;
    }
    profileStore.commitRewardProgressWithPoints(state.rewardProgress, { consumeEnergyCapsule: capsuleSpendPending, questBonusClaimDate: questBonusClaimPendingDate });
    questBonusClaimPendingDate = null;
    capsuleSpendPending = false;
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
  function requiredEnergyForStage(stage) { return ({ 2: 30, 3: 50, 4: 100, 5: 200 })[stage] || 0; }
  function energyStageForRequired(required) { return ({ 30: 2, 50: 3, 100: 4, 200: 5 })[required] || 0; }
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
      const saved = profileStore.getCollectionStages();
      if (Array.isArray(saved) && saved.length === 20) state.collection = saved.map((value) => Math.max(0, Math.min(5, Number(value) || 0)));
    } catch (_) {}
  }
  function saveCollection() {
    if (roundTransaction) return;
    try { profileStore.setCollectionStages(state.collection); } catch (_) {}
  }
  function qaProgressModeEnabled() {
    return profileStore.getActiveQaState().qaEnabled === true;
  }
  function availableEnergyCapsuleCount() {
    return qaProgressModeEnabled() ? 10 : profileStore.getEnergyCapsuleCount();
  }
  function updateAdminQaToggle() {
    const toggle = $("admin-qa-toggle");
    const enabled = qaProgressModeEnabled();
    toggle.setAttribute("aria-checked", String(enabled));
    toggle.querySelector("span").textContent = enabled ? "ON" : "OFF";
  }
  function restoreQaProgressBackup() {
    try {
      const qaState = profileStore.getActiveQaState();
      if (!qaState.backupInitialized) return;
      const snapshot = qaState.progressBackup || {
        rewardProgress: qaState.rewardProgressBackup ?? null,
        collection: null
      };
      profileStore.restoreProgressSnapshot(snapshot);
      profileStore.setActiveQaState({});
    } catch (_) {}
  }
  function toggleQaProgressMode() {
    if (qaProgressModeEnabled()) {
      restoreQaProgressBackup();
    } else {
      // QA progress snapshots and the QA enable flag are isolated per profile.
      profileStore.setActiveQaState({ qaEnabled: true });
    }
    window.location.reload();
  }
  function seedPreviewQaProgressPreset() {
    if (!qaProgressModeEnabled()) return null;
    try {
      const qaState = profileStore.getActiveQaState();
      if (!qaState.backupInitialized) {
        qaState.backupInitialized = true;
        qaState.progressBackup = profileStore.getProgressSnapshot();
        profileStore.setActiveQaState(qaState);
      }
      if (qaState.presetApplied) return null;
      const preset = Array.from({ length: vehicles.length }, emptyVehicleProgress);
      const qaVehicleIndexes = collectionDisplayOrder.slice(0, 20);
      const progressStates = [
        null,
        { discovered: true, friendship: 4, friendly: false, stage: 2, energy: 0, masterMedal: false },
        { discovered: true, friendship: 5, friendly: true, stage: 2, energy: 23, masterMedal: false },
        { discovered: true, friendship: 5, friendly: true, stage: 3, energy: 39, masterMedal: false },
        { discovered: true, friendship: 5, friendly: true, stage: 4, energy: 55, masterMedal: false },
        { discovered: true, friendship: 5, friendly: true, stage: 5, energy: 79, masterMedal: false },
        { discovered: true, friendship: 5, friendly: true, stage: 5, energy: 100, masterMedal: true }
      ];
      qaVehicleIndexes.forEach((vehicleIndex, displayIndex) => {
        const progress = progressStates[displayIndex % progressStates.length];
        if (progress) preset[vehicleIndex] = progress;
      });
      profileStore.setRewardProgress(preset);
      qaState.presetApplied = true;
      profileStore.setActiveQaState(qaState);
      return qaVehicleIndexes[3];
    } catch (_) { return null; }
  }
  function loadRecentVehicles() {
    try {
      const saved = profileStore.getRecentVehicles();
      if (Array.isArray(saved)) state.recentVehicleHistory = saved.filter((id) => Number.isInteger(id) && id >= 0 && id < vehicles.length).slice(-3);
    } catch (_) {}
  }
  function saveRecentVehicles() {
    if (roundTransaction) return;
    try { profileStore.setRecentVehicles(state.recentVehicleHistory); } catch (_) {}
  }
  function getBestTime() {
    try {
      const value = Number(profileStore.getBestTime());
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch (_) { return null; }
  }
  function saveBestTime(ms) {
    try { profileStore.setBestTime(ms); } catch (_) {}
  }
  function japanDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  function topCollectionAlreadyUsedToday() {
    if (qaProgressModeEnabled()) return false;
    try { return profileStore.getTopCollectionLastUsedJst() === japanDateKey(); } catch (_) { return false; }
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
    try { profileStore.setTopCollectionLastUsedJst(japanDateKey()); } catch (_) {}
    const button = $("top-collection-button");
    button.disabled = true;
    openCollection({ showSessionMarkers: false });
  }
  function showScreen(id) {
    recordBgmDiagnostic("screen-change-request", { screenId: id });
    screens.forEach((screenId) => $(screenId).classList.toggle("active", screenId === id));
    if (id === "start-screen" && gameInitialized) {
      prepareLevelCelebration();
      // The next TOP visit, including navigation back from another screen,
      // acknowledges a newly reached level without requiring an app restart.
      // Initial loading still waits for the startup-finished event.
      if ($("startup-loader")?.hidden) openPendingLevelCelebration();
    }
    setDesiredBgmGroup(bgmConfig.screenGroups[id] || null);
    recordVisualDiagnostic("show-screen", { screenId: id });
  }
  function showRewardOverPlay() {
    screens.forEach((screenId) => $(screenId).classList.toggle("active", screenId === "play-screen" || screenId === "reward-screen"));
    setDesiredBgmGroup("game");
  }
  function showRewardOverCollection() {
    screens.forEach((screenId) => $(screenId).classList.toggle("active", screenId === "collection-screen" || screenId === "reward-screen"));
    setDesiredBgmGroup("collection");
  }
  const phonicsYoutube = {
    player: null, apiPromise: null, checkpointPollId: 0,
    started: false, ready: false, autoStartPending: false,
    frameIndex: 0, pass: "first", activeModeId: null, backgroundPath: null, rewardAlmostZero: false,
    introMinimumElapsed: false, introTimerId: 0,
    countdownTimerId: 0, countdownValue: 0
  };
  function phonicsYoutubeActive() { return $("phonics-youtube-screen").classList.contains("active"); }
  function setPhonicsYoutubeStatus(message, practice = false) {
    const status = $("phonics-youtube-status");
    status.textContent = message;
    status.classList.toggle("is-practice", practice);
  }
  function stopPhonicsYoutubePolling() {
    if (phonicsYoutube.checkpointPollId) window.clearInterval(phonicsYoutube.checkpointPollId);
    phonicsYoutube.checkpointPollId = 0;
  }
  function cancelPhonicsYoutubePrompt() {
    $("phonics-youtube-status").classList.remove("is-practice");
  }
  function youtubePlayerState(name) { return window.YT?.PlayerState?.[name]; }
  function currentPhonicsYoutubeFrame() { return activePhonicsYoutubeLesson.frames[phonicsYoutube.frameIndex] || null; }
  function phonicsYoutubeFrameMessage(frame, pass = phonicsYoutube.pass) {
    if (activePhonicsYoutubeLesson.uninterrupted) return "A〜Zをつづけて再生しています。";
    if (!frame) return "";
    return pass === "first"
      ? `${frame.id} を再生しています。`
      : `${frame.id} をもう一度再生しています。`;
  }
  function finishPhonicsYoutubeSequence() {
    stopPhonicsYoutubePolling();
    phonicsYoutube.started = false;
    phonicsYoutube.pass = "complete";
    try { phonicsYoutube.player?.pauseVideo?.(); } catch (_) {}
    setPhonicsYoutubeStatus(`${activePhonicsYoutubeLesson.title}が終わりました。`);
    $("phonics-youtube-start").hidden = true;
    $("phonics-youtube-end").hidden = false;
    $("phonics-youtube-end").classList.remove("is-pending");
  }
  function runPhonicsYoutubeCheckpointPoll() {
    stopPhonicsYoutubePolling();
    if (activePhonicsYoutubeLesson.uninterrupted) return; // Full A-Z: no seek, pause or repeat.
    phonicsYoutube.checkpointPollId = window.setInterval(() => {
      const player = phonicsYoutube.player;
      if (!player || !phonicsYoutubeActive() || !phonicsYoutube.started) return;
      if (player.getPlayerState?.() !== youtubePlayerState("PLAYING")) return;
      const currentTime = Number(player.getCurrentTime?.()) || 0;

      const frame = currentPhonicsYoutubeFrame();
      if (!frame) { finishPhonicsYoutubeSequence(); return; }

      if (phonicsYoutube.pass === "first" && currentTime >= frame.jumpEnd) {
        // Only the repeat uses a seek. The second pass deliberately continues
        // into the next frame without pausing or seeking, preserving the chant.
        phonicsYoutube.pass = "second";
        player.seekTo?.(frame.jumpStart, true);
        setPhonicsYoutubeStatus(phonicsYoutubeFrameMessage(frame), true);
        return;
      }
      if (phonicsYoutube.pass === "second" && currentTime >= frame.end) {
        phonicsYoutube.frameIndex += 1;
        if (!currentPhonicsYoutubeFrame()) { finishPhonicsYoutubeSequence(); return; }
        phonicsYoutube.pass = "first";
        setPhonicsYoutubeStatus(phonicsYoutubeFrameMessage(currentPhonicsYoutubeFrame()));
      }
    }, 50);
  }
  function onPhonicsYoutubeStateChange(event) {
    const stateCode = event.data;
    if (stateCode === youtubePlayerState("PLAYING")) {
      if (phonicsYoutube.started) {
        setPhonicsYoutubeStatus(phonicsYoutubeFrameMessage(currentPhonicsYoutubeFrame()));
        runPhonicsYoutubeCheckpointPoll();
      }
      return;
    }
    if (stateCode === youtubePlayerState("PAUSED")) {
      stopPhonicsYoutubePolling();
      if (phonicsYoutube.started) setPhonicsYoutubeStatus("一時停止中です。プレーヤーの再生ボタンで続けられます。");
      return;
    }
    if (stateCode === youtubePlayerState("ENDED")) {
      finishPhonicsYoutubeSequence();
    }
  }
  function loadPhonicsYoutubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (phonicsYoutube.apiPromise) return phonicsYoutube.apiPromise;
    phonicsYoutube.apiPromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        if (window.YT?.Player) resolve(window.YT);
        else reject(new Error("YouTube IFrame Player API did not provide a player."));
      };
      const script = document.createElement("script");
      script.src = phonicsYoutubeConfig.iframeApiUrl;
      script.async = true;
      script.onerror = () => reject(new Error("YouTube IFrame Player API could not be loaded."));
      document.head.appendChild(script);
    });
    return phonicsYoutube.apiPromise;
  }
  function createPhonicsYoutubePlayer() {
    if (phonicsYoutube.player) return Promise.resolve(phonicsYoutube.player);
    setPhonicsYoutubeStatus("動画を準備しています…");
    $("phonics-youtube-start").disabled = true;
    return loadPhonicsYoutubeApi().then(() => new Promise((resolve) => {
      phonicsYoutube.player = new window.YT.Player("phonics-youtube-player", {
        videoId: phonicsYoutubeConfig.videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          start: activePhonicsYoutubeLesson.frames[0].start,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            phonicsYoutube.ready = true;
            $("phonics-youtube-start").disabled = false;
            updatePhonicsIntroReadyState();
            const iframe = phonicsYoutube.player?.getIframe?.();
            iframe?.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
            resolve(phonicsYoutube.player);
            if (phonicsYoutubeActive() && phonicsYoutube.autoStartPending) {
              startPhonicsYoutubeAutomatically();
            } else {
              setPhonicsYoutubeStatus("動画の準備ができました。");
            }
          },
          onStateChange: onPhonicsYoutubeStateChange,
          onAutoplayBlocked: () => {
            if (!phonicsYoutubeActive()) return;
            phonicsYoutube.autoStartPending = false;
            setPhonicsYoutubeStatus("自動再生がブロックされました。「再生する」を押してください。");
            $("phonics-youtube-start").hidden = false;
          }
        }
      });
    })).catch((error) => {
      console.error("Phonics YouTube player setup failed", error);
      setPhonicsYoutubeStatus("動画を準備できませんでした。ネットワーク設定を確認してください。");
      $("phonics-youtube-start").disabled = true;
      if ($("phonics-intro-screen").classList.contains("active")) {
        $("phonics-intro-status").textContent = "動画を準備できませんでした。もう一度やりなおしてね。";
      }
    });
  }
  function preparePhonicsYoutubePlayback() {
    createPhonicsYoutubePlayer();
  }
  function beginPhonicsYoutubePlayback() {
    if (!phonicsYoutube.player) return;
    phonicsYoutube.started = true;
    phonicsYoutube.autoStartPending = false;
    phonicsYoutube.frameIndex = 0;
    phonicsYoutube.pass = "first";
    $("phonics-youtube-start").hidden = true;
    $("phonics-youtube-end").hidden = false;
    $("phonics-youtube-end").classList.add("is-pending");
    setPhonicsYoutubeStatus(phonicsYoutubeFrameMessage(currentPhonicsYoutubeFrame()));
    phonicsYoutube.player.seekTo?.(activePhonicsYoutubeLesson.frames[0].start, true);
    phonicsYoutube.player.playVideo();
  }
  function startPhonicsYoutubeAutomatically() {
    if (!phonicsYoutubeActive()) return;
    if (!phonicsYoutube.player || !phonicsYoutube.ready) {
      phonicsYoutube.autoStartPending = true;
      setPhonicsYoutubeStatus("動画を準備しています…");
      createPhonicsYoutubePlayer();
      return;
    }
    beginPhonicsYoutubePlayback();
  }
  function selectPhonicsYoutubeLesson(lessonId) {
    const lesson = phonicsYoutubeConfig.lessons[lessonId];
    if (!lesson) return false;
    activePhonicsYoutubeLesson = lesson;
    $("phonics-youtube-screen").setAttribute("aria-label", lesson.title);
    return true;
  }
  function phonicsLessonLetters() {
    const seen = [];
    activePhonicsYoutubeLesson.frames.forEach((frame) => {
      if (!seen.includes(frame.letter)) seen.push(frame.letter);
    });
    return seen;
  }
  function phonicsLessonLettersText() {
    return phonicsLessonLetters().join("、");
  }
  function renderPhonicsIntroLetters() {
    const container = $("phonics-intro-letters");
    // The full A-Z review needs a compact heading instead of 26 oversized chips.
    const letters = activePhonicsYoutubeLesson.uninterrupted ? ["A〜Z"] : phonicsLessonLetters();
    container.replaceChildren();
    letters.forEach((letter, index) => {
      const value = document.createElement("span");
      value.className = "phonics-intro-letter";
      value.textContent = letter;
      container.append(value);
    });
    container.setAttribute("aria-label", letters.join("、"));
  }
  function clearPhonicsIntroTimer() {
    if (phonicsYoutube.introTimerId) window.clearTimeout(phonicsYoutube.introTimerId);
    phonicsYoutube.introTimerId = 0;
  }
  function clearPhonicsCountdown() {
    if (phonicsYoutube.countdownTimerId) window.clearTimeout(phonicsYoutube.countdownTimerId);
    phonicsYoutube.countdownTimerId = 0;
    phonicsYoutube.countdownValue = 0;
    const overlay = $("phonics-countdown");
    if (overlay) overlay.hidden = true;
  }
  function renderPhonicsCountdownTick(value) {
    const overlay = $("phonics-countdown");
    const number = $("phonics-countdown-number");
    const progress = $("phonics-countdown-progress");
    overlay.hidden = false;
    number.textContent = String(value);
    progress.classList.remove("is-running");
    void progress.getBoundingClientRect();
    progress.classList.add("is-running");
  }
  function finishPhonicsIntroCountdown() {
    clearPhonicsCountdown();
    showScreen("phonics-youtube-screen");
    $("phonics-youtube-start").hidden = true;
    $("phonics-youtube-end").hidden = false;
    $("phonics-youtube-end").classList.add("is-pending");
    $("phonics-youtube-start").disabled = false;
    $("phonics-youtube-status").classList.remove("is-practice");
    beginPhonicsYoutubePlayback();
  }
  function startPhonicsIntroCountdown() {
    clearPhonicsCountdown();
    phonicsYoutube.countdownValue = 3;
    renderPhonicsCountdownTick(3);
    const advance = () => {
      phonicsYoutube.countdownValue -= 1;
      if (phonicsYoutube.countdownValue <= 0) {
        finishPhonicsIntroCountdown();
        return;
      }
      renderPhonicsCountdownTick(phonicsYoutube.countdownValue);
      phonicsYoutube.countdownTimerId = window.setTimeout(advance, 1000);
    };
    phonicsYoutube.countdownTimerId = window.setTimeout(advance, 1000);
  }
  function updatePhonicsIntroReadyState() {
    const button = $("phonics-intro-start");
    const status = $("phonics-intro-status");
    if (!button || !status) return;
    const ready = phonicsYoutube.introMinimumElapsed && phonicsYoutube.ready && Boolean(phonicsYoutube.player);
    button.disabled = !ready;
    button.textContent = ready ? "やってみる！" : "ちょっとまってね";
    status.textContent = "";
  }
  function showPhonicsIntro(lessonId, modeId) {
    if (!isModeAvailableForMission(modeId)) { renderModeSelectMission(); return; }
    if (!selectPhonicsYoutubeLesson(lessonId)) return;
    phonicsYoutube.activeModeId = modeId;
    beginDailyMissionAttempt(modeId);
    const missionAtStart = missionOverview();
    phonicsYoutube.rewardAlmostZero = missionAtStart.allComplete
      && missionAtStart.freePlayEnabled
      && missionAtStart.freePlayEnergyMode === "almost-zero";
    phonicsYoutube.introMinimumElapsed = false;
    clearPhonicsIntroTimer();
    $("phonics-intro-kicker").textContent = activePhonicsYoutubeLesson.title.replace(/（.*$/, "");
    renderPhonicsIntroLetters();
    const phonicsBackgroundPath = playBackgroundPath(Math.floor(Math.random() * vehicles.length));
    phonicsYoutube.backgroundPath = phonicsBackgroundPath;
    $("phonics-intro-background").src = phonicsBackgroundPath;
    document.querySelector(".phonics-youtube-background").src = phonicsBackgroundPath;
    $("phonics-intro-start").disabled = true;
    $("phonics-intro-start").textContent = "ちょっとまってね";
    $("phonics-intro-status").textContent = "";
    showScreen("phonics-intro-screen");
    schedulePlayStageSize("phonics-intro");
    preparePhonicsYoutubePlayback();
    preloadFanfareSounds();
    phonicsYoutube.introTimerId = window.setTimeout(() => {
      phonicsYoutube.introTimerId = 0;
      phonicsYoutube.introMinimumElapsed = true;
      updatePhonicsIntroReadyState();
    }, 3000);
  }
  function startPhonicsFromIntroGesture() {
    if (!phonicsYoutube.ready || !phonicsYoutube.player || !phonicsYoutube.introMinimumElapsed) return;
    clearPhonicsIntroTimer();
    // Prime the iframe while this click still counts as a user gesture on iPad Safari.
    // The actual lesson remains hidden and paused until the silent 3-2-1 countdown ends.
    try {
      phonicsYoutube.player.seekTo?.(activePhonicsYoutubeLesson.frames[0].start, true);
      phonicsYoutube.player.playVideo?.();
      phonicsYoutube.player.pauseVideo?.();
    } catch (_) {}
    phonicsYoutube.started = false;
    startPhonicsIntroCountdown();
  }
  function leavePhonicsIntro() {
    clearPhonicsIntroTimer();
    clearPhonicsCountdown();
    phonicsYoutube.introMinimumElapsed = false;
    phonicsYoutube.activeModeId = null;
    renderModeSelectMission();
    showFixedScreenWhenReady("mode-select-screen");
  }
  function startPhonicsYoutubeFromGesture() {
    beginPhonicsYoutubePlayback();
  }
  function stopAndDestroyPhonicsYoutube() {
    clearPhonicsIntroTimer();
    clearPhonicsCountdown();
    stopPhonicsYoutubePolling();
    cancelPhonicsYoutubePrompt();
    if (phonicsYoutube.player) {
      try { phonicsYoutube.player.stopVideo?.(); phonicsYoutube.player.destroy?.(); } catch (_) {}
    }
    phonicsYoutube.player = null;
    phonicsYoutube.started = false;
    phonicsYoutube.ready = false;
    phonicsYoutube.autoStartPending = false;
    phonicsYoutube.frameIndex = 0;
    phonicsYoutube.pass = "first";
    $("phonics-youtube-player").replaceChildren();
  }
  function leavePhonicsYoutube() {
    cancelDailyMissionAttempt();
    stopAndDestroyPhonicsYoutube();
    phonicsYoutube.activeModeId = null;
    renderModeSelectMission();
    showFixedScreenWhenReady("mode-select-screen");
    // Recreate and preload the player for the next phonics entry. Without this,
    // the second visit has to create the iframe after the mode tap, so Safari
    // sees playVideo() after the user-gesture window has expired and blocks it.
    preparePhonicsYoutubePlayback();
  }
  function completePhonicsYoutubeAndLeave() {
    if (phonicsYoutube.activeModeId) completeDailyMissionRound(phonicsYoutube.activeModeId);
    stopAndDestroyPhonicsYoutube();
    phonicsYoutube.activeModeId = null;
    openPhonicsRewardSelection();
  }
  function pausePhonicsYoutubeForLifecycle() {
    if (!phonicsYoutubeActive() || !phonicsYoutube.player) return;
    cancelPhonicsYoutubePrompt();
    stopPhonicsYoutubePolling();
    if (phonicsYoutube.player.getPlayerState?.() === youtubePlayerState("PLAYING")) {
      phonicsYoutube.player.pauseVideo();
      setPhonicsYoutubeStatus("一時停止中です。戻ったらプレーヤーの再生ボタンで続けられます。");
    }
  }
  function stageScaleFor(width, height) {
    return Math.min(width / stageCanvasWidth, height / stageCanvasHeight);
  }
  function sizeStages({ width, height, includePlay = false, includeCollection = false }) {
    const scale = stageScaleFor(width, height);
    if (includePlay) {
      $("mode-select-screen").style.setProperty("--mode-dialog-scale", String(scale));
      document.querySelector(".start-layer")?.style.setProperty("--stage-scale", String(scale));
      document.querySelector(".mode-select-stage")?.style.setProperty("--stage-scale", String(scale));
      document.querySelector(".collection-detail-stage")?.style.setProperty("--stage-scale", String(scale));
      document.querySelector(".collection-detail-stage")?.style.setProperty("--stage-scale-inverse", String(scale > 0 ? 1 / scale : 1));
      $("play-stage").style.setProperty("--stage-scale", String(scale));
      $("phonics-intro-stage")?.style.setProperty("--stage-scale", String(scale));
      $("phonics-youtube-stage")?.style.setProperty("--stage-scale", String(scale));
    }
    if (includeCollection) {
      // Navigation sits beside, not inside, the scaled canvas. Give both
      // collection screens the same validated scale as the main stage.
      document.querySelectorAll(".collection-screen, .collection-detail-screen").forEach(screen => {
        screen.style.setProperty("--collection-nav-scale", String(scale));
      });
      const stage = $("collection-stage");
      stage.style.setProperty("--stage-scale", String(scale));
      // Temporary aliases keep an older cached stylesheet at the same scale.
      stage.style.setProperty("--collection-scale", String(scale));
      // The collection timer intentionally keeps its existing on-screen size.
      const inverse = String(scale > 0 ? 1 / scale : 1);
      stage.style.setProperty("--stage-scale-inverse", inverse);
      stage.style.setProperty("--collection-scale-inverse", inverse);
    }
    return scale;
  }
  // All game canvases use one validated viewport and one resize scheduler.
  // Keep these wrappers for existing collection callers; never bypass the
  // Safari visualViewport zoom guard when sizing the garage.
  function sizeCollectionStage() {
    return sizePlayStage();
  }
  function scheduleCollectionStageSize() {
    schedulePlayStageSize("collection");
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
  const visualDiagnosticsEnabled = new URLSearchParams(window.location.search).get("visual-diagnostics") === "1";
  const visualDiagnosticsStorageKey = "mq-001:visual-diagnostics-v1";
  let visualDiagnostics = [];
  let visualDiagnosticSequence = 0;
  function visualPathKind(path) {
    if (!path) return "unknown";
    if (path.includes("/backgrounds/play/")) return "play background";
    if (path.includes("/collection/01_vehicle/")) return "01_vehicle";
    if (path.includes("/collection/02_robot/")) return "02_robot";
    if (path.includes("/collection/03_super_robot/")) return "03_super_robot";
    if (path.includes("/collection/04_super_robot_equipped/")) return "04_super_robot_equipped";
    if (path.includes("/speech_bubble/")) return "speech bubble";
    if (path.includes("mode_select_background")) return "mode select background";
    return "other";
  }
  function visualQueueSnapshot() {
    return { highQueue: decodeQueues.high.length, lowQueue: decodeQueues.low.length, activeDecodes, maxConcurrentDecodes };
  }
  function recordVisualDiagnostic(event, detail = {}) {
    if (!visualDiagnosticsEnabled) return;
    const entry = { sequence: ++visualDiagnosticSequence, ts: new Date().toISOString(), elapsedMs: Math.round(performance.now()), event, ...detail, queue: visualQueueSnapshot() };
    visualDiagnostics.push(entry);
    if (visualDiagnostics.length > 800) visualDiagnostics = visualDiagnostics.slice(-800);
    try { localStorage.setItem(visualDiagnosticsStorageKey, JSON.stringify(visualDiagnostics)); } catch (_) {}
  }
  function recordVisualError(event, error, detail = {}) {
    recordVisualDiagnostic(event, { ...detail, errorName: error?.name || "Error", errorMessage: error?.message || String(error) });
  }
  function visualVehicleSnapshot(vehicleIndex = state.currentVehicleIndex) {
    const vehicle = vehicles[vehicleIndex];
    return {
      vehicleIndex,
      vehicleStem: vehicle?.stem || null,
      vehicleNameJa: vehicle?.nameJa || null,
      currentStage: state.currentStage,
      savedProgressStage: Number.isInteger(vehicleIndex) ? currentStageForVehicle(vehicleIndex) : null,
      preparedInitialVehicleIndex: state.preparedInitialVehicleIndex,
      previewQaInitialVehicleIndex: state.previewQaInitialVehicleIndex
    };
  }
  function setupVisualDiagnostics() {
    if (!visualDiagnosticsEnabled) return;
    try {
      const stored = JSON.parse(localStorage.getItem(visualDiagnosticsStorageKey) || "[]");
      if (Array.isArray(stored)) visualDiagnostics = stored.slice(-800);
    } catch (_) {}
    visualDiagnosticSequence = visualDiagnostics.reduce((max, entry) => Math.max(max, Number(entry.sequence) || 0), 0);
    const style = document.createElement("style");
    style.textContent = ".visual-diagnostics-button{position:fixed;right:8px;top:8px;z-index:2147483647;padding:6px 8px;border:1px solid #fff;border-radius:6px;background:#152238;color:#fff;font:700 12px sans-serif}.visual-diagnostics-panel{position:fixed;inset:44px 8px 8px;z-index:2147483647;display:flex;flex-direction:column;padding:8px;border:1px solid #fff;border-radius:8px;background:rgba(8,16,28,.97);color:#fff;font:12px/1.35 ui-monospace,monospace}.visual-diagnostics-panel[hidden]{display:none}.visual-diagnostics-actions{display:flex;gap:6px;margin-bottom:6px}.visual-diagnostics-actions button{font:inherit}.visual-diagnostics-output{flex:1;min-height:0;margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word}";
    document.head.appendChild(style);
    const button = document.createElement("button");
    button.type = "button"; button.className = "visual-diagnostics-button"; button.textContent = "VISUAL LOG";
    const panel = document.createElement("section");
    panel.className = "visual-diagnostics-panel"; panel.hidden = true;
    const actions = document.createElement("div"); actions.className = "visual-diagnostics-actions";
    const latest = document.createElement("button"); latest.type = "button"; latest.textContent = "Latest Log";
    const all = document.createElement("button"); all.type = "button"; all.textContent = "Full Log";
    const copy = document.createElement("button"); copy.type = "button"; copy.textContent = "Copy Log";
    const clear = document.createElement("button"); clear.type = "button"; clear.textContent = "Clear Log";
    const close = document.createElement("button"); close.type = "button"; close.textContent = "Close";
    const output = document.createElement("pre"); output.className = "visual-diagnostics-output";
    let showingAll = false;
    const render = () => { output.textContent = JSON.stringify(showingAll ? visualDiagnostics : visualDiagnostics.slice(-160), null, 2); };
    latest.addEventListener("click", () => { showingAll = false; render(); });
    all.addEventListener("click", () => { showingAll = true; render(); });
    copy.addEventListener("click", async () => { const text = JSON.stringify(visualDiagnostics, null, 2); try { await navigator.clipboard.writeText(text); copy.textContent = "Copied"; window.setTimeout(() => { copy.textContent = "Copy Log"; }, 1200); } catch (_) { window.prompt("VISUAL LOG", text); } });
    clear.addEventListener("click", () => { visualDiagnostics = []; try { localStorage.removeItem(visualDiagnosticsStorageKey); } catch (_) {} render(); recordVisualDiagnostic("log-cleared"); render(); });
    close.addEventListener("click", () => { panel.hidden = true; });
    button.addEventListener("click", () => { panel.hidden = false; render(); });
    actions.append(latest, all, copy, clear, close); panel.append(actions, output); document.body.append(button, panel);
    recordVisualDiagnostic("diagnostics-enabled", { href: window.location.href, ...visualVehicleSnapshot() });
  }
  function imageCacheKey(path) { return new URL(path, document.baseURI).href; }
  function hasPreloadedImage(path) { return imagePreloads.has(imageCacheKey(path)); }
  function runDecodeQueue() {
    while (activeDecodes < maxConcurrentDecodes) {
      const task = decodeQueues.high.shift() || decodeQueues.low.shift();
      if (!task) return;
      task.started = true;
      activeDecodes += 1;
      task.decodeStartedAt = performance.now();
      recordVisualDiagnostic("decode-start", { path: task.path, kind: visualPathKind(task.path), priority: task.priority, taskStartedAtMs: Math.round(task.decodeStartedAt) });
      Promise.resolve().then(() => task.image.decode ? task.image.decode() : undefined)
        .then((image) => {
          recordVisualDiagnostic("decode-success", { path: task.path, kind: visualPathKind(task.path), priority: task.priority, durationMs: Math.round(performance.now() - task.decodeStartedAt) });
          task.resolve(image);
        }, (error) => {
          recordVisualError("decode-error", error, { path: task.path, kind: visualPathKind(task.path), priority: task.priority, durationMs: Math.round(performance.now() - task.decodeStartedAt) });
          task.reject(error);
        })
        .finally(() => { activeDecodes -= 1; recordVisualDiagnostic("decode-finish", { path: task.path, kind: visualPathKind(task.path), priority: task.priority, taskEndedAtMs: Math.round(performance.now()) }); runDecodeQueue(); });
    }
  }
  function promoteQueuedDecode(path) {
    const task = queuedDecodeTasks.get(path);
    if (!task || task.started || task.priority === "high") return;
    const index = decodeQueues.low.indexOf(task);
    if (index >= 0) decodeQueues.low.splice(index, 1);
    task.priority = "high";
    decodeQueues.high.push(task);
    recordVisualDiagnostic("decode-promoted", { path, kind: visualPathKind(path), priority: "high" });
  }
  function queueImageDecode(path, image) {
    return new Promise((resolve, reject) => {
      const priority = imagePreloadPriorities.get(path) || "high";
      const task = { path, image, resolve, reject, priority };
      queuedDecodeTasks.set(path, task);
      (priority === "low" ? decodeQueues.low : decodeQueues.high).push(task);
      recordVisualDiagnostic("decode-queue-enter", { path, kind: visualPathKind(path), priority });
      runDecodeQueue();
    });
  }
  function preloadImage(path, priority = "high") {
    const key = imageCacheKey(path);
    const requestedAt = performance.now();
    recordVisualDiagnostic("preload-request", { path, key, kind: visualPathKind(path), priority });
    if (imagePreloads.has(key)) {
      if (priority === "high") { imagePreloadPriorities.set(key, "high"); promoteQueuedDecode(key); }
      recordVisualDiagnostic("preload-cache-hit", { path, key, kind: visualPathKind(path), priority });
      return imagePreloads.get(key);
    }
    imagePreloadPriorities.set(key, priority);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        recordVisualDiagnostic("load-success", { path, key, kind: visualPathKind(path), durationMs: Math.round(performance.now() - requestedAt) });
        queueImageDecode(key, image).then(resolve, reject);
      };
      image.onerror = () => { const error = new Error(`Image failed to load: ${path}`); recordVisualError("load-error", error, { path, key, kind: visualPathKind(path), durationMs: Math.round(performance.now() - requestedAt) }); reject(error); };
      recordVisualDiagnostic("image-src-set", { path, key, kind: visualPathKind(path) });
      recordVisualDiagnostic("load-start", { path, key, kind: visualPathKind(path) });
      image.src = path;
    });
    imagePreloads.set(key, promise);
    promise.then(() => { recordVisualDiagnostic("preload-complete", { path, key, kind: visualPathKind(path), durationMs: Math.round(performance.now() - requestedAt) }); queuedDecodeTasks.delete(key); }, (error) => { recordVisualError("preload-error", error, { path, key, kind: visualPathKind(path), durationMs: Math.round(performance.now() - requestedAt) }); imagePreloads.delete(key); imagePreloadPriorities.delete(key); queuedDecodeTasks.delete(key); });
    return promise;
  }
  function withTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => { const error = new Error(`${label} timed out`); recordVisualError("timeout", error, { label, timeoutMs }); reject(error); }, timeoutMs);
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
    const decodeStartedAt = performance.now();
    recordVisualDiagnostic("element-decode-start", { path, kind: visualPathKind(path), elementId: element.id });
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
      recordVisualDiagnostic("element-decode-success", { path, kind: visualPathKind(path), elementId: element.id, durationMs: Math.round(performance.now() - decodeStartedAt) });
    }).catch((error) => { recordVisualError("element-decode-error", error, { path, kind: visualPathKind(path), elementId: element.id, durationMs: Math.round(performance.now() - decodeStartedAt) }); throw error; }), imagePreparationTimeoutMs, `Image element decode: ${path}`);
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
  function equipmentArtworkPath(vehicleIndex) {
    const stem = vehicles[vehicleIndex].stem;
    return `./assets/collection/05_equipment/${stem}_equipment.webp`;
  }
  function vehicleLogoTitlePath(vehicleIndex) {
    const stem = vehicles[vehicleIndex].stem;
    return `./assets/collection/07_vehicle_logo_title/${stem}_vehicle_logo_title.webp`;
  }
  function masterMedalArtworkPath(vehicleIndex) {
    const stem = vehicles[vehicleIndex].stem;
    return `./assets/collection/06_medal/${stem}_master_medal.webp`;
  }
  function answerArtworkPath(vehicleIndex, stage) {
    if (stage < 2) return null;
    if (stage === 2) return vehicleArtworkPath(vehicleIndex).replace(/^\.\//, "");
    const stem = vehicles[vehicleIndex].stem;
    return `${answerArtFolders[stage]}/${stem}_${answerArtSuffixes[stage]}.webp`;
  }
  function superRobotSeriesForStage(stage) {
    if (stage === 4) return "superRobot";
    if (stage === 5) return "superRobotEquipped";
    return null;
  }
  function isEquippedSuperRobotArtwork(path) {
    return Boolean(path && path.includes("/collection/04_super_robot_equipped/"));
  }
  function preloadVehicleVisuals(vehicleIndex, stage) {
    const bubblePath = stage >= 2 ? `./assets/ui/speech_bubble/${answerBubbleFiles[stage]}` : null;
    const paths = [playBackgroundPath(vehicleIndex), answerArtworkPath(vehicleIndex, stage), bubblePath].filter(Boolean);
    paths.forEach((path) => preloadDecodedImage(path).catch(() => {}));
  }
  function preloadStage5RewardVisuals(vehicleIndex) {
    return Promise.all([
      playBackgroundPath(vehicleIndex),
      vehicleLogoTitlePath(vehicleIndex),
      vehicleArtworkPath(vehicleIndex),
      robotArtworkPath(vehicleIndex),
      equippedSuperRobotArtworkPath(vehicleIndex),
      masterMedalArtworkPath(vehicleIndex),
      "./assets/ui/collection_detail/master_medal_hologram_pedestal.webp",
      "./assets/ui/reward_popup/reward_stage05_master-medal-get-overlay.webp"
    ].map(preloadDecodedImage));
  }
  // Reuse the collection vehicle-detail DOM, positions, and drawing order for
  // Stage 5. The only extra visual is the existing GET overlay above it.
  function buildStage5CollectionComposition(vehicleIndex) {
    const scene = $("detail-picture").cloneNode(true);
    scene.removeAttribute("id");
    scene.classList.add("reward-complete-detail");
    scene.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    scene.querySelectorAll("button").forEach((node) => node.remove());
    scene.querySelector(".detail-background").src = playBackgroundPath(vehicleIndex);
    const logo = scene.querySelector(".detail-vehicle-logo");
    logo.hidden = false;
    logo.style.visibility = "";
    logo.src = vehicleLogoTitlePath(vehicleIndex);
    const medal = scene.querySelector(".detail-master-medal-display");
    medal.hidden = false;
    medal.style.visibility = "";
    medal.querySelector(".detail-master-medal-art").src = masterMedalArtworkPath(vehicleIndex);
    const layout = scene.querySelector(".detail-evolution-layout");
    layout.hidden = false;
    layout.style.visibility = "";
    layout.className = "detail-evolution-layout is-three-up has-equipped-super-robot";
    layout.querySelector(".detail-slot-super").hidden = false;
    layout.querySelector(".detail-chevron-two").hidden = false;
    scene.querySelector(".detail-vehicle-art, .detail-slot-vehicle img").src = vehicleArtworkPath(vehicleIndex);
    scene.querySelector(".detail-slot-robot img").src = robotArtworkPath(vehicleIndex);
    const superArt = scene.querySelector(".detail-slot-super img");
    superArt.src = equippedSuperRobotArtworkPath(vehicleIndex);
    superArt.className = "detail-character is-equipped-super-robot";
    const shared = superRobotDisplaySettings.collectionDetail.superRobotEquipped;
    superArt.dataset.displaySeries = "superRobotEquipped";
    superArt.style.setProperty("--detail-super-scale", String(shared.scale));
    superArt.style.setProperty("--detail-super-x", shared.x);
    superArt.style.setProperty("--detail-super-y", shared.y);
    return scene;
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
    const categoryBackgrounds = Object.values(collectionCategoryBackgroundPaths);
    categoryBackgrounds.forEach((path) => preloadDecodedImage(path, "low").catch(() => null));
    const artwork = vehicles.flatMap((vehicle) => {
      const progress = vehicleProgress(vehicle.index);
      const formStage = progress.masterMedal ? 5 : Math.max(2, Math.min(5, progress.stage));
      const paths = [vehicleArtworkPath(vehicle.index)];
      if (progress.discovered && progress.stage >= 3) paths.push(robotArtworkPath(vehicle.index));
      if (progress.discovered) paths.push(answerArtworkPath(vehicle.index, formStage));
      if (progress.masterMedal) paths.push(
        resultArtworkPath(vehicle.index, formStage, true),
        masterMedalArtworkPath(vehicle.index),
        "./assets/ui/collection_detail/master_medal_hologram_pedestal.webp"
      );
      return paths.filter(Boolean);
    });
    return Promise.all(artwork.map((path) => preloadDecodedImage(path).catch(() => null)));
  }
  function showFixedScreenWhenReady(screenId, extraPaths = [], onShown = null) {
    const requestId = ++visualRequestId;
    const runId = state.runId;
    const fixedBackgroundPath = screenId === "start-screen" ? startKeyVisualPath : screenId === "mode-select-screen" ? modeSelectPath : screenId === "result-screen" ? topBackgroundPath : null;
    const paths = fixedBackgroundPath ? [fixedBackgroundPath, ...extraPaths] : extraPaths;
    const transitionStartedAt = performance.now();
    recordVisualDiagnostic("fixed-screen-prepare-start", { screenId, paths, requestId });
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
      recordVisualDiagnostic("fixed-screen-visible", { screenId, requestId, durationMs: Math.round(performance.now() - transitionStartedAt) });
      if (onShown) onShown();
      return true;
    }).catch((error) => {
      recordVisualError("fixed-screen-error", error, { screenId, requestId, durationMs: Math.round(performance.now() - transitionStartedAt) });
      console.error(`Fixed screen failed to load: ${screenId}`, error);
      if (requestId !== visualRequestId || runId !== state.runId) return false;
      setNeutralBackground();
      if (screenId === "start-screen") updateTopCollectionButton();
      showScreen(screenId);
      recordVisualDiagnostic("fixed-screen-visible-after-error", { screenId, requestId, durationMs: Math.round(performance.now() - transitionStartedAt) });
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
  const viewportDiagnosticsPreferenceKey = "mq-001:viewport-diagnostics-enabled-v1";
  const viewportDiagnosticsStorageKey = "mq-001:viewport-diagnostics-v1";
  let viewportDiagnosticsEnabled = false;
  let viewportDiagnosticsButton = null;
  function loadViewportDiagnosticsEnabled() {
    try { return localStorage.getItem(viewportDiagnosticsPreferenceKey) === "1"; } catch (_) { return false; }
  }
  function saveViewportDiagnosticsEnabled(enabled) {
    try { localStorage.setItem(viewportDiagnosticsPreferenceKey, enabled ? "1" : "0"); } catch (_) {}
  }
  // B-line preview auto-deploy verification: no runtime behavior change.
  let viewportDiagnostics = [];
  function viewportSnapshot() {
    const visualViewport = window.visualViewport;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      visualViewportWidth: visualViewport?.width ?? null,
      visualViewportHeight: visualViewport?.height ?? null,
      visualViewportScale: visualViewport?.scale ?? null,
      visualViewportOffsetLeft: visualViewport?.offsetLeft ?? null,
      visualViewportOffsetTop: visualViewport?.offsetTop ?? null
    };
  }
  function diagnosticViewportSnapshot() {
    const visualViewport = window.visualViewport;
    const playStage = $("play-stage");
    return {
      visualViewportWidth: visualViewport?.width ?? null,
      visualViewportHeight: visualViewport?.height ?? null,
      visualViewportScale: visualViewport?.scale ?? null,
      visualViewportOffsetLeft: visualViewport?.offsetLeft ?? null,
      visualViewportOffsetTop: visualViewport?.offsetTop ?? null,
      stageScale: playStage?.style.getPropertyValue("--stage-scale").trim() || null
    };
  }
  function recordViewportDiagnostic(event, detail = {}) {
    if (!viewportDiagnosticsEnabled) return;
    const entry = { ts: new Date().toISOString(), event, ...detail, snapshot: diagnosticViewportSnapshot() };
    viewportDiagnostics.push(entry);
    if (viewportDiagnostics.length > 30) viewportDiagnostics = viewportDiagnostics.slice(-30);
    try { localStorage.setItem(viewportDiagnosticsStorageKey, JSON.stringify(viewportDiagnostics)); } catch (_) {}
  }
  function updateViewportDiagnosticsButton() {
    if (viewportDiagnosticsButton) viewportDiagnosticsButton.hidden = !viewportDiagnosticsEnabled;
  }
  function updateAdminViewportDiagnosticsToggle() {
    const toggle = $("admin-viewport-diagnostics-toggle");
    if (!toggle) return;
    toggle.setAttribute("aria-checked", String(viewportDiagnosticsEnabled));
    toggle.querySelector("span").textContent = viewportDiagnosticsEnabled ? "ON" : "OFF";
  }
  function toggleViewportDiagnostics() {
    viewportDiagnosticsEnabled = !viewportDiagnosticsEnabled;
    saveViewportDiagnosticsEnabled(viewportDiagnosticsEnabled);
    updateViewportDiagnosticsButton();
    updateAdminViewportDiagnosticsToggle();
    setAdminActionStatus(viewportDiagnosticsEnabled ? "画面拡大診断をONにしました。" : "画面拡大診断をOFFにしました。");
  }
  function setupViewportDiagnostics() {
    viewportDiagnosticsEnabled = loadViewportDiagnosticsEnabled();
    try {
      const stored = JSON.parse(localStorage.getItem(viewportDiagnosticsStorageKey) || "[]");
      if (Array.isArray(stored)) viewportDiagnostics = stored.slice(-30);
    } catch (_) {}
    const button = document.createElement("button");
    viewportDiagnosticsButton = button;
    button.type = "button";
    button.textContent = "MQ-001 LOG";
    Object.assign(button.style, {
      position: "fixed",
      left: "8px",
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
    updateViewportDiagnosticsButton();
  }
  async function updateVersionLabelWithPreviewMetadata() {
    const versionLabel = $("app-version");
    versionLabel.textContent = `Version ${appVersion}`;
    versionLabel.classList.remove("is-preview");
    if (location.hostname.endsWith(".pages.dev")) try {
      const releaseResponse = await fetch("./release-meta.json", { cache: "no-store" });
      if (releaseResponse.ok) {
        const release = await releaseResponse.json();
        if (/^[a-f0-9]{40}$/.test(String(release.commit || "")) &&
            /^\d+\.\d+\.\d+$/.test(String(release.version || "")) &&
            ["production", "preview"].includes(release.environment)) {
          versionLabel.textContent = `Version ${release.version}${release.environment === "preview" ? "_P" : ""} | ${release.commit.slice(0, 7)}`;
          versionLabel.classList.toggle("is-preview", release.environment === "preview");
          return;
        }
      }
    } catch (_) {
      // Older static deployments do not provide release metadata.
    }
    try {
      const response = await fetch("./preview-meta.json", { cache: "no-store" });
      if (!response.ok) return;
      const metadata = await response.json();
      if (metadata?.environment !== "preview") return;
      const branch = String(metadata.branch || "branch").slice(0, 15);
      const commit = String(metadata.shortCommit || metadata.commit || "").slice(0, 7);
      versionLabel.textContent = `Version ${appVersion}_P_${branch}${commit ? `_${commit}` : ""}`;
      versionLabel.classList.add("is-preview");
    } catch (_) {
      // GitHub Pages / local builds do not generate preview metadata.
    }
  }
  const stableViewportMetaContent = "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
  const resetViewportMetaContent = "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no";
  let viewportRecoveryInProgress = false;
  function recoverAbnormalPwaZoom(reason) {
    const visualViewport = window.visualViewport;
    const scale = visualViewport?.scale;
    if (viewportRecoveryInProgress || !Number.isFinite(scale) || Math.abs(scale - 1) <= 0.01) return false;
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) return false;
    viewportRecoveryInProgress = true;
    recordViewportDiagnostic("viewport-recovery-start", { reason, detectedScale: scale });
    viewportMeta.setAttribute("content", resetViewportMetaContent);
    // Force WebKit to consume the temporary constraint before restoring
    // viewport-fit=cover. This targets the standalone-PWA resume zoom bug.
    void document.documentElement.offsetWidth;
    window.setTimeout(() => {
      viewportMeta.setAttribute("content", stableViewportMetaContent);
      window.scrollTo(0, 0);
      window.setTimeout(() => {
        viewportRecoveryInProgress = false;
          schedulePlayStageSize("viewport-recovery");
        scheduleCollectionStageSize();
      }, 120);
    }, 60);
    return true;
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
      return false;
    }
    const scale = sizeStages({ width: snapshot.innerWidth, height: snapshot.innerHeight, includePlay: true, includeCollection: true });
    lastStableAppScale = scale;
    return true;
  }
  function schedulePlayStageSize(reason) {
    const requestId = ++scaleUpdateRequest;
    window.requestAnimationFrame(() => {
      const first = viewportSnapshot();
      window.requestAnimationFrame(() => {
        if (requestId !== scaleUpdateRequest) {
          return;
        }
        const second = viewportSnapshot();
        if (!viewportIsStable(first, second)) {
          return;
        }
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
    const spec = { stage, vehicle, backgroundPath, path, bubblePath, discoveryBubblePath, hasDiscoveryMessage: Boolean(vehicle && !progress.discovered) };
    recordVisualDiagnostic("question-visual-spec", { vehicleIndex: question.vehicleIndex, vehicleStem: vehicle?.stem || null, vehicleNameJa: vehicle?.nameJa || null, stage, backgroundPath, characterPath: path, bubblePath, discoveryBubblePath });
    return spec;
  }
  function preloadQuestionVisuals(question) {
    const spec = questionVisualSpec(question);
    const paths = [spec.backgroundPath, spec.path, spec.bubblePath, spec.hasDiscoveryMessage ? spec.discoveryBubblePath : null].filter(Boolean);
    const startedAt = performance.now();
    recordVisualDiagnostic("preload-question-visuals-start", { paths, stage: spec.stage, vehicleIndex: question.vehicleIndex });
    return Promise.all(paths.map(preloadDecodedImage)).then(() => { recordVisualDiagnostic("preload-question-visuals-end", { paths, stage: spec.stage, vehicleIndex: question.vehicleIndex, durationMs: Math.round(performance.now() - startedAt) }); return spec; });
  }
  function prepareStagedImage(element, path) {
    const startedAt = performance.now();
    recordVisualDiagnostic("prepare-staged-image-start", { path, kind: visualPathKind(path), elementId: element.id });
    element.hidden = false;
    element.style.visibility = "hidden";
    return decodeImageElement(element, path).then((value) => { recordVisualDiagnostic("prepare-staged-image-end", { path, kind: visualPathKind(path), elementId: element.id, durationMs: Math.round(performance.now() - startedAt) }); return value; });
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
      const stageScale = stageRect?.width ? stageRect.width / stageCanvasWidth : 0;
      if (stageRect && timerRect && stageScale) {
        top = (timerRect.top + timerRect.height / 2 - stageRect.top) / stageScale;
      }
    }
    if (Number.isFinite(top)) bubble.style.top = `${top}px`;
    bubble.style.width = `${position.width}px`;
  }

  function clearCharacterMotion(element) {
    element.classList.remove("is-vehicle-entering", "is-vehicle-exiting", "is-robot-entering", "is-robot-exiting", "is-super-summoning");
  }
  function clearSuperRobotSummon() {
    const summon = $("super-robot-summon");
    if (!summon) return;
    summon.classList.remove("is-running", "is-stage5");
    summon.hidden = true;
  }
  function playSuperRobotSummon(character, stageNumber) {
    const summon = $("super-robot-summon"), playStage = $("play-stage");
    if (!summon || !playStage || character.hidden) return false;
    const stageRect = playStage.getBoundingClientRect();
    const characterRect = character.getBoundingClientRect();
    const scale = stageRect.width / stageCanvasWidth || 1;
    if (!stageRect.width || !characterRect.width || !characterRect.height || !scale) return false;
    const centerX = (characterRect.left - stageRect.left + characterRect.width / 2) / scale;
    const footY = Math.min(stageCanvasHeight, Math.max(120, (characterRect.bottom - stageRect.top) / scale));
    summon.style.setProperty("--summon-x", `${centerX.toFixed(1)}px`);
    summon.style.setProperty("--summon-foot-y", `${footY.toFixed(1)}px`);
    summon.classList.toggle("is-stage5", stageNumber === 5);
    summon.hidden = false;
    summon.classList.remove("is-running");
    void summon.offsetWidth;
    summon.classList.add("is-running");
    return true;
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
    const scale = stageRect.width / stageCanvasWidth || 1;
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
    const scale = stageRect.width / stageCanvasWidth || 1;
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
    } else if (prepared.characterStage === 4 || prepared.characterStage === 5) {
      clearSuperRobotSummon();
      const summonStarted = playSuperRobotSummon(character, prepared.characterStage);
      const reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
      const settleMs = reducedMotion ? 320 : 1120;
      const characterMotion = waitForCharacterAnimation(character, "is-super-summoning", settleMs + 120);
      if (summonStarted) {
        await Promise.all([
          characterMotion,
          new Promise((resolve) => window.setTimeout(resolve, settleMs))
        ]);
        clearSuperRobotSummon();
      } else {
        await characterMotion;
      }
    }
  }
  function prepareQuestionVisuals(question, allowFutureQuestion = false) {
    const stagedBackground = $("play-background-next"), stagedCharacter = $("answer-character-next"), stagedBubble = $("answer-bubble-next");
    const requestId = ++visualRequestId;
    const prepareStartedAt = performance.now();
    recordVisualDiagnostic("prepare-question-visuals-start", { requestId, allowFutureQuestion, ...visualVehicleSnapshot(question.vehicleIndex) });
    return preloadQuestionVisuals(question).then(async ({ stage, vehicle, backgroundPath, path, bubblePath, discoveryBubblePath, hasDiscoveryMessage }) => {
      if (requestId !== visualRequestId || (!allowFutureQuestion && state.current !== question)) return false;
      const discoveryBubble = $("answer-discovery-bubble");
      const elementPrepares = [prepareStagedImage(stagedBackground, backgroundPath)];
      if (hasDiscoveryMessage) elementPrepares.push(prepareStagedImage(discoveryBubble, discoveryBubblePath));
      else discoveryBubble.hidden = true;
      if (!path || !vehicle) {
        recordVisualDiagnostic("prepare-question-promise-all-start", { requestId, stage, vehicleIndex: question.vehicleIndex, paths: [backgroundPath, discoveryBubblePath].filter(Boolean) });
        await Promise.all(elementPrepares);
        recordVisualDiagnostic("prepare-question-promise-all-end", { requestId, stage, vehicleIndex: question.vehicleIndex, durationMs: Math.round(performance.now() - prepareStartedAt) });
        if (requestId !== visualRequestId || (!allowFutureQuestion && state.current !== question)) return false;
        recordVisualDiagnostic("prepare-question-visuals-success", { requestId, stage, vehicleIndex: question.vehicleIndex, durationMs: Math.round(performance.now() - prepareStartedAt), hasCharacter: false });
        return { backgroundPath, hasCharacter: false, hasBubble: false, hasDiscoveryMessage };
      }
      const characterPath = path.startsWith("./") ? path : `./${path}`;
      // Artwork may use a smaller encoded resolution, but every evolution image
      // keeps the approved 1254-square logical framing. Use that logical size
      // for common placement so encoded resolution does not alter screen size.
      const logicalCanvasSize = 1254;
      const superRobotSeries = superRobotSeriesForStage(stage);
      const sharedDisplay = superRobotSeries ? superRobotDisplaySettings.answer[superRobotSeries] : null;
      const scale = sharedDisplay?.scale ?? answerArtCanvasScales[stage];
      const flip = stage <= 3;
      stagedCharacter.alt = `${vehicle.nameJa}の${["", "", "乗り物", "ロボット", "スーパーロボット", "装備付きスーパーロボット"][stage]}`;
      stagedCharacter.style.width = `${logicalCanvasSize * scale}px`;
      if (sharedDisplay) {
        stagedCharacter.style.left = `${sharedDisplay.x}px`;
        stagedCharacter.style.top = `${sharedDisplay.y}px`;
      } else {
        // Preserve the existing vehicle and robot placement. Only the two
        // super-robot series use the explicit shared settings above.
        const keypadLeft = Number.parseFloat(window.getComputedStyle(document.querySelector(".game-area")).left);
        const characterCenterX = (Number.isFinite(keypadLeft) ? keypadLeft / 2 : 380) + 100;
        stagedCharacter.style.left = `${characterCenterX - logicalCanvasSize * scale / 2}px`;
        stagedCharacter.style.top = `${968 - logicalCanvasSize * scale}px`;
      }
      const staticTransform = flip ? "scaleX(-1)" : stage === 5 ? `scale(${equippedSuperRobotEyeScale})` : "none";
      stagedCharacter.style.setProperty("--character-static-transform", staticTransform);
      stagedCharacter.style.transform = "var(--character-static-transform)";
      stagedCharacter.classList.toggle("is-equipped-super-robot", stage === 5);
      stagedCharacter.dataset.answerStage = String(stage);
      clearCharacterMotion(stagedCharacter);
      elementPrepares.push(prepareStagedImage(stagedCharacter, characterPath));
      if (bubblePath) {
        positionAnswerBubble(stagedBubble, stage, stagedCharacter);
        elementPrepares.push(prepareStagedImage(stagedBubble, bubblePath));
      } else stagedBubble.hidden = true;
      recordVisualDiagnostic("prepare-question-promise-all-start", { requestId, stage, vehicleIndex: question.vehicleIndex, paths: [backgroundPath, characterPath, bubblePath].filter(Boolean) });
      await Promise.all(elementPrepares);
      recordVisualDiagnostic("prepare-question-promise-all-end", { requestId, stage, vehicleIndex: question.vehicleIndex, durationMs: Math.round(performance.now() - prepareStartedAt) });
      if (requestId !== visualRequestId || (!allowFutureQuestion && state.current !== question)) return false;
      recordVisualDiagnostic("prepare-question-visuals-success", { requestId, stage, vehicleIndex: question.vehicleIndex, durationMs: Math.round(performance.now() - prepareStartedAt) });
      return { backgroundPath, hasCharacter: true, characterStage: stage, hasBubble: Boolean(bubblePath), hasDiscoveryMessage: false };
    }).catch((error) => {
      console.error("Question visual failed to load", error);
      recordVisualError("prepare-question-visuals-catch", error, { requestId, stage: question.answerStage, vehicleIndex: question.vehicleIndex, vehicleStem: vehicles[question.vehicleIndex]?.stem || null, durationMs: Math.round(performance.now() - prepareStartedAt) });
      if (requestId !== visualRequestId || (!allowFutureQuestion && state.current !== question)) return false;
      // Retain the complete old visual rather than exposing a partial fallback on failure.
      recordVisualDiagnostic("prepare-question-preserve-current", { requestId, stage: question.answerStage, vehicleIndex: question.vehicleIndex });
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
    recordVisualDiagnostic("prepare-initial-vehicle-start", visualVehicleSnapshot());
    if (Number.isInteger(state.previewQaInitialVehicleIndex)) {
      state.currentVehicleIndex = state.previewQaInitialVehicleIndex;
      state.currentStage = currentStageForVehicle(state.currentVehicleIndex);
      state.preparedInitialVehicleIndex = state.currentVehicleIndex;
      state.previewQaInitialVehicleIndex = null;
      preloadVehicleVisuals(state.currentVehicleIndex, state.currentStage);
      recordVisualDiagnostic("prepare-initial-vehicle-preview-qa", visualVehicleSnapshot());
      return;
    }
    if (Number.isInteger(state.preparedInitialVehicleIndex)) { recordVisualDiagnostic("prepare-initial-vehicle-reused", visualVehicleSnapshot(state.preparedInitialVehicleIndex)); return; }
    state.currentVehicleIndex = -1;
    state.currentStage = 1;
    state.correctStreak = 0;
    chooseNextVehicle();
    state.vehicleChallengeQuestionCount = 0;
    state.preparedInitialVehicleIndex = state.currentVehicleIndex;
    preloadVehicleVisuals(state.preparedInitialVehicleIndex, state.currentStage);
    recordVisualDiagnostic("prepare-initial-vehicle-selected", visualVehicleSnapshot(state.preparedInitialVehicleIndex));
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

  function makeTwoDigitMultiplicationQuestions(unguided = false, zeroMode = false) {
    if (zeroMode) {
      const used = new Set();
      return Array.from({ length: 5 }, (_, index) => {
        let multiplicand, multiplier, key;
        do {
          multiplicand = 10 + Math.floor(Math.random() * 90);
          const tens = 1 + Math.floor(Math.random() * 9);
          const ones = (index === 1 || index === 3) ? 0 : 1 + Math.floor(Math.random() * 9);
          multiplier = tens * 10 + ones;
          key = `${multiplicand}*${multiplier}`;
        } while (used.has(key));
        used.add(key);
        const partial1 = multiplicand * (multiplier % 10);
        const partial2 = multiplicand * Math.floor(multiplier / 10);
        const product = multiplicand * multiplier;
        return { kind: "multiplication2x2", id: `multiplication2x2-zero-${index + 1}-${key}`,
          multiplicand, multiplier, partial1, partial2, product, quotient: product, remainder: 0,
          hintUsed: false, answerRevealed: false, assistedCorrect: false, resultType: null, isReview: false };
      });
    }
    const maxDigit = unguided ? 6 : 5;
    const values = [];
    const multiplierValues = [];
    for (let tens = 1; tens <= maxDigit; tens += 1) {
      for (let ones = 0; ones <= maxDigit; ones += 1) values.push(tens * 10 + ones);
      // A repeated lower digit makes the two partial products indistinguishable
      // to a child who swaps the ones and tens places.  Keep every existing
      // range rule, and only remove those ambiguous multipliers for this mode.
      for (let ones = 1; ones <= maxDigit; ones += 1) {
        if (tens !== ones) multiplierValues.push(tens * 10 + ones);
      }
    }
    const pairs = [];
    const used = new Set();
    while (pairs.length < 5) {
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
    const isMultiplication2x2 = (mode === "multiplication2x2" || mode === "multiplication2x2-unguided" || mode === "multiplication2x2-zero");
    const isCounting = mode === "counting1" || mode === "counting2";
    state.mode = isLongDivision ? "longdivision" : isNumberCards ? "numbercards" : isMultiplication ? "multiplication" : isMultiplication2x2 ? mode : isCounting ? mode : "normal";
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
    $("question-answer-card").className = `question-answer-card${kind ? ` ${kind}` : ""}${state.mode === "longdivision" ? " long-division-mode" : ""}${state.mode === "numbercards" ? " number-card-mode" : ""}${state.mode === "multiplication" ? " multiplication-mode" : ""}${((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero")) ? " multiplication-2x2-mode" : ""}${(state.mode === "counting1" || state.mode === "counting2") ? " counting-mode" : ""}${state.mode === "counting1" ? " counting1-mode" : ""}`;
  }
  function setProgress() {
    const isRetry = state.phase === "retry";
    const number = isRetry ? state.retrySetPosition : state.initialIndex + 1;
    const total = isRetry ? state.retrySetTotal : ((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero")) ? state.questions.length : 10;
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
    // Keep the previous red correction through the blue grading mark and
    // any interim notice; remove it only as the next problem takes over.
    removeMultiplicationCorrectionOverlays();
    const displayStartedAt = performance.now();
    recordVisualDiagnostic("display-question-start", { vehicleIndex: question.vehicleIndex, ...visualVehicleSnapshot(question.vehicleIndex) });
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
      recordVisualDiagnostic("display-question-background-ready", { vehicleIndex: question.vehicleIndex, backgroundPath: prepared.backgroundPath, durationMs: Math.round(performance.now() - displayStartedAt) });
      if (runId !== state.runId || state.current !== question) return;
      $("problem-card").textContent = question.kind === "numbercards" || question.kind === "multiplication" || question.kind === "multiplication2x2" || question.kind === "counting" ? "" : `${question.dividend} ÷ ${question.divisor}`;
      resetAnswerCard(); setProgress();
      if (state.mode === "longdivision") setupLongDivision(question);
      if (state.mode === "numbercards") setupNumberCards(question);
      if (state.mode === "multiplication") setupMultiplication(question);
      if (((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero"))) setupTwoDigitMultiplication(question);
      if ((state.mode === "counting1" || state.mode === "counting2")) setupCounting(question);
      commitQuestionVisuals(prepared);
      recordVisualDiagnostic("display-question-character-ready", { vehicleIndex: question.vehicleIndex, characterStage: prepared.characterStage || null, durationMs: Math.round(performance.now() - displayStartedAt) });
      renderVehicleProgressUi(question.vehicleIndex);
      $("incorrect-next-vehicle-notice").hidden = true;
      if (state.pendingNextVehicleOverlay) {
        state.pendingNextVehicleOverlay.hidden = true;
        state.pendingNextVehicleOverlay = null;
      }
      showScreen("play-screen");
      recordVisualDiagnostic("display-question-play-screen-visible", { vehicleIndex: question.vehicleIndex, durationMs: Math.round(performance.now() - displayStartedAt) });
      // Stage2/3 keep their current motion. Stage4/5 use the dedicated
      // lightweight summon sequence while preserving the same final placement.
      await playPreparedCharacterEntry(prepared, shouldAnimateCharacter);
      if (runId !== state.runId || state.current !== question) return;
      if (onRevealed) onRevealed();
      startQuestionTimeout();
      state.transitioning = false;
      recordVisualDiagnostic("display-question-transitioning-false", { vehicleIndex: question.vehicleIndex, durationMs: Math.round(performance.now() - displayStartedAt) });
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
    beginRoundTransaction();
    clearRetryAutoStartTimer(); clearIdleGuide();
    stopCollectionTimer();
    if (state.pendingNextVehicleOverlay) state.pendingNextVehicleOverlay.hidden = true;
    state.pendingNextVehicleOverlay = null;
    state.preparedNextQuestionVisual = null;
    setGameMode(mode); state.runId += 1; state.questions = state.mode === "longdivision" ? makeLongDivisionQuestions() : state.mode === "numbercards" ? makeNumberCardQuestions() : state.mode === "multiplication" ? makeMultiplicationQuestions() : (((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero"))) ? makeTwoDigitMultiplicationQuestions(state.mode === "multiplication2x2-unguided", state.mode === "multiplication2x2-zero") : state.mode === "counting1" ? makeCountingQuestions(5) : state.mode === "counting2" ? makeCountingQuestions(10) : makeQuestions(); state.queue = []; state.phase = "initial";
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
  const childEnergyPresentation = Object.freeze({
    "almost-zero": Object.freeze({ label:"ほんのちょっと", multiplier:.2, level:1 }),
    small: Object.freeze({ label:"ちょっと", multiplier:.6, level:2 }),
    medium: Object.freeze({ label:"ふつう", multiplier:1, level:3 }),
    large: Object.freeze({ label:"いっぱい", multiplier:1.6, level:4 })
  });

  function activeLearningSettings() {
    const profileId = profileStore.getActiveProfileId();
    if (!profileId) return { enabledModes:{}, energyMultipliers:{}, dailyTargetCounts:{} };
    try { return profileStore.getProfileLearningSettings(profileId); }
    catch (_) { return { enabledModes:{}, energyMultipliers:{}, dailyTargetCounts:{} }; }
  }

  function normalizedMissionTarget(settings, modeId) {
    // Use the same legacy-phonics fallback as the parent settings screen.
    // Otherwise an untouched Part can look OFF in "おうちの人へ" but fall
    // back to the generic default of 1 in mode selection.
    return parentModeSetting(settings, modeId).target;
  }

  function dailyMissionState() {
    const today = japanDateKey();
    let mission;
    try { mission = profileStore.getDailyMission(); } catch (_) { mission = null; }
    if (!mission || mission.date !== today || !mission.completedCounts || typeof mission.completedCounts !== "object") {
      mission = { date:today, completedCounts:{} };
      try { profileStore.setDailyMission(mission); } catch (_) {}
    }
    return mission;
  }

  function missionOverview() {
    const settings = activeLearningSettings();
    const mission = dailyMissionState();
    const items = parentModeDefinitions.map((mode) => {
      const target = normalizedMissionTarget(settings, mode.id);
      const completed = Math.max(0, Number(mission.completedCounts?.[mode.id]) || 0);
      const remaining = Math.max(0, target - completed);
      const energyId = childEnergyPresentation[settings.energyMultipliers?.[mode.id]]
        ? settings.energyMultipliers[mode.id]
        : "medium";
      return { ...mode, target, completed, remaining, energyId };
    }).filter((item) => item.target > 0);
    return {
      settings,
      mission,
      items,
      allComplete: items.length > 0 && items.every((item) => item.remaining === 0),
      freePlayEnabled: settings.freePlayEnabled === true,
      freePlayEnergyMode: settings.freePlayEnergyMode === "almost-zero" ? "almost-zero" : "normal"
    };
  }

  // The completion dialog must not be clipped or obscured by the iPad-scaled mode canvas.
  $("mode-select-screen").append($("mode-select-mission-complete"));
  function renderModeSelectMission() {
    const overview = missionOverview();
    const freePlayActive = overview.allComplete && overview.freePlayEnabled;
    document.querySelectorAll(".mode-select-choice[data-mode]").forEach((button) => {
      const item = overview.items.find((entry) => entry.id === button.dataset.mode);
      button.hidden = !item;
      if (!item) return;
      const completed = item.remaining === 0;
      button.disabled = completed && !freePlayActive;
      button.classList.toggle("is-complete", completed);
      button.classList.toggle("is-free-play", freePlayActive);
      const remaining = button.querySelector(".mode-select-remaining");
      remaining.innerHTML = completed
        ? '<strong class="mode-select-done-text">できた！</strong>'
        : `<span class="mode-select-remaining-prefix">あと</span><strong class="mode-select-remaining-number">${item.remaining}</strong><span class="mode-select-remaining-suffix">回</span>`;
      const energy = button.querySelector(".mode-select-energy");
      if (item.energyDisabled) {
        energy.className = "mode-select-energy energy-disabled";
        energy.innerHTML = "<span>なし</span>";
        energy.setAttribute("aria-label", "エネルギーのたまりやすさ なし");
      } else {
        const presentation = childEnergyPresentation[freePlayActive && overview.freePlayEnergyMode === "almost-zero" ? "almost-zero" : item.energyId];
        energy.className = `mode-select-energy energy-level-${presentation.level}`;
        energy.innerHTML = `<i aria-hidden="true"></i><span>${presentation.label}</span>`;
        energy.setAttribute("aria-label", `エネルギーのたまりやすさ ${presentation.label}`);
      }
    });
    const banner = $("mode-select-mission-complete");
    banner.hidden = !overview.allComplete;
    banner.classList.toggle("is-final", overview.allComplete && !overview.freePlayEnabled);
    const questButton = $("quest-bonus-continue");
    const questClaimedToday = profileStore.getQuestBonusClaimDate() === japanDateKey();
    const questQaEnabled = qaProgressModeEnabled();
    const questAvailable = overview.allComplete && !questClaimedToday && !questQaEnabled;
    // The finished day and profile-specific claim determine visibility.
    // In-flight animation/transaction flags must never hide the earned action.
    questButton.hidden = !questAvailable;
    questButton.dataset.questReason = !overview.allComplete ? "incomplete"
      : questClaimedToday ? "claimed-today"
      : questQaEnabled ? "qa"
      : "available";
    questButton.dataset.questProfile = profileStore.getActiveProfileId() || "";
    questButton.dataset.questClaimDate = profileStore.getQuestBonusClaimDate() || "";
  }

  function isModeAvailableForMission(mode) {
    const overview = missionOverview();
    const item = overview.items.find((entry) => entry.id === mode);
    if (!item) return false;
    return (overview.allComplete && overview.freePlayEnabled) || item.remaining > 0;
  }

  // Internal-only completion signal. PR4/PR7 will consume this later.
  // Never persist a second flag: the date-scoped completedCounts is authoritative.
  let activeMissionAttempt = null;
  let lastDailyMissionCompletion = null;
  function beginDailyMissionAttempt(mode) {
    activeMissionAttempt = { mode, date: japanDateKey(), profileId: profileStore.getActiveProfileId() };
    lastDailyMissionCompletion = null;
  }
  function cancelDailyMissionAttempt() { activeMissionAttempt = null; }
  function dailyMissionCompletionTransition(items, completedMode) {
    if (!items.length) return false;
    const before = items.every((item) => item.remaining === 0);
    const item = items.find((entry) => entry.id === completedMode);
    if (!item || before || item.remaining <= 0) return false;
    return items.every((entry) => entry.id === completedMode ? entry.remaining === 1 : entry.remaining === 0);
  }
  function completeDailyMissionRound(mode) {
    const overview = missionOverview();
    const item = overview.items.find((entry) => entry.id === mode);
    const attempt = activeMissionAttempt;
    activeMissionAttempt = null;
    lastDailyMissionCompletion = null;
    if (!attempt || attempt.mode !== mode || attempt.date !== japanDateKey()
      || attempt.profileId !== profileStore.getActiveProfileId()
      || !item || overview.allComplete || item.remaining <= 0) return false;
    const isFinal = dailyMissionCompletionTransition(overview.items, mode);
    const mission = overview.mission;
    mission.completedCounts[mode] = item.completed + 1;
    if (isFinal && !mission.questRewardLevel) mission.questRewardLevel = levelSystem.levelAt(profileStore.getPointLedger()?.total || 0);
    try {
      profileStore.setDailyMission(mission);
    } catch (error) {
      console.error("Daily mission completion could not be saved", error);
      return false;
    }
    if (isFinal) lastDailyMissionCompletion = { date: attempt.date, profileId: attempt.profileId, mode };
    return isFinal;
  }

  function energyPresentationForMode(mode) {
    const settings = activeLearningSettings();
    const overview = missionOverview();
    if (overview.allComplete && overview.freePlayEnabled && overview.freePlayEnergyMode === "almost-zero") return childEnergyPresentation["almost-zero"];
    return childEnergyPresentation[settings.energyMultipliers?.[mode]] || childEnergyPresentation.medium;
  }

  function scaledEnergyGain(baseAmount, mode = state.mode) {
    const amount = Number(baseAmount) || 0;
    if (amount <= 0) return 0;
    return Math.max(1, Math.round(amount * energyPresentationForMode(mode).multiplier));
  }

  function questBonusAvailable() {
    if (qaProgressModeEnabled() || questBonusSelecting || roundTransaction) return false;
    const today = japanDateKey();
    return missionOverview().allComplete && profileStore.getQuestBonusClaimDate() !== today;
  }
  function promptQuestBonusIfAvailable() {
    if (!questBonusAvailable()) return false;
    questBonusSelectionDate = japanDateKey();
    questBonusSelectionProfileId = profileStore.getActiveProfileId();
    const mission = dailyMissionState();
    if (!mission.questRewardLevel) {
      mission.questRewardLevel = levelSystem.levelAt(profileStore.getPointLedger()?.total || 0);
      profileStore.setDailyMission(mission);
    }
    questBonusSelecting = true;
    void openPhonicsRewardSelection({ quest: true });
    return true;
  }

  function openModeSelect() {
    recordVisualDiagnostic("top-start-tap", visualVehicleSnapshot());
    renderModeSelectMission();
    showFixedScreenWhenReady("mode-select-screen");
    // Preload the YouTube player while the user is choosing a mode. This makes
    // the subsequent phonics-mode tap the only interaction needed before play.
    preparePhonicsYoutubePlayback();
  }
  $("quest-bonus-continue").addEventListener("click", promptQuestBonusIfAvailable);
  function startGameFromGesture(mode) {
    if (!isModeAvailableForMission(mode)) { renderModeSelectMission(); return; }
    recordVisualDiagnostic("mode-select-tap", { mode, ...visualVehicleSnapshot() });
    beginDailyMissionAttempt(mode);
    primeBackgroundMusicFromGesture("game"); playStartSound(); audioContext(); preloadFanfareSounds(); beginRound(mode);
  }
  function startApp() { startGameFromGesture("normal"); }
  function startLongDivisionApp() { startGameFromGesture("longdivision"); }
  function startNumberCardApp() { startGameFromGesture("numbercards"); }
  function startMultiplicationApp() { startGameFromGesture("multiplication"); }
  function startTwoDigitMultiplicationApp() { startGameFromGesture("multiplication2x2"); }
  function startTwoDigitMultiplicationUnguidedApp() { startGameFromGesture("multiplication2x2-unguided"); }
  function startTwoDigitMultiplicationZeroApp() { startGameFromGesture("multiplication2x2-zero"); }
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
    if (((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero"))) {
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
    if (((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero"))) { renderTwoDigitMultiplication(); return; }
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
    playSimpleCorrectSound();
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
  function calculationInputOrder(resultValue, lowerPlaceCount) {
    const resultDigits = String(resultValue).length;
    const lowerCount = Math.max(0, Math.min(lowerPlaceCount, resultDigits - 1));
    const order = [];
    // Ordinary column results are written from right to left. When the final
    // calculation produces a multi-digit block (for example 10), that block is
    // written as one number from left to right.
    for (let index = resultDigits - 1; index >= resultDigits - lowerCount; index -= 1) order.push(index);
    for (let index = 0; index < resultDigits - lowerCount; index += 1) order.push(index);
    return order;
  }
  function multiplicationInputOrder(multiplicand, product) {
    return calculationInputOrder(product, String(multiplicand).length - 1);
  }
  function twoDigitTotalInputOrder(question) {
    const partial1Places = String(question.partial1).length;
    // The tens partial row is displayed one place to the left.
    const partial2Places = String(question.partial2).length + 1;
    const highestOccupiedPlace = Math.max(partial1Places, partial2Places) - 1;
    return calculationInputOrder(question.product, highestOccupiedPlace);
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
    const specialZero = state.mode === "multiplication2x2-zero" && question.multiplier % 10 === 0;
    const rows = [
      { key: "partial1", value: specialZero ? totalText : partial1Text, holder: $("multiplication-2x2-partial-1"), order: specialZero ? [totalText.length - 1, ...twoDigitRowOrder(question.multiplicand, question.partial2)] : twoDigitRowOrder(question.multiplicand, question.partial1) },
      { key: "partial2", value: partial2Text, holder: $("multiplication-2x2-partial-2"), order: twoDigitRowOrder(question.multiplicand, question.partial2) },
      { key: "total", value: totalText, holder: $("multiplication-2x2-total"), order: twoDigitTotalInputOrder(question) }
    ];
    rows.forEach((row) => makeTwoDigitSlots(row.holder, row.value.length));
    makeMultiplicationDigits($("multiplication-2x2-multiplicand"), question.multiplicand);
    makeMultiplicationDigits($("multiplication-2x2-multiplier"), question.multiplier);
    $("multiplication-2x2-panel").classList.toggle("is-zero-single-row", specialZero);
    $("multiplication-2x2-multiplier").lastElementChild?.classList.toggle("is-special-zero", specialZero);
    $("multiplication-2x2-partial-1").style.gridColumn = `${5 - (specialZero ? totalText.length : partial1Text.length)} / 5`;
    $("multiplication-2x2-partial-2").style.gridColumn = `${4 - partial2Text.length} / 4`;
    $("multiplication-2x2-total").style.gridColumn = `${5 - totalText.length} / 5`;
    const inputOrder = [];
    rows.forEach((row, rowIndex) => { if (specialZero && rowIndex > 0) return; row.order.forEach((cellIndex) => inputOrder.push({ rowIndex, cellIndex })); });
    state.multiplication2x2 = {
      rows: rows.map((row) => ({
        ...row,
        cells: Array(row.value.length).fill(""),
        hintedIndexes: new Set(),
        wrongIndexes: new Set(),
        feedback: null
      })),
      inputOrder, inputStep: 0, history: [], specialZero,
      guideStage: 1,
      shiftGuideVisible: false,
      sumOperatorVisible: false,
      sumTransitionPending: false
    };
    renderTwoDigitMultiplication();
  }
  function renderTwoDigitMultiplication() {
    const model = state.multiplication2x2; if (!model) return;
    const active = model.inputOrder[model.inputStep] || null;
    model.rows.forEach((row, rowIndex) => {
      row.holder.classList.toggle("is-step-wrong", row.feedback === "wrong");
      row.holder.querySelectorAll(".multiplication-2x2-slot").forEach((slot, cellIndex) => {
        slot.textContent = row.cells[cellIndex];
        slot.classList.toggle("is-active", Boolean(active && active.rowIndex === rowIndex && active.cellIndex === cellIndex));
        slot.classList.toggle("is-hinted", row.hintedIndexes.has(cellIndex));
        slot.classList.toggle("is-step-wrong-digit", row.wrongIndexes.has(cellIndex));
        slot.classList.toggle("is-special-zero", model.specialZero && rowIndex === 0 && cellIndex === row.value.length - 1);
        slot.classList.toggle("is-special-zero-wrong", model.specialZero && rowIndex === 0 && row.wrongIndexes.has(cellIndex));
      });
    });
    const operationGuide = $("multiplication-2x2-operation-guide");
    const unguided = state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero";
    const isGuidedMultiplicationRow = !unguided && (model.guideStage === 1 || model.guideStage === 2);
    operationGuide.hidden = !isGuidedMultiplicationRow;
    operationGuide.dataset.stage = model.guideStage === 1 ? "ones" : "tens";
    $("multiplication-2x2-shift-guide").hidden = unguided || !model.shiftGuideVisible;
    const sumOperator = $("multiplication-2x2-sum-operator");
    sumOperator.hidden = unguided || !model.sumOperatorVisible;
    if (!unguided && model.sumOperatorVisible) positionTwoDigitSumOperator();
  }
  function positionTwoDigitSumOperator() {
    const panel = $("multiplication-2x2-panel");
    const partial2 = $("multiplication-2x2-partial-2");
    const operator = $("multiplication-2x2-sum-operator");
    // One full digit column (64px) plus its regular gap (12px) left of the
    // most-significant second partial digit.  Positioning it outside the panel
    // also keeps the three-digit partial-product case inside the card.
    const columnStep = 76;
    operator.style.left = `${panel.offsetLeft + partial2.offsetLeft - columnStep}px`;
    operator.style.top = `${panel.offsetTop + partial2.offsetTop + (partial2.offsetHeight / 2)}px`;
  }
  function playTwoDigitRowCorrectEffect(row) {
    if (!row?.holder) return;
    row.holder.querySelector(".multiplication-2x2-row-sparkles")?.remove();
    const trail = document.createElement("span");
    trail.className = "multiplication-2x2-row-sparkles";
    trail.setAttribute("aria-hidden", "true");
    trail.style.setProperty("--row-spark-distance", `${Math.max(105, row.holder.offsetWidth + 26)}px`);
    for (let index = 0; index < 28; index += 1) {
      const sparkle = document.createElement("i");
      sparkle.style.setProperty("--row-spark-y", `${-8 + (index % 5) * 4}px`);
      sparkle.style.setProperty("--row-spark-delay", `${index * 28}ms`);
      sparkle.style.setProperty("--row-spark-size", `${5 + (index % 4) * 2}px`);
      sparkle.style.setProperty("--row-spark-drift", `${(index % 3 - 1) * 6}px`);
      trail.appendChild(sparkle);
    }
    row.holder.appendChild(trail);
    window.setTimeout(() => trail.remove(), 760);
  }
  function showTwoDigitSecondRowGuides(model) {
    if (!model || model.guideStage !== 3) return;
    model.shiftGuideVisible = true;
    model.guideStage = 2;
    renderTwoDigitMultiplication();
  }
  function checkTwoDigitIntermediateRow(model, rowIndex) {
    if (!model || rowIndex < 0 || rowIndex >= model.rows.length - 1) return;
    const row = model.rows[rowIndex];
    if (row.cells.some((cell) => !cell)) return;
    const wrongIndexes = new Set();
    row.cells.forEach((digit, cellIndex) => {
      if (digit !== row.value[cellIndex]) wrongIndexes.add(cellIndex);
    });
    if (!wrongIndexes.size) {
      row.feedback = null;
      row.wrongIndexes.clear();
      // Keep the upper two-digit outline mounted between the multiplication rows.
      // Stage 3 shows only the upper outline while the lower digit guide switches.
      model.guideStage = rowIndex === 0 ? 3 : 0;
      renderTwoDigitMultiplication();
      playTwoDigitRowCorrectEffect(row);
      if (rowIndex === 0) {
        window.setTimeout(() => {
          if (state.multiplication2x2 !== model) return;
          showTwoDigitSecondRowGuides(model);
        }, 760);
      } else if (rowIndex === 1) {
        // Keep the final addition from starting in the brief interval before
        // the operator appears, so the child always sees why the next row is
        // an addition rather than another multiplication step.
        model.sumTransitionPending = true;
        window.setTimeout(() => {
          if (state.multiplication2x2 !== model) return;
          model.sumOperatorVisible = true;
          model.sumTransitionPending = false;
          renderTwoDigitMultiplication();
        }, 760);
      }
      return;
    }
    row.feedback = "wrong";
    row.wrongIndexes = wrongIndexes;
    if (state.current) {
      state.current.stepCorrectionUsed = true;
      state.current.progressPenalty = true;
    }
    renderTwoDigitMultiplication();
    playWrongSound();
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
    if (model.sumTransitionPending && model.inputOrder[model.inputStep]?.rowIndex === 2) return;
    noteQuestionActivity();
    const step = model.inputOrder[model.inputStep];
    const row = model.rows[step.rowIndex];
    if (model.specialZero && step.rowIndex === 0 && step.cellIndex === row.value.length - 1 && String(number) !== "0") {
      row.wrongIndexes.add(step.cellIndex);
      if (state.current) { state.current.stepCorrectionUsed = true; state.current.progressPenalty = true; }
      renderTwoDigitMultiplication();
      playWrongSound();
      return;
    }
    row.cells[step.cellIndex] = String(number);
    row.wrongIndexes.delete(step.cellIndex);
    if (model.specialZero && step.rowIndex === 0 && step.cellIndex === row.value.length - 1) {
      const slot = row.holder.children[step.cellIndex];
      if (slot) {
        slot.classList.remove("is-special-zero-sparkle");
        void slot.offsetWidth;
        slot.classList.add("is-special-zero-sparkle");
        playSimpleCorrectSound();
        window.setTimeout(() => slot.classList.remove("is-special-zero-sparkle"), 700);
      }
    }
    model.history.push({ ...step });
    model.inputStep += 1;
    advanceTwoDigitMultiplicationStep(model);
    renderTwoDigitMultiplication();
    if (!model.specialZero && step.rowIndex < model.rows.length - 1 && row.cells.every(Boolean)) {
      checkTwoDigitIntermediateRow(model, step.rowIndex);
    }
    if (model.inputStep >= model.inputOrder.length) {
      const allRowsCorrect = model.specialZero ? model.rows[0].cells.join("") === model.rows[0].value : model.rows.every((currentRow) => currentRow.cells.join("") === currentRow.value);
      const total = Number(model.rows[model.specialZero ? 0 : 2].cells.join(""));
      judge({ quotient: allRowsCorrect ? total : total + 1, remainder: 0, usedRemainder: false });
    }
  }
  function clearTwoDigitMultiplicationInput() {
    const model = state.multiplication2x2;
    if (!model || !model.history.length) return;
    const step = model.history.pop();
    const row = model.rows[step.rowIndex];
    row.cells[step.cellIndex] = "";
    row.wrongIndexes.delete(step.cellIndex);
    model.inputStep = 0;
    advanceTwoDigitMultiplicationStep(model);
    renderTwoDigitMultiplication();
  }
  function fillTwoDigitMultiplicationAnswer(question) {
    const model = state.multiplication2x2; if (!model) return;
    const values = model.specialZero ? [String(question.product), String(question.partial2), String(question.product)] : [String(question.partial1), String(question.partial2), String(question.product)];
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
    if (((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero"))) { inputTwoDigitMultiplicationNumber(number); return; }
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
    if (((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero"))) { clearTwoDigitMultiplicationInput(); return; }
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
    return { ...question, hintUsed: false, hadWrong: false, stepCorrectionUsed: false, progressPenalty: Boolean(question.progressPenalty || question.hintUsed || question.hadWrong || question.answerRevealed || question.stepCorrectionUsed), answerRevealed: false, assistedCorrect: false, resultType: null, isReview: true };
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
    if (((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero"))) {
      const model = state.multiplication2x2;
      const step = model?.inputOrder[model.inputStep];
      if (model?.sumTransitionPending && step?.rowIndex === 2) return;
      state.current.hintUsed = true;
      if (!step) {
        if (state.current.isReview || state.phase === "retry") revealAnswer(); else openAnswerConfirmation();
        return;
      }
      const row = model.rows[step.rowIndex];
      row.cells[step.cellIndex] = row.value[step.cellIndex];
      row.hintedIndexes.add(step.cellIndex);
      row.wrongIndexes.delete(step.cellIndex);
      model.inputStep += 1;
      advanceTwoDigitMultiplicationStep(model);
      renderTwoDigitMultiplication();
      if (step.rowIndex < model.rows.length - 1 && row.cells.every(Boolean)) checkTwoDigitIntermediateRow(model, step.rowIndex);
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
  function openQuitConfirmation() {
    if (state.transitioning || state.confirmingQuit) return;
    state.confirmingQuit = true;
    pauseGameTimer();
    stopQuestionTimeout();
    setKeypadDisabled(true);
    $("quit-confirm").hidden = false;
    $("quit-confirm-continue").focus();
  }
  function closeQuitConfirmation() {
    if (!state.confirmingQuit) return;
    state.confirmingQuit = false;
    $("quit-confirm").hidden = true;
    setKeypadDisabled(false);
    resumeGameTimer();
    if (state.current && (state.phase === "initial" || state.phase === "retry") && !state.transitioning) startQuestionTimeout();
    $("quit-button").focus();
  }
  function confirmQuitToModeSelect() {
    if (!state.confirmingQuit) return;
    state.confirmingQuit = false;
    $("quit-confirm").hidden = true;
    endToModeSelect();
  }
  function formatRevealedAnswer(question) {
    return question.remainder === 0 ? `${question.quotient}（あまりなし）` : `${question.quotient}…${question.remainder}`;
  }
  function renderRevealedAnswer(question) {
    if (((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero"))) { fillTwoDigitMultiplicationAnswer(question); return; }
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
    if (state.mode === "numbercards" || (state.mode === "counting1" || state.mode === "counting2") || state.mode === "multiplication" || ((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero"))) { useHint(); return; }
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
    const needed = visualEnergy?.required ?? (progress.masterMedal ? 500 : requiredEnergyForStage(progress.stage));
    const currentEnergy = visualEnergy?.energy ?? progress.energy;
    const capsule = $("energy-capsule");
    capsule.style.setProperty("--capsule-height", `${({ 30: 194, 50: 254, 100: 314, 200: 374, 500: 374 })[needed] || 194}px`);
    $("energy-fill").style.height = `${Math.max(0, Math.min(100, (currentEnergy / needed) * 100))}%`;
    $("energy-current").textContent = String(currentEnergy);
    $("energy-required").textContent = String(needed);
  }
  function showProgressSpeechBubbleForCurrentQuestion(vehicleIndex) {
    const question = state.current;
    if (!question || question.vehicleIndex !== vehicleIndex || question.isReview || question.hintUsed || question.stepCorrectionUsed || question.answerRevealed) return;
    const spec = progressSpeechBubbleSpec(vehicleIndex);
    if (!spec || spec.stage !== question.answerStage) return;
    const bubble = $("answer-bubble");
    const character = $("answer-character");
    if (!bubble || !character) return;
    positionAnswerBubble(bubble, spec.stage, character);
    const reveal = () => {
      if (state.current !== question) return;
      const currentSpec = progressSpeechBubbleSpec(vehicleIndex);
      if (!currentSpec || currentSpec.stage !== question.answerStage || question.hintUsed || question.stepCorrectionUsed || question.answerRevealed) return;
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
    const scale = stageRect.width / stageCanvasWidth || 1;
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
  function twoDigitMultiplicationInputCellCount(question) {
    if (!question || question.kind !== "multiplication2x2") return 0;
    return String(question.partial1).length + String(question.partial2).length + String(question.product).length;
  }
  function getTimeBonusForCorrect(question = state.current) {
    if (!timeBonusConfig.enabled || state.phase !== "initial" || !question || question.isReview) return null;
    if (!timeBonusConfig.modes.includes(state.mode) || question.hintUsed || question.hadWrong || question.answerRevealed || question.progressPenalty) return null;
    const progress = vehicleProgress(question.vehicleIndex ?? state.currentVehicleIndex);
    if (!progress.friendly || (progress.masterMedal && progress.energy >= 500)) return null;
    const answerDigits = timeBonusAnswerDigits(question);
    const inputCellCount = twoDigitMultiplicationInputCellCount(question);
    const limitMs = question.kind === "multiplication2x2"
      ? inputCellCount * 2000
      : timeBonusConfig.limitMsByAnswerDigits[answerDigits];
    const startedAt = Number(question.timeBonusStartedAt);
    const elapsedMs = performance.now() - startedAt;
    if (!limitMs || !Number.isFinite(startedAt) || startedAt <= 0) return null;
    if (question.kind === "multiplication2x2" ? elapsedMs >= limitMs : elapsedMs > limitMs) return null;
    return { amount: timeBonusConfig.amount, answerDigits, inputCellCount, limitMs, elapsedMs };
  }
  const acquisitionDefinitions = Object.freeze({
    vehicle_discovered: Object.freeze({ rewardStage: 1, rewardKind: "discovery", displayForm: "vehicle", endsChallenge: false }),
    friendship_complete: Object.freeze({ rewardStage: 1, rewardKind: "friendship", displayForm: "vehicle", endsChallenge: true }),
    robot: Object.freeze({ rewardStage: 2, rewardKind: "evolution", displayForm: "robot", endsChallenge: true }),
    super_robot: Object.freeze({ rewardStage: 3, rewardKind: "evolution", displayForm: "super_robot", endsChallenge: true }),
    super_robot_equipped: Object.freeze({ rewardStage: 4, rewardKind: "evolution", displayForm: "super_robot_equipped", endsChallenge: true }),
    master_medal: Object.freeze({ rewardStage: 5, rewardKind: "evolution", displayForm: "master_medal", endsChallenge: true })
  });
  function addCompletedRewardToSession(reward) {
    // Session GET rendering only. Persistence is committed before this is called.
    if (!reward?.isNew) return;
    const key = `${reward.vehicleIndex}:${reward.stage}:${reward.kind}`;
    if (!state.sessionResultGets.some((item) => `${item.vehicleIndex}:${item.stage}:${item.kind}` === key)) state.sessionResultGets.push({ ...reward });
    state.collectionNewVehicleIndexes.add(reward.vehicleIndex);
  }
  function recordCommittedAcquisition({ vehicleIndex, acquisitionType, source, definition }) {
    // QA, migration, fallback, and UI replay never invoke commitAcquisition.
    if (qaProgressModeEnabled()) return;
    const vehicle = vehicles[vehicleIndex];
    if (!vehicle) return;
    const acquisition = {
        vehicleId: vehicle.stem,
        mode: state.mode,
        source,
        acquisitionType,
        displayForm: definition.displayForm,
        displayStage: currentStageForVehicle(vehicleIndex)
      };
    if (roundTransaction) { roundTransaction.acquisitionHistory.push(acquisition); return; }
    try { profileStore.appendAcquisitionHistory(acquisition); } catch (_) {}
  }
  function commitAcquisition({ vehicleIndex, acquisitionType, stage, source = "normal" }) {
    const definition = acquisitionDefinitions[acquisitionType];
    const progress = vehicleProgress(vehicleIndex);
    if (!definition || definition.rewardStage !== stage || !progress) return null;
    if (acquisitionType === "vehicle_discovered") {
      if (progress.discovered) return null;
      progress.discovered = true; progress.stage = 2; progress.friendship = 0; progress.friendly = false; progress.energy = 0;
    } else if (acquisitionType === "friendship_complete") {
      if (!progress.discovered || progress.friendly || progress.friendship < 5) return null;
      progress.friendship = 5; progress.friendly = true;
      state.sessionUnlocks[1] += 1;
    } else {
      const expectedStage = stage;
      if (!progress.friendly || progress.masterMedal || progress.stage !== expectedStage) return null;
      progress.energy = 0;
      if (acquisitionType === "master_medal") progress.masterMedal = true;
      else progress.stage += 1;
      state.sessionUnlocks[stage] += 1;
    }
    if (vehicleIndex === state.currentVehicleIndex) state.currentStage = currentStageForVehicle(vehicleIndex);
    const reward = { stage, vehicleIndex, isNew: true, kind: definition.rewardKind, endsChallenge: definition.endsChallenge };
    recordCommittedAcquisition({ vehicleIndex, acquisitionType, source, definition });
    addCompletedRewardToSession(reward);
    saveCollectionProgress();
    return reward;
  }
  function saveCollectionProgress() {
    saveRewardProgress();
    syncCollectionFromRewardProgress();
  }
  function completeEnergyStage(progress, vehicleIndex, source = "normal") {
    const stage = progress.stage;
    const acquisitionType = ({ 2: "robot", 3: "super_robot", 4: "super_robot_equipped", 5: "master_medal" })[stage];
    return acquisitionType ? commitAcquisition({ vehicleIndex, acquisitionType, stage, source }) : null;
  }
  function applyEnergyGain(progress, vehicleIndex, amount, { completeStage = true, source = "normal" } = {}) {
    const required = progress.masterMedal ? 500 : requiredEnergyForStage(progress.stage);
    progress.energy = Math.min(required, progress.energy + amount);
    const appliedEnergy = progress.energy;
    const reward = completeStage && !progress.masterMedal && progress.energy >= required ? completeEnergyStage(progress, vehicleIndex, source) : null;
    return { reward, required, appliedEnergy };
  }
  function finishDeferredTimeBonusProgress(deferred) {
    const progress = vehicleProgress(deferred.vehicleIndex);
    const gain = applyEnergyGain(progress, deferred.vehicleIndex, deferred.timeBonus.amount, { completeStage: false });
    const { required, appliedEnergy } = gain;
    const reward = !progress.masterMedal && progress.energy >= required ? completeEnergyStage(progress, deferred.vehicleIndex, "time_bonus") : null;
    if (!reward) saveCollectionProgress();
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
      reward = commitAcquisition({ vehicleIndex, acquisitionType: "vehicle_discovered", stage: 1 });
    } else if (!progress.friendly) {
      progress.friendship = Math.min(5, progress.friendship + 1);
      friendshipGain = 1;
      if (progress.friendship === 5) {
        // Friendship itself awards the vehicle. Energy starts on the next
        // encounter, never on this fifth-heart answer.
        reward = commitAcquisition({ vehicleIndex, acquisitionType: "friendship_complete", stage: 1 });
      }
    } else if (!progress.masterMedal || progress.energy < 500) {
      const assistedOrPenalized = question.hintUsed || question.hadWrong || question.progressPenalty;
      const baseEnergyGain = assistedOrPenalized ? 1 : question.kind === "multiplication2x2" ? 5 : 3;
      energyGain = scaledEnergyGain(baseEnergyGain, state.mode);
      const timeBonus = getTimeBonusForCorrect(question);
      if (timeBonus) deferredTimeBonus = { vehicleIndex, energyGain, timeBonus };
      else {
        const gain = applyEnergyGain(progress, vehicleIndex, energyGain);
        reward = gain.reward;
        energyVisual = { vehicleIndex, energy: gain.appliedEnergy, required: gain.required };
      }
    }
    if (vehicleIndex === state.currentVehicleIndex) state.currentStage = currentStageForVehicle(vehicleIndex);
    // Ordinary point gains remain progress-only; acquisitions persist inside
    // commitAcquisition together with history and session GET data.
    if (!deferredTimeBonus && !reward) saveCollectionProgress();
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

  function removeMultiplicationCorrectionOverlays() {
    $("play-stage").querySelectorAll(".multiplication-correction-overlay").forEach((node) => node.remove());
  }
  function addMultiplicationCorrectionOverlay(slot, expected) {
    const stage = $("play-stage");
    const stageRect = stage.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const scale = stageRect.width / stageCanvasWidth || 1;
    const correction = document.createElement("span");
    correction.className = "multiplication-correction-overlay";
    correction.textContent = expected;
    correction.style.left = ((slotRect.left + slotRect.width / 2 - stageRect.left) / scale) + "px";
    correction.style.top = ((slotRect.bottom - stageRect.top) / scale + 4) + "px";
    stage.appendChild(correction);
  }
  function showWrongDigitCorrections() {
    const question = state.current;
    if (!question || ["numbercards", "counting1", "counting2"].includes(state.mode)) return;
    const markDigit = (slot, expected, placement) => {
      if (!slot || slot.textContent.trim() === String(expected)) return;
      const original = document.createElement("span");
      original.textContent = slot.textContent.trim() || "＿";
      original.className = "incorrect-digit";
      const cross = document.createElement("span");
      cross.className = "incorrect-digit-cross";
      cross.setAttribute("aria-hidden", "true");
      const correction = document.createElement("span");
      correction.className = "incorrect-digit-correction " + placement;
      correction.textContent = String(expected);
      slot.replaceChildren(original, cross, correction);
      slot.classList.add("has-digit-correction");
    };
    if (state.mode === "multiplication" && state.multiplication) {
      const expected = String(question.product ?? question.quotient);
      removeMultiplicationCorrectionOverlays();
      Array.from($("multiplication-answer-row").children).forEach((slot, i) => {
        if (state.multiplication.cells[i] !== expected[i]) {
          markDigit(slot, expected[i] ?? "", "below");
          // Corrections in the grid are clipped by ancestor paint containment.
          // Mount the red answer directly in the scaled play stage instead.
          slot.querySelector(".incorrect-digit-correction")?.remove();
          addMultiplicationCorrectionOverlay(slot, expected[i] ?? "");
        }
      });
    } else if (((state.mode === "multiplication2x2" || state.mode === "multiplication2x2-unguided" || state.mode === "multiplication2x2-zero")) && state.multiplication2x2) {
      state.multiplication2x2.rows.forEach((row) => {
        Array.from(row.holder.querySelectorAll(".multiplication-2x2-slot")).forEach((slot, i) => {
          if (row.cells[i] !== row.value[i]) markDigit(slot, row.value[i], "below");
        });
      });
    } else if (state.mode === "longdivision" && state.longDivision) {
      const slots = Array.from($("long-division-slots").children);
      const expected = String(question.quotient).padStart(slots.length, " ");
      slots.forEach((slot, i) => {
        if (expected[i] !== " " && state.longDivision.cells[i] !== expected[i]) markDigit(slot, expected[i], "above");
      });
      if (Number(state.remainderInput || 0) !== question.remainder)
        markDigit($("long-division-remainder-slot"), question.remainder, "above");
    } else if (state.mode === "normal") {
      const holder = $("answer-text");
      const entered = holder.textContent;
      const parts = entered.split("…");
      const expectedQuotient = String(question.quotient);
      const expectedRemainder = Number(question.remainder);
      const digits = document.createDocumentFragment();
      const addPart = (value, target, side) => {
        const span = document.createElement("span");
        span.className = "inline-answer-part";
        span.textContent = value;
        digits.appendChild(span);
        if (value !== target) markDigit(span, target, side);
      };
      addPart(parts[0] || "", expectedQuotient, "left");
      if (parts.length > 1) {
        digits.appendChild(document.createTextNode("…"));
        addPart(parts[1] || "", String(expectedRemainder), "right");
      } else if (expectedRemainder !== 0) {
        const missing = document.createElement("span");
        missing.className = "missing-remainder-correction";
        missing.textContent = "…" + expectedRemainder;
        missing.setAttribute("aria-label", "正しいあまり " + expectedRemainder);
        digits.appendChild(missing);
      }
      holder.replaceChildren(digits);
    }
  }
  function judge(answer) {
    if (state.transitioning) return;
    state.transitioning = true;
    try {
    if (state.current.answerRevealed) { state.transitioning = false; return; }
    stopQuestionTimeout(); setKeypadDisabled(true); if (state.mode === "longdivision") renderLongDivision(); else $("answer-text").textContent = formatAnswer(answer);
    const hintInputTypeMatches = !state.current.hintUsed || Boolean(answer.usedRemainder) === (state.current.remainder !== 0);
    const correct = answer.quotient === state.current.quotient && answer.remainder === state.current.remainder && hintInputTypeMatches;
    const assistedCorrect = correct && state.phase === "initial" && (state.current.hintUsed || state.current.stepCorrectionUsed);
    let reward = null, progression = null;
    if (correct) {
      setQuestionCardState("correct");
      state.current.resultType = assistedCorrect ? "hint_correct" : "self_correct";
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
      playSimpleCorrectSound();
    } else {
      state.current.resultType = state.current.hintUsed ? "hint_wrong" : "self_wrong";
      state.current.hadWrong = true;
      setQuestionCardState("wrong");
      showWrongDigitCorrections();
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
    ) : (!["numbercards", "counting1", "counting2"].includes(state.mode) && ((state.phase === "initial" && (isFinalInitialQuestion() || state.current.vehicleChallengePosition >= 5)) || (state.phase === "retry" && state.retrySetPosition >= state.retrySetTotal))
      ? Math.max(wrongFeedbackDurationMs, 2000)
      : wrongFeedbackDurationMs));
    } catch (error) { state.transitioning = false; throw error; }
  }
  function showReward({ stage, vehicleIndex, isNew, replay = false, kind = "evolution" }, drawAfterReward = false, onDone = null) {
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
    $("reward-screen").classList.toggle("phonics-reward-overlay", Boolean(onDone) && state.collectionMode === "phonics-reward-select");
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
            if (onDone) onDone();
            else runAnswerTransition(advance);
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
      const composition = $("reward-complete-composition");
      const scene = buildStage5CollectionComposition(vehicleIndex);
      const artworkPath = "./assets/ui/reward_popup/reward_stage05_master-medal-get-overlay.webp";
      backplate.hidden = true;
      artwork.style.visibility = "hidden";
      artwork.hidden = replay;
      composition.replaceChildren();
      composition.hidden = true;
      preloadStage5RewardVisuals(vehicleIndex)
        .then(() => Promise.all([
          ...Array.from(scene.querySelectorAll("img[src]"), (image) => image.decode()),
          replay ? Promise.resolve() : decodeImageElement(artwork, artworkPath)
        ]))
        .then(() => {
          if (runId !== state.runId) return;
          composition.replaceChildren(scene);
          composition.hidden = false;
          if (!replay) { artwork.hidden = false; artwork.style.visibility = ""; }
          pauseGameTimer();
          // Keep the prepared play scene mounted beneath Stage 5 as well, so
          // its dismissal can reveal the next vehicle without a blank frame.
          setBackgroundMusicDucked(true);
          if (onDone) showRewardOverCollection();
          else showRewardOverPlay();
          if (isNew || replay) playFanfareSound();
          window.requestAnimationFrame(() => finishAfter((isNew || replay) ? 5000 : 1400, prepareNextVisuals()));
        }).catch((error) => {
          if (runId !== state.runId) return;
          console.error("Stage 5 reward visual failed to load", error);
          prepareNextVisuals().then(() => {
            if (runId !== state.runId) return;
            if (onDone) onDone();
            else runAnswerTransition(advance);
          });
        });
      return;
    }

    const backplate = $("reward-backplate"), artwork = $("reward-image");
    $("reward-complete-composition").hidden = true;
    $("reward-complete-composition").replaceChildren();
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
      if (onDone) showRewardOverCollection();
      else showRewardOverPlay();
      if (isNew || replay) playFanfareSound();
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
        if (onDone) onDone();
        else runAnswerTransition(advance);
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
    commitRoundTransaction();
    completeDailyMissionRound(state.mode);
    state.transitioning = true; state.phase = "result"; state.finalElapsedMs = getElapsedTime(); stopQuestionTimeout(); stopTimer();
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
    if (masterMedal) return equippedSuperRobotArtworkPath(vehicleIndex);
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
      const imageClass = isEquippedSuperRobotArtwork(image) ? " class=\"is-equipped-super-robot\"" : "";
      const meter = item.type === "friendship"
        ? `<div class="result-new-hearts" aria-label="なかよし ${item.to} / 5">${[5,4,3,2,1].map((level) => `<span class="${level <= item.to ? "is-earned" : ""} ${level > item.from && level <= item.to ? "is-gained" : ""}">♥</span>`).join("")}</div>`
        : `<div class="result-new-energy" aria-label="エネルギー ${item.to} / ${item.required}"><div class="result-new-energy-tank"><span class="result-new-energy-stack${item.from ? "" : " is-only-gain"}"><i style="height:${Math.min(100, item.from / item.required * 100)}%"></i><b style="height:${Math.min(100, Math.max(0, item.to - item.from) / item.required * 100)}%"></b></span></div><strong>${item.to}<small>/ ${item.required}</small></strong></div>`;
      return `<article class="result-new-progress-card"><div class="result-new-progress-vehicle"><img${imageClass} src="${image}" alt="${item.vehicle.nameJa}" decoding="async"><span>${item.vehicle.nameEn}</span></div><div class="result-new-meter"><b>${item.type === "friendship" ? "なかよし" : "エネルギー"}</b>${meter}</div></article>`;
    }).join("");
    const getSection = $("result-gets-section");
    getSection.hidden = state.sessionResultGets.length === 0;
    $("result-gets-list").innerHTML = state.sessionResultGets.map((item) => {
      const vehicle = vehicles[item.vehicleIndex];
      const master = item.stage === 5;
      const image = resultArtworkPath(item.vehicleIndex, Math.min(5, item.stage + 1), master);
      const imageClass = isEquippedSuperRobotArtwork(image) ? " class=\"is-equipped-super-robot\"" : "";
      return `<article class="result-new-get-card"><img${imageClass} src="${image}" alt="${vehicle.nameJa}" decoding="async"><div><span>${resultRewardLabel(item)}</span><strong>GET!</strong></div><i aria-hidden="true">✦</i></article>`;
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
    const scale = stageRect.width / stageCanvasWidth || 1;
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
    clearRetryAutoStartTimer(); clearIdleGuide(); stopTimer(); stopCollectionTimer(); state.collectionUsed = false; setKeypadDisabled(false);
    $("answer-confirm").hidden = true; $("quit-confirm").hidden = true; $("time-up").hidden = true;
    showFixedScreenWhenReady("start-screen");
  }
  function endToStart({ keepTimeUp = false } = {}) {
    resetCapsuleDialog();
    if (state.pendingNextVehicleOverlay) state.pendingNextVehicleOverlay.hidden = true;
    state.pendingNextVehicleOverlay = null;
    state.preparedNextQuestionVisual = null;
    state.runId += 1; state.phase = "start"; clearRetryAutoStartTimer(); clearIdleGuide(); stopQuestionTimeout(); stopTimer(); stopCollectionTimer(); state.startedAt = 0; state.timerPaused = false; state.timerPausedAt = 0; state.pausedTimerMs = 0;
    state.confirmingAnswer = false; state.confirmingQuit = false; state.current = null; state.collectionUsed = false; state.collectionNewVehicleIndexes = new Set(); state.preparedInitialVehicleIndex = null;
    setCollectionPresentationMode("browse");
    window.speechSynthesis?.cancel();
    prepareInitialVehicle();
    $("answer-confirm").hidden = true; $("quit-confirm").hidden = true;
    if (!keepTimeUp) $("time-up").hidden = true;
    showFixedScreenWhenReady("start-screen", [], () => {
      if (keepTimeUp) $("time-up").hidden = true;
      state.collectionClosing = false;
    });
  }

  function endToModeSelect() {
    cancelDailyMissionAttempt();
    discardRoundTransaction();
    resetCapsuleDialog();
    if (state.pendingNextVehicleOverlay) state.pendingNextVehicleOverlay.hidden = true;
    state.pendingNextVehicleOverlay = null;
    state.preparedNextQuestionVisual = null;
    state.runId += 1; state.phase = "start"; clearRetryAutoStartTimer(); clearIdleGuide(); stopQuestionTimeout(); stopTimer(); stopCollectionTimer(); state.startedAt = 0; state.timerPaused = false; state.timerPausedAt = 0; state.pausedTimerMs = 0;
    state.confirmingAnswer = false; state.confirmingQuit = false; state.current = null; state.collectionUsed = false; state.collectionNewVehicleIndexes = new Set(); state.preparedInitialVehicleIndex = null;
    window.speechSynthesis?.cancel();
    prepareInitialVehicle();
    $("answer-confirm").hidden = true; $("quit-confirm").hidden = true;
    $("time-up").hidden = true;
    renderModeSelectMission();
    showFixedScreenWhenReady("mode-select-screen", [], () => {
      state.collectionClosing = false;
    });
  }

  function renderCollectionBaseTitle() {
    const profile = profileStore.getActiveProfile();
    const playerName = profile?.displayName || "プレイヤー";
    const title = $("collection-header-title");
    const ruby = document.createElement("ruby");
    ruby.append(document.createTextNode("秘密基地"));
    const rt = document.createElement("rt");
    rt.textContent = "ひみつきち";
    ruby.append(rt);
    title.replaceChildren(document.createTextNode(`${playerName}のロボット`), ruby);
  }
  function setCollectionPresentationMode(mode = "browse") {
    state.collectionMode = mode;
    const selectionMode = mode === "phonics-reward-select";
    // Use the regular garage background in both modes.
    $("collection-screen").classList.toggle("is-phonics-reward-select", selectionMode);
    if (!selectionMode) $("collection-screen").classList.remove("is-quest-reward-select");
    if (selectionMode) $("collection-header-title").innerHTML = "どののりものが<ruby>育<rt>そだ</rt></ruby>つかな？";
    else renderCollectionBaseTitle();
    if (!selectionMode) {
      $("phonics-grow-confirm").hidden = true;
      $("phonics-reward-intro").hidden = true;
      $("collection-screen").classList.remove("is-phonics-reward-intro-open");
      state.phonicsRewardSelectedVehicleIndex = null;
      state.phonicsScanInProgress = false;
      document.getElementById("phonics-cross-scan")?.remove();
      document.getElementById("phonics-reward-scrim")?.remove();
      document.getElementById("phonics-scan-showcase")?.remove();
      $("collection-screen").classList.remove("is-phonics-scanning","is-phonics-winner-selected","is-phonics-reward-handoff-pending");
      $("reward-screen").classList.remove("phonics-reward-overlay");
    }
  }
  function seedPatrolCarForPhonicsRewardIfNeeded() {
    if (state.rewardProgress.some((progress) => progress?.discovered)) return;
    const progress = vehicleProgress(0);
    progress.discovered = true;
    progress.stage = 2;
    progress.friendship = 0;
    progress.friendly = false;
    progress.energy = 0;
    progress.masterMedal = false;
    saveCollectionProgress();
    try {
      profileStore.appendAcquisitionHistory({
        vehicleId: vehicles[0].stem,
        mode: "phonics",
        source: "phonics_fallback",
        acquisitionType: "vehicle_discovered",
        displayForm: "vehicle",
        displayStage: 2
      });
    } catch (_) {}
  }

  // Pick from all discovered vehicles, regardless of rarity.
  function randomPhonicsRewardVehicleIndex() {
    const eligible = vehicles.filter((vehicle) => vehicleProgress(vehicle.index).discovered);
    return (eligible[Math.floor(Math.random() * eligible.length)] || vehicles[0]).index;
  }
  function scanPause(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
  async function runPhonicsCrossScan({selectedVehicleIndex = null, skipSearch = false} = {}) {
    if (state.collectionMode !== "phonics-reward-select" || state.phonicsScanInProgress) return;
    state.phonicsScanInProgress = true;
    stopCollectionTimer();
    $("phonics-reward-intro").hidden = true;
    $("collection-screen").classList.remove("is-phonics-reward-intro-open");
    const vehicleIndex = Number.isInteger(selectedVehicleIndex) ? selectedVehicleIndex : randomPhonicsRewardVehicleIndex();
    state.phonicsRewardSelectedVehicleIndex = vehicleIndex;
    if (skipSearch) {
      stopQuestBonusTimer();
      $("phonics-grow-confirm").hidden = true;
    }
    const grid = $("collection-grid");
    const cards = [...grid.querySelectorAll(".collection-card")];
    const target = cards.find((card) => Number(card.dataset.vehicle) === vehicleIndex);
    if (!target) { state.phonicsScanInProgress = false; applyPhonicsRewardGrowth(vehicleIndex); return; }
    const stage = $("collection-stage");
    const stageRect = stage.getBoundingClientRect(), targetRect = target.getBoundingClientRect();
    // Convert viewport coordinates into stage CSS pixels (the stage is scaled on iPad).
    const scaleX = stageRect.width / stage.offsetWidth, scaleY = stageRect.height / stage.offsetHeight;
    const stageWidth = stage.offsetWidth, stageHeight = stage.offsetHeight;
    const x=(targetRect.left-stageRect.left)/scaleX, y=(targetRect.top-stageRect.top)/scaleY;
    const w=targetRect.width/scaleX, h=targetRect.height/scaleY;
    const centerX=x+w/2, centerY=y+h/2;
    const overlay=document.createElement("div");
    overlay.id="phonics-cross-scan";
    overlay.className="phonics-cross-scan";
    overlay.setAttribute("aria-hidden","true");
    overlay.innerHTML='<div class="phonics-scan-darkness"></div><div class="phonics-scan-beam phonics-scan-column"></div><div class="phonics-scan-beam phonics-scan-row"></div><div class="phonics-scan-impact"></div>';
    stage.append(overlay);
    $("collection-screen").classList.add("is-phonics-scanning");
    const darkness=overlay.querySelector(".phonics-scan-darkness");
    const column=overlay.querySelector(".phonics-scan-column"), row=overlay.querySelector(".phonics-scan-row"), impact=overlay.querySelector(".phonics-scan-impact");
    // One animation clock drives BOTH the beam and its reveal aperture.
    // No asynchronous WAAPI-vs-requestAnimationFrame tracking lag.
    const paintMask=(axis,center,radius)=>{
      const direction=axis==="X"?"right":"bottom";
      const moving=`linear-gradient(to ${direction},black ${center-radius}px,transparent ${center}px,black ${center+radius}px)`;
      const gradient=axis==="Y" ? `linear-gradient(to right,black ${centerX-w*.9}px,transparent ${centerX}px,black ${centerX+w*.9}px),${moving}` : moving;
      darkness.style.maskImage=gradient;
      darkness.style.webkitMaskImage=gradient;
    };
    const move=(beam,axis,targetCenter,dimension)=>new Promise(resolve=>{
      const span=axis==="X"?stageWidth:stageHeight;
      const size=dimension*1.25, radius=dimension*.9;
      beam.style[axis==="X"?"width":"height"]=size+"px";
      beam.style[axis==="X"?"height":"width"]="100%";
      // Beam CENTER reaches the actual full-stage boundaries before reversing.
      const stops=[0,span,0,targetCenter];
      const duration=6200, segments=[0,.32,.64,1];
      const started=performance.now();
      const tick=now=>{
        const progress=Math.min(1,(now-started)/duration);
        let segment=0;
        while(segment<2&&progress>segments[segment+1])segment++;
        const fraction=Math.max(0,Math.min(1,(progress-segments[segment])/(segments[segment+1]-segments[segment])));
        const eased=fraction*fraction*(3-2*fraction);
        const center=stops[segment]+(stops[segment+1]-stops[segment])*eased;
        beam.style.transform=axis==="X"
          ?`translate3d(${center-size/2}px,0,0)`
          :`translate3d(0,${center-size/2}px,0)`;
        paintMask(axis,center,radius);
        if(progress<1)window.requestAnimationFrame(tick);
        else resolve();
      };
      window.requestAnimationFrame(tick);
    });
    try {
      // Two bounces: far edge, near edge, then selected column.
      if (!skipSearch) {
      await move(column,"X",centerX,w);
      column.classList.add("is-locked");
      // Preserve the already-selected column while searching for the row.
      // Keep the chosen column visible throughout the half-second pause.
      paintMask("X",centerX,w*.9);
      darkness.classList.add("is-column-locked");
      darkness.style.setProperty("--locked-column-center",centerX+"px");
      darkness.style.setProperty("--locked-column-radius",w*.9+"px");
      await scanPause(500);
      // Two bounces: bottom, top, then selected row.
      await move(row,"Y",centerY,h);
      row.classList.add("is-locked");
      await scanPause(290);
      }
      // Flash ONLY after the row and column are both fully resolved.
      Object.assign(impact.style,{left:x+"px",top:y+"px",width:w+"px",height:h+"px"});
      impact.classList.add("is-revealed");
      target.classList.add("is-phonics-scan-winner");
      $("collection-screen").classList.add("is-phonics-winner-selected");
      darkness.style.opacity="1";
      darkness.style.webkitMaskImage="none";
      darkness.style.maskImage="none";
      column.style.opacity="0";
      row.style.opacity="0";
      await scanPause(skipSearch ? 400 : 900);
      // Animate a visual clone, keeping the actual collection card and artwork loaded.
      const showcase = document.createElement("div");
      showcase.id = "phonics-scan-showcase";
      showcase.className = "phonics-scan-showcase";
      const featured = target.cloneNode(true);
      featured.removeAttribute("id");
      featured.disabled = true;
      featured.classList.add("is-phonics-art-only");
      // The source card receives a strong scan-winner outline. Never clone that
      // effect into the enlarged card: it makes the frame and glow oversized.
      featured.classList.remove("is-phonics-scan-winner");
      // Keep the original card's own layout; only scale the complete card.
      featured.style.width = w + "px";
      featured.style.height = h + "px";
      featured.style.transformOrigin = "top left";
      const caption = document.createElement("div");
      caption.className = "phonics-scan-showcase-caption";
      const amount = phonicsGrowthAmountLabel(vehicleIndex);
      caption.replaceChildren(Object.assign(document.createElement("strong"),{textContent:vehicles[vehicleIndex].nameJa}), Object.assign(document.createElement("span"),{textContent:amount}));
      showcase.append(featured,caption);
      $("collection-stage").append(showcase);
      const originX=x,originY=y;
      const endW=Math.min(stageWidth*.525,630),endH=endW*(h/w);
      const endX=(stageWidth-endW)/2,endY=(stageHeight-endH)/2-35;
      state.phonicsShowcaseGeometry={left:endX,top:endY,width:endW,height:endH};
      const frame=(left,top,width,height)=>({left:left+"px",top:top+"px",width:width+"px",height:height+"px"});
      Object.assign(showcase.style,frame(originX,originY,w,h));
      const timing={duration:1000,easing:"cubic-bezier(.18,.85,.24,1)",fill:"forwards"};
      const fly=showcase.animate([frame(originX,originY,w,h),frame(endX,endY,endW,endH)],timing);
      const cardScale=endW/w;
      // Preserve the former preview's thin border instead of scaling the
      // collection card's native stroke several times larger.
      // The collection card is scaled but the halo is not: compensate its
      // source-space corner radius so both have the same rendered 14px arc.
      featured.style.setProperty("border-width","0","important");
      featured.style.setProperty("border-radius",(14/cardScale)+"px","important");
      featured.style.setProperty("clip-path",`inset(0 round ${14/cardScale}px)`,"important");
      const enlarge=featured.animate([{transform:"scale(1)"},{transform:`scale(${cardScale})`}],timing);
      await Promise.all([fly.finished,enlarge.finished]);
      Object.assign(showcase.style,frame(endX,endY,endW,endH));
      featured.style.transform=`scale(${cardScale})`;
      fly.cancel();enlarge.cancel();
      showcase.classList.add("is-settled");
      // Reuse the answer screen's actual progress UI, not collection card indicators.
      const progress=vehicleProgress(vehicleIndex);
      const isFriendship=!progress.friendly;
      const source=$(isFriendship?"friendship-progress":"energy-progress");
      const progressPanel=source.cloneNode(true);
      progressPanel.removeAttribute("id");
      progressPanel.removeAttribute("hidden");
      progressPanel.querySelectorAll("[id]").forEach(node=>node.removeAttribute("id"));
      const progressHolder=document.createElement("div");
      progressHolder.className="phonics-scan-progress";
      progressHolder.append(progressPanel);
      // Nest the unchanged arithmetic UI inside the card's right-hand space,
      // leaving a visible gap from the card frame.
      showcase.append(progressHolder);
      const amounts=phonicsGrowthAmounts();
      if(isFriendship){
        const hearts=[...progressPanel.querySelectorAll(".friendship-heart")];
        const initial=Math.min(5,progress.friendship);
        const final=Math.min(5,initial+amounts.friendship);
        const paint=count=>hearts.forEach((heart,i)=>heart.classList.toggle("is-filled",i>=5-count));
        paint(initial);
        await scanPause(600);
        for(let value=initial+1;value<=final;value++){paint(value);await scanPause(220);}
      }else{
        const needed=progress.masterMedal?500:requiredEnergyForStage(progress.stage);
        const initial=progress.energy,final=Math.min(needed,initial+amounts.energy);
        const capsule=progressPanel.querySelector(".energy-capsule");
        const fill=progressPanel.querySelector(".energy-fill");
        const current=progressPanel.querySelector(".energy-value span");
        const required=progressPanel.querySelector(".energy-value span:last-child");
        required.textContent=String(needed);
        const heights={30:194,50:254,100:314,200:374,500:374};
        capsule.style.setProperty("--capsule-height",(heights[needed]||194)+"px");
        const paint=value=>{fill.style.height=Math.min(100,value/needed*100)+"%";current.textContent=String(value);};
        paint(initial);
        await scanPause(600);
        const start=performance.now(),duration=1400;
        await new Promise(resolve=>{
          const tick=now=>{const ratio=Math.min(1,(now-start)/duration);paint(Math.round(initial+(final-initial)*ratio));if(ratio<1)requestAnimationFrame(tick);else resolve();};
          requestAnimationFrame(tick);
        });
      }
      await scanPause(900);
      // Keep the same neutral darkness throughout all reward phases.
      // Install before the scan darkness goes away, so no bright frame leaks.
      if (!document.getElementById("phonics-reward-scrim")) {
        const scrim=document.createElement("div");
        scrim.id="phonics-reward-scrim";
        scrim.className="phonics-reward-scrim";
        stage.append(scrim);
      }
      // Save the charged visual; hide it only while an acquisition popup plays.
      // Reuse this exact completed card for the subsequent collection handoff.
      state.phonicsChargedShowcase=showcase;
      showcase.remove();
    } finally {
      overlay.remove();
      if (state.phonicsChargedShowcase !== document.getElementById("phonics-scan-showcase"))
        document.getElementById("phonics-scan-showcase")?.remove();
      $("collection-screen").classList.remove("is-phonics-scanning");
      target.classList.remove("is-phonics-scan-winner");
      state.phonicsScanInProgress = false;
    }
    if (state.collectionMode === "phonics-reward-select") {
      $("collection-screen").classList.add("is-phonics-reward-handoff-pending");
      applyPhonicsRewardGrowth(vehicleIndex, showPhonicsCollectionHandoff);
    }
  }
  function phonicsGrowthAmounts() {
    if (questBonusSelecting) return { friendship:5, energy:8 + (dailyMissionState().questRewardLevel || levelSystem.levelAt(profileStore.getPointLedger()?.total || 0)) * 2 };
    return phonicsYoutube.rewardAlmostZero
      ? { friendship:1, energy:5 }
      : { friendship:5, energy:25 };
  }
  function phonicsGrowthAmountLabel(vehicleIndex) {
    const progress = vehicleProgress(vehicleIndex);
    const amounts = phonicsGrowthAmounts();
    return progress.friendly ? `エネルギー +${amounts.energy}` : `ハート +${amounts.friendship}`;
  }
  function openPhonicsGrowConfirm(vehicleIndex) {
    const progress = vehicleProgress(vehicleIndex);
    if (!progress.discovered || state.collectionMode !== "phonics-reward-select") return;
    state.phonicsRewardSelectedVehicleIndex = vehicleIndex;
    $("phonics-grow-vehicle-name").textContent = vehicles[vehicleIndex].nameJa;
    $("phonics-grow-amount").textContent = phonicsGrowthAmountLabel(vehicleIndex);
    $("phonics-grow-confirm").hidden = false;
    $("phonics-grow-accept").focus();
  }
  function closePhonicsGrowConfirm() {
    $("phonics-grow-confirm").hidden = true;
    state.phonicsRewardSelectedVehicleIndex = null;
  }
  function openNormalCollectionAfterPhonicsReward() {
    stopCollectionTimer();
    state.collectionClosing = false;
    setBackgroundMusicDucked(false);
    setCollectionPresentationMode("browse");
    // The browsing scene is ready; release the one persistent reward scrim.
    document.getElementById("phonics-reward-scrim")?.remove();
    $("collection-screen").classList.remove("is-phonics-reward-handoff-pending","is-phonics-winner-selected");
    $("reward-screen").classList.remove("phonics-reward-overlay");
    resetCapsuleDialog();
    state.collectionDeadline = Date.now() + 60000;
    $("collection-item-count").textContent = String(availableEnergyCapsuleCount());
    state.collectionShowSessionMarkers = true;
    prepareCollectionCategoryTabs();
    setCollectionCategory("summary");
    // Keep the existing garage cards mounted to avoid flashing empty images.
    $("collection-grid").querySelectorAll(".collection-card").forEach((card) => {
      const idx = Number(card.dataset.vehicle);
      const progress = vehicleProgress(idx);
      const status = card.querySelector(".collection-card-status");
      if (status?.classList.contains("collection-card-energy")) {
        const max = progress.masterMedal ? 500 : requiredEnergyForStage(progress.stage);
        const fill = status.querySelector("i");
        if (fill) fill.style.height = Math.min(100, progress.energy / max * 100)+"%";
        status.setAttribute("aria-label", `エネルギー ${progress.energy} / ${max}`);
      }
      if (idx === state.phonicsLastRewardVehicleIndex) {
        card.classList.add("is-up");
        const hearts = card.querySelector(".collection-card-hearts");
        if (hearts) {
          hearts.setAttribute("aria-label", `なかよし ${progress.friendship} / 5`);
          hearts.querySelectorAll("i").forEach((heart, i) => heart.classList.toggle("is-earned", 5-i <= progress.friendship));
        }
        if (progress.friendly && hearts) {
          hearts.remove();
          const energy = document.createElement("span");
          energy.className = "collection-card-status collection-card-energy";
          energy.setAttribute("aria-label", `エネルギー ${progress.energy} / ${requiredEnergyForStage(progress.stage)}`);
          const bar = document.createElement("i");
          bar.style.height = Math.min(100,progress.energy / requiredEnergyForStage(progress.stage)*100)+"%";
          energy.append(bar);
          card.append(energy);
        }
        const correctStage = progress.masterMedal ? 5 : Math.max(2,Math.min(5,progress.stage));
        if (Number(card.dataset.stage) !== correctStage) {
          card.dataset.stage = String(correctStage);
          const art = card.querySelector(".card-vehicle");
          if (art) art.src = answerArtworkPath(idx,correctStage);
        }
        card.querySelector(".card-vehicle")?.classList.toggle("is-pre-friendship",!progress.friendly && correctStage === 2);
      }
    });
    sizeCollectionStage();
    showScreen("collection-screen");
    updateCollectionClock();
    state.collectionTimerId = window.setInterval(updateCollectionClock, 200);
  }
  function showPhonicsCollectionHandoff() {
    const stage=$("collection-stage"), geometry=state.phonicsShowcaseGeometry;
    const showcase=state.phonicsChargedShowcase;
    $("reward-screen").classList.remove("active");
    screens.forEach(id=>$(id).classList.toggle("active",id==="collection-screen"));
    // Restore the exact completed showcase; reuse its existing caption rather
    // than layering a differently sized notification box over the reward text.
    if (showcase) {
      const caption=showcase.querySelector(".phonics-scan-showcase-caption");
      if (caption) {
        caption.replaceChildren(Object.assign(document.createElement("strong"),{
          textContent:"さあコレクションを見てみよう！"
        }));
        caption.classList.add("is-collection-handoff");
      }
      stage.append(showcase);
    }
    window.setTimeout(()=>{
      state.phonicsChargedShowcase?.remove();
      state.phonicsChargedShowcase=null;
      state.phonicsShowcaseGeometry=null;
      openNormalCollectionAfterPhonicsReward();
    },2500);
  }
  function applyPhonicsRewardGrowth(vehicleIndex, onFinished = showPhonicsCollectionHandoff) {
    if (!Number.isInteger(vehicleIndex)) return;
    const progress = vehicleProgress(vehicleIndex);
    if (!progress.discovered) return;
    state.collectionClosing = true;
    stopCollectionTimer();
    if (questBonusSelecting) stopQuestBonusTimer();
    $("phonics-grow-confirm").hidden = true;
    state.phonicsRewardSelectedVehicleIndex = null;
    state.phonicsLastRewardVehicleIndex = vehicleIndex;
    const amounts = phonicsGrowthAmounts();
    if (questBonusSelecting) {
      if (!questBonusSelectionDate || questBonusSelectionProfileId !== profileStore.getActiveProfileId()
        || profileStore.getQuestBonusClaimDate() === questBonusSelectionDate) return;
      questBonusClaimPendingDate = questBonusSelectionDate;
    }
    let reward = null;
    if (!progress.friendly) {
      progress.friendship = Math.min(5, progress.friendship + amounts.friendship);
      if (progress.friendship === 5) {
        reward = commitAcquisition({ vehicleIndex, acquisitionType: "friendship_complete", stage: 1, source: "phonics" });
      }
      if (!reward) saveCollectionProgress();
    } else if (progress.masterMedal) {
      const required = 500;
      progress.energy = Math.min(required, progress.energy + amounts.energy);
      saveCollectionProgress();
    } else {
      const gain = applyEnergyGain(progress, vehicleIndex, amounts.energy);
      reward = gain.reward;
      if (!reward) saveCollectionProgress();
    }
    // The selected quest charge and its once-per-day claim are saved together.
    if (questBonusSelecting) { questBonusSelecting = false; questBonusSelectionDate = null; questBonusSelectionProfileId = null; }
    // Retain the existing card DOM and artwork; only patch progress indicators.
    if (reward) {
      showReward(reward, false, onFinished);
      return;
    }
    onFinished();
  }
  function startPhonicsRewardVehicleSelection() {
    void runPhonicsCrossScan();
  }
  function cancelPhonicsRewardSelection() {
    $("phonics-reward-intro").hidden = true;
    $("collection-screen").classList.remove("is-phonics-reward-intro-open");
    setCollectionPresentationMode("browse");
    endToModeSelect();
  }
  async function openPhonicsRewardSelection({ quest = false } = {}) {
    stopCollectionTimer();
    state.collectionClosing = false;
    state.collectionUsed = true;
    seedPatrolCarForPhonicsRewardIfNeeded();
    state.collectionNewVehicleIndexes = new Set();
    state.resultStartProgress = state.rewardProgress.map((progress) => ({ ...progress }));
    await preloadCollectionVehicleArtwork();
    setCollectionPresentationMode("phonics-reward-select");
    state.collectionDeadline = 0;
    state.collectionShowSessionMarkers = false;
    setCollectionCategory("summary");
    renderCollectionGrid({ showSessionMarkers: false });
    sizeCollectionStage();
    $("collection-seconds").textContent = "60";
    $("detail-seconds").textContent = "60";
    showScreen("collection-screen");
    $("collection-screen").classList.add("is-phonics-reward-intro-open");
    $("phonics-reward-intro").hidden = quest;
    $("collection-screen").classList.toggle("is-quest-reward-select", quest);
    if (quest) {
      $("collection-screen").classList.remove("is-phonics-reward-intro-open");
      $("collection-header-title").innerHTML = `クエスト<ruby>達成<rt>たっせい</rt></ruby>！ そだてるのりものをえらぼう！`;
      startQuestBonusTimer();
    } else $("phonics-reward-intro-continue").focus();
  }

  // Inventory opens within the 60-second collection session. Only choosing a
  // capsule target pauses that session and starts a separate 30-second clock.
  let capsuleSelecting = false;
  let capsuleChoiceTimer = null;
  let capsuleChoiceDeadline = 0;
  let capsuleCollectionRemainingMs = 0;
  let capsuleToastTimer = null;
  function capsuleEligibleIndexes() {
    return collectionDisplayOrder.filter((index) => {
      const progress = vehicleProgress(index);
      return progress.discovered && progress.friendly;
    });
  }
  function updateCapsuleHeader() {
    $("collection-item-count").textContent = String(availableEnergyCapsuleCount());
    $("collection-item-owned").textContent = "× " + availableEnergyCapsuleCount();
    $("collection-item-use").disabled = !availableEnergyCapsuleCount() || !capsuleEligibleIndexes().length;
  }
  function clearCapsuleChoiceTimer() {
    if (capsuleChoiceTimer !== null) window.clearInterval(capsuleChoiceTimer);
    capsuleChoiceTimer = null;
  }
  function resetCapsuleDialog() {
    clearCapsuleChoiceTimer();
    if (capsuleToastTimer !== null) window.clearTimeout(capsuleToastTimer);
    capsuleToastTimer = null;
    $("collection-item-toast").hidden = true;
    capsuleSelecting = false;
    $("collection-screen").classList.remove("is-capsule-select");
    $("collection-capsule-time").hidden = true;
    capsuleChoiceDeadline = 0;
    capsuleCollectionRemainingMs = 0;
    $("collection-item-dialog").hidden = true;
    $("collection-item-panel").hidden = false;
    $("collection-item-target-panel").hidden = true;
  }
  function openCapsuleInventory() {
    if (state.collectionMode !== "browse" || state.collectionClosing
      || !$("collection-screen").classList.contains("active")) return;
    $("collection-item-dialog").hidden = false;
    $("collection-item-panel").hidden = false;
    $("collection-item-target-panel").hidden = true;
    $("collection-item-status").textContent = capsuleEligibleIndexes().length
      ? "" : "つかえるのりものがまだいないよ";
    updateCapsuleHeader();
    $("collection-item-close").focus();
  }
  function closeCapsuleInventory() {
    if (capsuleSelecting) return; // Selection is explicitly canceled with the back button.
    $("collection-item-dialog").hidden = true;
    $("collection-item-button").focus();
  }
  function resumeCapsuleCollectionClock() {
    if (!capsuleCollectionRemainingMs) return;
    if (!state.collectionClosing && state.collectionUsed) {
      state.collectionDeadline = Date.now() + capsuleCollectionRemainingMs;
      updateCollectionClock();
      if (state.collectionTimerId === null) state.collectionTimerId = window.setInterval(updateCollectionClock, 200);
    }
    capsuleCollectionRemainingMs = 0;
  }
  function cancelCapsuleSelection() {
    if (!capsuleSelecting) return;
    capsuleSelecting = false;
    clearCapsuleChoiceTimer();
    finishCapsuleSelectionUi();
    $("collection-item-panel").hidden = false;
    $("collection-item-status").textContent = "つかうのをやめたよ";
    updateCapsuleHeader();
    resumeCapsuleCollectionClock();
  }
  function useCapsuleOnVehicle(index) {
    if (!capsuleSelecting) return;
    const eligible = capsuleEligibleIndexes();
    if (!eligible.length) { cancelCapsuleSelection(); return; }
    const chosen = index === null ? eligible[Math.floor(Math.random() * eligible.length)] : index;
    if (!eligible.includes(chosen) || !availableEnergyCapsuleCount()) return;
    // Lock input before storage and progression updates, including timer callbacks.
    capsuleSelecting = false;
    clearCapsuleChoiceTimer();
    try {
      if (!availableEnergyCapsuleCount()) throw new Error("capsule inventory empty");
      capsuleSpendPending = true;
      const progress = vehicleProgress(chosen);
      const result = applyEnergyGain(progress, chosen, 20, { source: "energy_capsule" });
      if (!result.reward) saveCollectionProgress();
      if (capsuleSpendPending) throw new Error("capsule change was not saved");
      const toast = $("collection-item-toast");
      toast.textContent = vehicles[chosen].nameJa + " に\nエネルギーを20チャージ！";
      toast.hidden = false;
      $("collection-item-dialog").hidden = true;
      if (capsuleToastTimer !== null) window.clearTimeout(capsuleToastTimer);
      capsuleToastTimer = window.setTimeout(() => {
        toast.hidden = true;
        capsuleToastTimer = null;
        if (result.reward) {
          // ShowReward already invokes playFanfareSound() for newly earned evolutions.
          // Await the actual MP3 decoding so it cannot fall back to the short tone.
          preloadFanfareSounds().then(() => showReward(result.reward, false, () => {
            showScreen("collection-screen");
            updateCapsuleHeader();
            resumeCapsuleCollectionClock();
          }));
        } else {
          resumeCapsuleCollectionClock();
        }
      }, 2000);
    } catch (error) {
      capsuleSpendPending = false;
      // Reload persistent progress if a write failed before it committed.
      loadRewardProgress();
      console.error("Energy capsule use failed", error);
      $("collection-item-status").textContent = "うまくつかえなかったよ。おうちの人にみせてね";
    } finally {
      finishCapsuleSelectionUi();
      $("collection-item-panel").hidden = false;
      updateCapsuleHeader();
      // The normal clock resumes after the acquisition popup, not behind it.
      // Refresh only the target's visible energy meter; other names never remount.
      const chargedCard = document.querySelector(`#collection-grid .collection-card[data-vehicle="${chosen}"]`);
      if (chargedCard) {
        const current = vehicleProgress(chosen);
        const formStage = current.masterMedal ? 5 : Math.max(2, Math.min(5, current.stage));
        chargedCard.dataset.stage = String(formStage);
        const image = chargedCard.querySelector(".card-vehicle");
        if (image) {
          image.src = answerArtworkPath(chosen, formStage);
          image.classList.remove("is-vehicle-form", "is-evolved-form", "is-robot-form", "is-equipped-super-robot");
          image.classList.add(...(formStage === 2 ? ["is-vehicle-form"] : formStage === 3 ? ["is-evolved-form", "is-robot-form"] : formStage === 5 ? ["is-evolved-form", "is-equipped-super-robot"] : ["is-evolved-form"]));
        }
        const meter = chargedCard.querySelector(".collection-card-energy");
        if (meter) {
          const maxEnergy = current.masterMedal ? 500 : requiredEnergyForStage(current.stage);
          const fill = meter.querySelector("i");
          meter.setAttribute("aria-label", `エネルギー ${current.energy} / ${maxEnergy}`);
          if (fill) fill.style.height = `${Math.min(100, current.energy / maxEnergy * 100)}%`;
        }
      }
      if (chargedCard) {
        chargedCard.classList.remove("is-capsule-charged");
        void chargedCard.offsetWidth;
        chargedCard.classList.add("is-capsule-charged");
        window.setTimeout(() => chargedCard.classList.remove("is-capsule-charged"), 2000);
      }
      if (!capsuleToastTimer) resumeCapsuleCollectionClock();
    }
  }
  let capsulePreviousCategory = "summary";
  function finishCapsuleSelectionUi() {
    $("collection-screen").classList.remove("is-capsule-select");
    $("collection-capsule-time").hidden = true;
    $("collection-item-target-panel").hidden = true;
    renderCollectionBaseTitle();
    setCollectionCategory(capsulePreviousCategory);
    // Preserve the existing card nodes and their labels; only the charged
    // card needs a fresh render, avoiding a 20-card typography relayout.
    document.querySelectorAll("#collection-grid .collection-card").forEach((card) => {
      card.classList.remove("is-capsule-disabled");
      card.disabled = false;
      card.removeAttribute("aria-disabled");
    });
  }
  function startCapsuleSelection() {
    if (capsuleSelecting || !state.collectionUsed || state.collectionClosing
      || state.collectionMode !== "browse"
      || !availableEnergyCapsuleCount()) return;
    if (!capsuleEligibleIndexes().length) {
      $("collection-item-status").textContent = "つかえるのりものがまだいないよ";
      return;
    }
    capsuleSelecting = true;
    preloadFanfareSounds(); // Prepare one of the three acquisition fanfares before a capsule can trigger evolution.
    capsulePreviousCategory = state.collectionCategory;
    capsuleCollectionRemainingMs = Math.max(1, state.collectionDeadline - Date.now());
    stopCollectionTimer();
    $("collection-item-panel").hidden = true;
    $("collection-item-target-panel").hidden = false;
    $("collection-item-cancel").focus();
  }
  function beginCapsuleVehicleChoice() {
    if (!capsuleSelecting) return;
    $("collection-item-dialog").hidden = true;
    $("collection-screen").classList.add("is-capsule-select");
    $("collection-header-title").textContent = "どののりものにチャージする？";
    setCollectionCategory("summary");
    renderCollectionGrid({ showSessionMarkers: false });
    $("collection-capsule-time").hidden = true;
    $("collection-seconds").textContent = "30";
    capsuleChoiceDeadline = Date.now() + 30000;
    $("collection-item-target-seconds").textContent = "30";
    capsuleChoiceTimer = window.setInterval(() => {
      if (!capsuleSelecting) return;
      const remaining = Math.max(0, Math.ceil((capsuleChoiceDeadline - Date.now()) / 1000));
      $("collection-seconds").textContent = String(remaining);
      if (remaining === 0) useCapsuleOnVehicle(null);
    }, 100);
  }

  async function openCollection({ showSessionMarkers = true } = {}) {
    if (state.collectionUsed || state.collectionClosing) return;
    setCollectionPresentationMode("browse");
    state.collectionUsed = true;
    $("collection-button").disabled = true;
    $("collection-button").innerHTML = '<svg class="ui-icon collection-gem" aria-hidden="true"><use href="./assets/ui/icons/ui-icons.svg#gem"></use></svg><span class="collection-copy">コレクション<small>みおわったよ</small></span>';
    const runId = state.runId;
    await preloadCollectionVehicleArtwork();
    if (runId !== state.runId || !state.collectionUsed) return;
    state.collectionDeadline = Date.now() + 60000;
    state.collectionShowSessionMarkers = showSessionMarkers;
    prepareCollectionCategoryTabs();
    setCollectionCategory("summary"); renderCollectionGrid({ showSessionMarkers }); sizeCollectionStage(); showScreen("collection-screen"); updateCollectionClock();
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
    if (state.collectionMode === "phonics-reward-select") {
      return; // The scanner commits the reward; never roll from a timer.
      return;
    }
    state.collectionClosing = true;
    resetCapsuleDialog();
    acknowledgeCollectionCategoryTabs();
    stopCollectionTimer(); playCollectionEndSound(); $("time-up").hidden = false;
    window.setTimeout(() => endToModeSelect(), collectionEndTransitionDurationMs);
  }
  function stopCollectionTimer() {
    if (state.collectionTimerId !== null) { window.clearInterval(state.collectionTimerId); state.collectionTimerId = null; }
  }
  function setCollectionCategory(category) {
    const requestedCategory = category || "summary";
    const normalizedCategory = requestedCategory === "summary" || collectionCategoryAvailable(requestedCategory) ? requestedCategory : "summary";
    if (normalizedCategory !== state.collectionCategory) state.collectionCategoryPage = 0;
    state.collectionCategory = normalizedCategory;
    renderCollectionCategoryTabs();
    document.querySelectorAll(".category-button").forEach((button) => {
      const selected = button.dataset.category === normalizedCategory;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const categoryView = normalizedCategory !== "summary";
    $("collection-stage").classList.toggle("is-category-view", categoryView);
    $("collection-grid").hidden = categoryView;
    $("collection-category-scene").hidden = !categoryView;
    if (categoryView) {
      preloadDecodedImage(collectionCategoryBackgroundPaths[normalizedCategory]).catch(() => null);
      renderCollectionCategoryScene(normalizedCategory);
    }
  }
  function collectionSceneSlots(rows, idKey) {
    return [...rows].reverse().flatMap((row) => row[idKey].map((id, slotIndex) => ({
      ...row, slotId:id, x:row.centers[slotIndex]
    })));
  }
  const vehicleCollectionSlots = Object.freeze(collectionSceneSlots(vehicleCollectionRows, "ids"));
  const robotCollectionSlots = Object.freeze(collectionSceneSlots(robotCollectionRows, "localIds"));
  const collectionSceneOrderKeys = Object.freeze(["vehicle", "robot", "super-robot", "equipment", "medal"]);

  function collectionSceneQualifies(vehicleIndex, kind) {
    const progress = vehicleProgress(vehicleIndex);
    if (kind === "vehicle") return progress.discovered;
    if (kind === "robot") return progress.discovered && progress.stage >= 3;
    if (kind === "super-robot") return progress.discovered && progress.stage >= 4;
    if (kind === "equipment") return progress.discovered && progress.stage >= 5;
    if (kind === "medal") return progress.discovered && progress.masterMedal;
    return false;
  }
  function collectionCategoryAvailable(category) {
    return collectionSceneOrderKeys.includes(category) && vehicles.some((_, index) => collectionSceneQualifies(index, category));
  }
  function availableCollectionCategoryKeys() {
    return collectionSceneOrderKeys.filter(collectionCategoryAvailable);
  }
  function renderCollectionCategoryTabs() {
    const available = new Set(availableCollectionCategoryKeys());
    document.querySelectorAll(".category-button").forEach((button) => {
      const category = button.dataset.category;
      const visible = category === "summary" || available.has(category);
      button.hidden = !visible;
      button.classList.toggle("is-new-category", visible && state.collectionNewCategoryKeys.has(category));
    });
  }
  function prepareCollectionCategoryTabs() {
    const available = availableCollectionCategoryKeys();
    let seen = null;
    try { seen = profileStore.getCollectionCategorySeen(); } catch (_) {}
    if (seen === null) {
      // Profiles saved before category tabs became progressive already knew their
      // current categories. Seed those as seen so an update does not mark every tab red.
      try { profileStore.setCollectionCategorySeen(available); } catch (_) {}
      state.collectionNewCategoryKeys = new Set();
    } else {
      const seenSet = new Set(seen);
      state.collectionNewCategoryKeys = new Set(available.filter((category) => !seenSet.has(category)));
    }
    renderCollectionCategoryTabs();
  }
  function acknowledgeCollectionCategoryTabs() {
    const available = availableCollectionCategoryKeys();
    if (state.collectionNewCategoryKeys.size) {
      let seen = [];
      try { seen = profileStore.getCollectionCategorySeen() || []; } catch (_) {}
      try { profileStore.setCollectionCategorySeen([...seen, ...available]); } catch (_) {}
    }
    state.collectionNewCategoryKeys = new Set();
    renderCollectionCategoryTabs();
  }
  function collectionSceneAcquisitionType(kind) {
    return ({ vehicle:"vehicle_discovered", robot:"robot", "super-robot":"super_robot", equipment:"super_robot_equipped", medal:"master_medal" })[kind];
  }
  function emptyCollectionSceneOrder() {
    return { vehicle:[], robot:[], "super-robot":[], equipment:[], medal:[] };
  }
  function collectionSceneOrder(kind) {
    const qualified = vehicles.map((_, index) => index).filter((index) => collectionSceneQualifies(index, kind));
    let saved;
    try { saved = profileStore.getCollectionSceneOrder(); } catch (_) { saved = emptyCollectionSceneOrder(); }
    const current = Array.isArray(saved?.[kind]) ? saved[kind].filter((index, position, values) => Number.isInteger(index) && index >= 0 && index < vehicles.length && values.indexOf(index) === position) : [];
    const placed = new Set(current);
    const missing = qualified.filter((index) => !placed.has(index));
    if (missing.length) {
      let history = [];
      try { history = profileStore.getAcquisitionHistory(); } catch (_) {}
      const acquisitionType = collectionSceneAcquisitionType(kind);
      const sequenceByVehicle = new Map();
      history.forEach((entry) => {
        if (entry?.acquisitionType !== acquisitionType) return;
        const index = vehicles.findIndex((vehicle) => vehicle.stem === entry.vehicleId);
        if (index >= 0 && !sequenceByVehicle.has(index)) sequenceByVehicle.set(index, Number(entry.sequence) || Number.MAX_SAFE_INTEGER);
      });
      // Existing items with no trustworthy timing are seeded by stable vehicle ID.
      // Items with a recorded acquisition event follow in actual acquisition order.
      const unknown = missing.filter((index) => !sequenceByVehicle.has(index)).sort((a,b) => a - b);
      const known = missing.filter((index) => sequenceByVehicle.has(index)).sort((a,b) => sequenceByVehicle.get(a) - sequenceByVehicle.get(b) || a - b);
      current.push(...unknown, ...known);
      try {
        const next = Object.fromEntries(collectionSceneOrderKeys.map((key) => [key, [...(saved?.[key] || [])]]));
        next[kind] = current;
        profileStore.setCollectionSceneOrder(next);
      } catch (_) {}
    }
    const visible = current.filter((index) => collectionSceneQualifies(index, kind));
    if (kind !== "vehicle") {
      // Keep persisted acquisition order intact; sort the rendered scene by the
      // newest relevant event. Equipping a super robot makes it newest again.
      let recentHistory = [];
      try { recentHistory = profileStore.getAcquisitionHistory(); } catch (_) {}
      const eligibleTypes = kind === "super-robot"
        ? new Set(["super_robot", "super_robot_equipped"])
        : new Set([collectionSceneAcquisitionType(kind)]);
      const latestSequence = new Map();
      recentHistory.forEach((entry) => {
        if (!eligibleTypes.has(entry?.acquisitionType)) return;
        const index = vehicles.findIndex((vehicle) => vehicle.stem === entry.vehicleId);
        const sequence = Number(entry.sequence);
        if (index < 0 || !Number.isFinite(sequence)) return;
        latestSequence.set(index, Math.max(latestSequence.get(index) ?? -1, sequence));
      });
      const originalPosition = new Map(visible.map((index, position) => [index, position]));
      return visible.sort((a, b) =>
        (latestSequence.get(b) ?? -1) - (latestSequence.get(a) ?? -1)
        || originalPosition.get(b) - originalPosition.get(a));
    }
    let history = [];
    try { history = profileStore.getAcquisitionHistory(); } catch (_) {}
    const friendshipOrder = new Map();
    history.forEach((entry) => {
      if (entry?.acquisitionType !== "friendship_complete") return;
      const index = vehicles.findIndex((vehicle) => vehicle.stem === entry.vehicleId);
      if (index >= 0 && !friendshipOrder.has(index)) friendshipOrder.set(index, Number(entry.sequence) || Number.MAX_SAFE_INTEGER);
    });
    const discoveryOrder = new Map(visible.map((index, position) => [index, position]));
    return visible.sort((a, b) => {
      const aFriendly = vehicleProgress(a).friendly;
      const bFriendly = vehicleProgress(b).friendly;
      if (aFriendly !== bFriendly) return aFriendly ? -1 : 1;
      if (!aFriendly) return discoveryOrder.get(b) - discoveryOrder.get(a);
      return (friendshipOrder.get(b) ?? -1) - (friendshipOrder.get(a) ?? -1)
        || discoveryOrder.get(b) - discoveryOrder.get(a);
    });
  }
  function collectionCategoryPageSize(category) {
    return ({ robot:10, "super-robot":4, equipment:4 })[category] || 20;
  }
  function collectionCategoryPageCount(category) {
    return Math.max(1, Math.ceil(collectionSceneOrder(category).length / collectionCategoryPageSize(category)));
  }

  function collectionItemMarkup(vehicleIndex, kind, layout, grayscale = false) {
    const vehicle = vehicles[vehicleIndex];
    const artworkPath = ({
      vehicle:vehicleArtworkPath,
      robot:robotArtworkPath,
      "super-robot":(index) => vehicleProgress(index).stage >= 5 ? equippedSuperRobotArtworkPath(index) : superRobotArtworkPath(index),
      equipment:equipmentArtworkPath,
      medal:masterMedalArtworkPath
    })[kind](vehicleIndex);
    const anchorY = layout.anchorY ?? (kind === "vehicle" ? .925 : .955);
    const shadowWidth = layout.shadowWidth ?? (kind === "vehicle" ? layout.size * .70 : layout.size * .88);
    const shadowHeight = layout.shadowHeight ?? (kind === "vehicle" ? layout.size * .075 : Math.max(16, layout.size * .13));
    const shadowY = layout.contactY + (layout.shadowOffsetY ?? (kind === "vehicle" ? 0 : -7));
    const top = layout.contactY - layout.size * anchorY;
    const rowDepth = Math.round(layout.contactY);
    const newKinds = { vehicle: ["vehicle_discovered", "friendship_complete"], robot: ["robot"], "super-robot": ["super_robot", "super_robot_equipped"], equipment: ["super_robot_equipped"], medal: ["master_medal"] };
    const isNew = state.collectionShowSessionMarkers && state.sessionResultGets.some((item) => item.vehicleIndex === vehicleIndex && newKinds[kind].includes((item.stage === 1 ? item.kind === "discovery" ? "vehicle_discovered" : "friendship_complete" : ({ 2:"robot", 3:"super_robot", 4:"super_robot_equipped", 5:"master_medal" })[item.stage])));
    const shadow = kind === "medal" ? "" : '<span class="collection-scene-shadow"></span>';
    const artClasses = `collection-scene-art${grayscale ? " is-pre-friendship" : ""}${layout.flip ? " is-flipped" : ""}`;
    const shadowClass = layout.shadowVariant ? ` is-${layout.shadowVariant}` : "";
    return `<button class="collection-scene-item collection-scene-item-${kind}${shadowClass}${isNew ? " is-new" : ""}" data-vehicle="${vehicleIndex}" aria-label="${vehicle.nameJa}" style="z-index:${rowDepth};--item-x:${layout.x}px;--item-y:${top}px;--item-size:${layout.size}px;--shadow-x:${layout.x}px;--shadow-y:${shadowY}px;--shadow-width:${shadowWidth}px;--shadow-height:${shadowHeight}px">${shadow}<img class="${artClasses}" src="${artworkPath}" alt="" decoding="async">${isNew ? '<span class="collection-scene-new-orb" aria-hidden="true">NEW</span>' : ""}</button>`;
  }
  function renderVehicleCollectionScene() {
    return collectionSceneOrder("vehicle").slice(0, vehicleCollectionSlots.length).map((vehicleIndex, position) => {
      const progress = vehicleProgress(vehicleIndex);
      return collectionItemMarkup(vehicleIndex, "vehicle", vehicleCollectionSlots[position], !progress.friendly);
    }).join("");
  }
  function renderRobotCollectionScene() {
    const order = collectionSceneOrder("robot"), pageSize = 10;
    const pageItems = order.slice(state.collectionCategoryPage * pageSize, state.collectionCategoryPage * pageSize + pageSize);
    return pageItems.map((vehicleIndex, position) => collectionItemMarkup(vehicleIndex, "robot", robotCollectionSlots[position])).join("");
  }
  function renderFourUpCollectionScene(category, slots) {
    const order = collectionSceneOrder(category), pageSize = 4;
    const pageItems = order.slice(state.collectionCategoryPage * pageSize, state.collectionCategoryPage * pageSize + pageSize);
    return pageItems.map((vehicleIndex, position) => collectionItemMarkup(vehicleIndex, category, slots[position])).join("");
  }
  function renderMedalCollectionScene() {
    return collectionSceneOrder("medal").slice(0, medalCollectionSlots.length)
      .map((vehicleIndex, position) => collectionItemMarkup(vehicleIndex, "medal", medalCollectionSlots[position])).join("");
  }
  function renderCollectionPageIndicator(category, pageCount) {
    const indicator = $("collection-page-indicator");
    const labels = { robot:"ロボット", "super-robot":"スーパーロボット", equipment:"スペシャル装備" };
    indicator.setAttribute("aria-label", `${labels[category] || "一覧"}のページ`);
    indicator.innerHTML = Array.from({ length:pageCount }, (_, page) =>
      `<button type="button" data-collection-page="${page}" aria-label="${page + 1}ページ目"${page === state.collectionCategoryPage ? ' class="selected" aria-current="page"' : ' aria-current="false"'}></button>`
    ).join("");
    indicator.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => setCollectionCategoryPage(button.dataset.collectionPage)));
  }
  // Only reveal image art after all images for this view have decoded.
  // Frames/backgrounds and controls stay visible; each rerender cancels stale reveals.
  function revealCollectionArtworkTogether(container, imagesSelector) {
    const serial = String((Number(container.dataset.artRevealSerial) || 0) + 1);
    container.dataset.artRevealSerial = serial;
    container.classList.add("is-art-loading");
    const images = [...container.querySelectorAll(imagesSelector)];
    if (!images.length) { container.classList.remove("is-art-loading"); return; }
    Promise.allSettled(images.map((img) => {
      if (typeof img.decode === "function") return img.decode();
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once:true });
        img.addEventListener("error", resolve, { once:true });
      });
    })).then(() => {
      if (container.dataset.artRevealSerial !== serial || !container.isConnected) return;
      container.classList.remove("is-art-loading");
    });
  }
  function renderCollectionCategoryScene(category) {
    const scene = $("collection-category-scene");
    const items = $("collection-category-items");
    const indicator = $("collection-page-indicator");
    scene.dataset.category = category;
    scene.style.backgroundImage = `url("${collectionCategoryBackgroundPaths[category]}")`;
    const pageCount = collectionCategoryPageCount(category);
    if (state.collectionCategoryPage >= pageCount) state.collectionCategoryPage = 0;
    items.classList.add("is-art-loading");
    items.innerHTML = category === "vehicle" ? renderVehicleCollectionScene()
      : category === "robot" ? renderRobotCollectionScene()
      : category === "super-robot" ? renderFourUpCollectionScene(category, superRobotCollectionSlots)
      : category === "equipment" ? renderFourUpCollectionScene(category, equipmentCollectionSlots)
      : category === "medal" ? renderMedalCollectionScene()
      : "";
    const paged = ["robot", "super-robot", "equipment"].includes(category) && pageCount > 1;
    indicator.hidden = !paged;
    if (paged) renderCollectionPageIndicator(category, pageCount);
    else indicator.innerHTML = "";
    $("collection-series-prev").hidden = !paged;
    $("collection-series-next").hidden = !paged;
    items.querySelectorAll(".collection-scene-item").forEach((item) => item.addEventListener("click", () => openVehicleDetail(Number(item.dataset.vehicle))));
    revealCollectionArtworkTogether(items, ".collection-scene-art");
  }
  function setCollectionCategoryPage(page) {
    const pageCount = collectionCategoryPageCount(state.collectionCategory);
    if (pageCount < 2) {
      state.collectionCategoryPage = 0;
      renderCollectionCategoryScene(state.collectionCategory);
      return;
    }
    const rawPage = Number(page) || 0;
    const nextPage = ((rawPage % pageCount) + pageCount) % pageCount;
    if (nextPage === state.collectionCategoryPage) return;
    state.collectionCategoryPage = nextPage;
    renderCollectionCategoryScene(state.collectionCategory);
  }
  function openCollectionCategoryFromDetail(category) {
    const index = state.detailVehicleIndex;
    if (!collectionCategoryAvailable(category)) return;
    setCollectionCategory(category);
    const position = collectionSceneOrder(category).indexOf(index);
    if (position >= 0) {
      state.collectionCategoryPage = Math.floor(position / collectionCategoryPageSize(category));
      renderCollectionCategoryScene(category);
    }
    sizeCollectionStage();
    showScreen("collection-screen");
  }
  function attachDetailCategoryLink(element, category) {
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("aria-label", `${category === "medal" ? "マスターメダル" : category === "super-robot" ? "スーパーロボット" : category === "robot" ? "ロボット" : "乗り物"}一覧を見る`);
    const activate = () => {
      if (element.hidden || element.closest("[hidden]")) return;
      openCollectionCategoryFromDetail(category);
    };
    element.addEventListener("click", activate);
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate();
    });
  }
  function detailCategoryForVehicle(index) {
    const progress = vehicleProgress(index);
    if (progress.masterMedal) return "medal";
    if (progress.stage >= 5) return "equipment";
    if (progress.stage >= 4) return "super-robot";
    if (progress.stage >= 3) return "robot";
    return "vehicle";
  }
  function exitCollection() {
    if (state.collectionMode === "phonics-reward-select") return;
    $("collection-exit-confirm").hidden = false; $("collection-exit-no").focus();
  }
  function closeCollectionExit() { $("collection-exit-confirm").hidden = true; $("collection-exit").focus(); }
  function renderCollectionGrid({ showSessionMarkers = true } = {}) {
    $("collection-grid").classList.add("is-art-loading");
    $("medal-count").textContent = `${state.collection.filter((stage) => stage === 5).length} / 20`;
    $("collection-grid").innerHTML = collectionDisplayOrder.map((vehicleIndex) => {
      const vehicle = vehicles[vehicleIndex];
      const progress = vehicleProgress(vehicle.index);
      const discovered = progress.discovered, complete = progress.masterMedal;
      const formStage = complete ? 5 : Math.max(2, Math.min(5, progress.stage));
      const status = !discovered ? "" : !progress.friendly
        ? `<span class="collection-card-status collection-card-hearts" aria-label="なかよし ${progress.friendship} / 5">${[5,4,3,2,1].map((level) => `<i class="${level <= progress.friendship ? "is-earned" : ""}">♥</i>`).join("")}</span>`
        : `<span class="collection-card-status collection-card-energy" aria-label="エネルギー ${progress.energy} / ${progress.masterMedal ? 500 : requiredEnergyForStage(progress.stage)}"><i style="height:${Math.min(100, progress.energy / (progress.masterMedal ? 500 : requiredEnergyForStage(progress.stage)) * 100)}%"></i></span>`;
      const artPath = discovered ? answerArtworkPath(vehicle.index, formStage) : vehicleArtworkPath(0);
      const formClass = formStage === 2 ? "is-vehicle-form" : formStage === 3 ? "is-evolved-form is-robot-form" : formStage === 5 ? "is-evolved-form is-equipped-super-robot" : "is-evolved-form";
      const grayscaleClass = formStage === 2 && !progress.friendly ? " is-pre-friendship" : "";
      const artwork = discovered ? `<img class="card-vehicle ${formClass}${grayscaleClass}" src="${artPath}" alt="" decoding="async">`
        : `<img class="card-vehicle card-silhouette-image" src="${vehicleArtworkPath(0)}" alt="" decoding="async">`;
      // Stage 5 summary: standalone equipment in front, with a transparent bust
      // of its unequipped super robot behind. Master-medal cards keep their
      // equipped robot and medal composition instead.
      const equipmentComposition = discovered && formStage === 5 && !complete
        ? `<img class="card-super-robot-ghost" src="${superRobotArtworkPath(vehicle.index)}" alt="" decoding="async"><img class="card-equipment-feature" src="${equipmentArtworkPath(vehicle.index)}" alt="" decoding="async">`
        : "";
      const medal = complete ? `<img class="card-master-medal-bg" src="${masterMedalArtworkPath(vehicle.index)}" alt="" decoding="async">` : "";
      const isNew = showSessionMarkers && state.collectionNewVehicleIndexes.has(vehicle.index);
      const before = state.resultStartProgress[vehicle.index] || emptyVehicleProgress();
      const friendshipGrew = progress.friendship > before.friendship;
      const energyGrew = progress.stage === before.stage && progress.energy > before.energy;
      const isUp = showSessionMarkers && !isNew && (friendshipGrew || energyGrew);
      const capsuleDisabled = capsuleSelecting && !capsuleEligibleIndexes().includes(vehicle.index);
      const selectionDisabled = (state.collectionMode === "phonics-reward-select" && (!questBonusSelecting || !discovered)) || capsuleDisabled;
      return `<button class="collection-card ${discovered ? "" : "locked"} ${complete ? "complete" : ""} ${isNew ? "is-new" : ""} ${isUp ? "is-up" : ""} ${capsuleDisabled ? "is-capsule-disabled" : ""}" data-vehicle="${vehicle.index}" data-stage="${formStage}" aria-label="${discovered ? `${vehicle.nameEn}、進捗${formStage}` : "未発見"}" ${selectionDisabled ? 'disabled aria-disabled="true"' : ""} style="--card-color:${vehicle.color}">
        <span class="card-garage"></span><span class="vehicle-area">${medal}${equipmentComposition || artwork}</span>
        <span class="name-band"><span class="name-band-text">${discovered ? vehicle.nameEn : "???"}</span></span>
        ${discovered ? `<span class="card-rarity rarity-${vehicle.rarityStars.length}" aria-label="レアリティ ${vehicle.rarityStars.length}つ星">${[...vehicle.rarityStars].map(() => `<i aria-hidden="true">★</i>`).join("")}</span>` : ""}${status}${isNew ? '<span class="collection-card-new-ribbon"><i>NEW</i></span>' : isUp ? '<span class="collection-card-up-ribbon"><i>UP</i></span>' : ""}</button>`;
    }).join("");
    revealCollectionArtworkTogether($("collection-grid"), ".card-vehicle, .card-master-medal-bg, .card-silhouette-image, .card-super-robot-ghost, .card-equipment-feature");
    document.querySelectorAll(".collection-card").forEach((card) => card.addEventListener("click", () => {
      const vehicleIndex = Number(card.dataset.vehicle);
      if (capsuleSelecting) { if (capsuleEligibleIndexes().includes(vehicleIndex)) useCapsuleOnVehicle(vehicleIndex); }
      else if (state.collectionMode === "phonics-reward-select") {
        if (questBonusSelecting) openPhonicsGrowConfirm(vehicleIndex);
        return;
      }
      else openVehicleDetail(vehicleIndex);
    }));
  }
  let vehicleDetailRenderRequestId = 0;
  function openVehicleDetail(index) {
    state.detailVehicleIndex = index;
    setCollectionCategory(null);
    renderVehicleDetail();
    showScreen("collection-detail-screen");
  }
  async function renderVehicleDetail() {
    const requestId = ++vehicleDetailRenderRequestId;
    const vehicleIndex = state.detailVehicleIndex;
    const vehicle = vehicles[vehicleIndex];
    const progress = vehicleProgress(vehicleIndex);
    const discovered = progress.discovered;
    const threeUp = discovered && progress.stage >= 4;
    const picture = $("detail-picture");
    const layout = $("detail-evolution-layout");
    const logo = $("detail-vehicle-logo");
    const medalDisplay = $("detail-master-medal-display");
    const medalHologram = medalDisplay.querySelector(".detail-master-medal-hologram");
    const medalArt = $("detail-master-medal-art");
    const vehicleArt = $("detail-vehicle-art");
    const robotArt = $("detail-robot-art");
    const superArt = $("detail-super-art");
    const background = $("detail-background");

    // The background may appear immediately. Keep every foreground element
    // hidden until all required artwork has loaded and decoded, then reveal
    // the whole foreground composition in one frame.
    background.src = playBackgroundPath(vehicleIndex);
    background.alt = `${vehicle.nameJa}の背景`;
    picture.className = `detail-picture ${threeUp ? "is-three-up" : "is-two-up"}${discovered ? "" : " is-undiscovered"}`;
    logo.style.visibility = "hidden";
    layout.style.visibility = "hidden";
    medalDisplay.style.visibility = "hidden";
    logo.hidden = !discovered;
    layout.hidden = !discovered;
    medalDisplay.hidden = !discovered || !progress.masterMedal;
    if (!discovered) return;

    const equippedSuperRobotVisible = threeUp && progress.stage >= 5;
    layout.className = `detail-evolution-layout ${threeUp ? "is-three-up" : "is-two-up"}${equippedSuperRobotVisible ? " has-equipped-super-robot" : ""}`;
    vehicleArt.alt = vehicle.nameJa;
    vehicleArt.className = `detail-character${progress.friendly ? "" : " is-grayscale"}`;
    robotArt.alt = `${vehicle.nameJa}のロボット`;
    robotArt.className = `detail-character${progress.stage >= 3 ? "" : " is-silhouette"}`;
    superArt.className = `detail-character${equippedSuperRobotVisible ? " is-equipped-super-robot" : ""}`;
    layout.querySelector(".detail-slot-super").hidden = !threeUp;
    layout.querySelector(".detail-chevron-two").hidden = !threeUp;

    const logoPath = vehicleLogoTitlePath(vehicleIndex);
    const vehiclePath = vehicleArtworkPath(vehicleIndex);
    const robotPath = robotArtworkPath(vehicleIndex);
    const superPath = threeUp
      ? (progress.stage >= 5 ? equippedSuperRobotArtworkPath(vehicleIndex) : superRobotArtworkPath(vehicleIndex))
      : null;
    const medalPath = progress.masterMedal ? masterMedalArtworkPath(vehicleIndex) : null;
    const medalHologramPath = progress.masterMedal
      ? "./assets/ui/collection_detail/master_medal_hologram_pedestal.webp"
      : null;
    logo.alt = vehicle.nameEn;
    if (progress.masterMedal) medalArt.alt = `${vehicle.nameJa}のマスターメダル`;
    else {
      medalArt.removeAttribute("src");
      medalArt.alt = "";
    }
    if (threeUp) superArt.alt = progress.stage >= 5
      ? `${vehicle.nameJa}のスペシャル装備付きスーパーロボット`
      : `${vehicle.nameJa}のスーパーロボット`;
    if (threeUp) {
      const superRobotSeries = progress.stage >= 5 ? "superRobotEquipped" : "superRobot";
      const sharedDisplay = superRobotDisplaySettings.collectionDetail[superRobotSeries];
      superArt.dataset.displaySeries = superRobotSeries;
      superArt.style.setProperty("--detail-super-scale", String(sharedDisplay.scale));
      superArt.style.setProperty("--detail-super-x", sharedDisplay.x);
      superArt.style.setProperty("--detail-super-y", sharedDisplay.y);
    } else {
      delete superArt.dataset.displaySeries;
      superArt.style.removeProperty("--detail-super-scale");
      superArt.style.removeProperty("--detail-super-x");
      superArt.style.removeProperty("--detail-super-y");
    }

    const foregroundPaths = [logoPath, vehiclePath, robotPath, superPath, medalPath, medalHologramPath].filter(Boolean);
    try {
      await Promise.all(foregroundPaths.map((path) => preloadDecodedImage(path)));
      if (requestId !== vehicleDetailRenderRequestId || vehicleIndex !== state.detailVehicleIndex) return;
      await Promise.all([
        decodeImageElement(logo, logoPath),
        decodeImageElement(vehicleArt, vehiclePath),
        decodeImageElement(robotArt, robotPath),
        threeUp ? decodeImageElement(superArt, superPath) : Promise.resolve(),
        progress.masterMedal ? decodeImageElement(medalArt, medalPath) : Promise.resolve(),
        progress.masterMedal ? decodeImageElement(medalHologram, medalHologramPath) : Promise.resolve()
      ]);
      if (requestId !== vehicleDetailRenderRequestId || vehicleIndex !== state.detailVehicleIndex) return;
      window.requestAnimationFrame(() => {
        if (requestId !== vehicleDetailRenderRequestId || vehicleIndex !== state.detailVehicleIndex) return;
        logo.style.visibility = "";
        layout.style.visibility = "";
        if (progress.masterMedal) medalDisplay.style.visibility = "";
      });
    } catch (error) {
      if (requestId !== vehicleDetailRenderRequestId || vehicleIndex !== state.detailVehicleIndex) return;
      console.error("Collection detail foreground failed to load", error);
    }
  }
  function moveVehicleDetail(direction) {
    state.detailVehicleIndex = (state.detailVehicleIndex + direction + vehicles.length) % vehicles.length;
    renderVehicleDetail();
  }

  // Opt-in BGM loss diagnostics. Only snapshots are recorded; playback behavior
  // is never modified. Entries survive a PWA refresh for later inspection.
  const bgmDiagnosticPreferenceKey = "mq:bgm-loss-diagnostics-enabled-v1";
  const bgmDiagnosticStorageKey = "mq:bgm-loss-diagnostics-log-v1";
  let bgmDiagnosticsEnabled = false;
  let bgmDiagnostics = [];
  let bgmDiagnosticButton = null;
  let bgmDiagnosticLastSignature = "";
  let bgmDiagnosticPollCount = 0;
  function bgmDiagnosticSnapshot(event, detail = {}) {
    const ctx = state.audio;
    return {
      at: new Date().toISOString(), event, ...detail, hidden: document.hidden,
      screen: activeScreenId(), contextState: ctx?.state || "none",
      currentTime: ctx?.currentTime ?? null, bgmEnabled: state.bgmEnabled,
      bgmGroup: state.bgmGroup, desiredBgmGroup: state.desiredBgmGroup,
      activeBgmGroup: activeBgmGroup(), sourcePresent: Boolean(state.bgmSource),
      gain: state.bgmGain?.gain?.value ?? null, mutedForBackground: audioMutedForBackground,
      suspendTimerPending: audioVisibilitySuspendTimer !== null,
      transitionTimerPending: state.bgmFadeTimer !== null,
      requestId: state.bgmRequestId, transitionId: state.bgmTransitionId,
      pendingResume: Boolean(audioResumePromise)
    };
  }
  function recordBgmDiagnostic(event, detail = {}) {
    if (!bgmDiagnosticsEnabled) return;
    bgmDiagnostics.push(bgmDiagnosticSnapshot(event, detail));
    if (bgmDiagnostics.length > 120) bgmDiagnostics.splice(0, bgmDiagnostics.length - 120);
    try { localStorage.setItem(bgmDiagnosticStorageKey, JSON.stringify(bgmDiagnostics)); } catch (_) {}
  }
  function updateAdminBgmDiagnosticsToggle() {
    const toggle = $("admin-bgm-diagnostics-toggle");
    if (!toggle) return;
    toggle.setAttribute("aria-checked", String(bgmDiagnosticsEnabled));
    toggle.querySelector("span").textContent = bgmDiagnosticsEnabled ? "ON" : "OFF";
    if (bgmDiagnosticButton) bgmDiagnosticButton.hidden = !bgmDiagnosticsEnabled;
  }
  function toggleBgmDiagnostics() {
    bgmDiagnosticsEnabled = !bgmDiagnosticsEnabled;
    try { localStorage.setItem(bgmDiagnosticPreferenceKey, bgmDiagnosticsEnabled ? "1" : "0"); } catch (_) {}
    updateAdminBgmDiagnosticsToggle();
    recordBgmDiagnostic("diagnostics-enabled");
    setAdminActionStatus(bgmDiagnosticsEnabled ? "BGM消失診断をONにしました。" : "BGM消失診断をOFFにしました。");
  }
  function setupBgmDiagnostics() {
    try {
      bgmDiagnosticsEnabled = localStorage.getItem(bgmDiagnosticPreferenceKey) === "1";
      const saved = JSON.parse(localStorage.getItem(bgmDiagnosticStorageKey) || "[]");
      if (Array.isArray(saved)) bgmDiagnostics = saved.slice(-120);
    } catch (_) {}
    const button = document.createElement("button");
    bgmDiagnosticButton = button;
    button.type = "button";
    button.textContent = "BGM LOG";
    Object.assign(button.style, {
      position: "fixed", left: "8px", bottom: "8px", zIndex: "2147483647",
      fontSize: "12px", padding: "6px 8px", opacity: "0.85"
    });
    button.addEventListener("click", async () => {
      recordBgmDiagnostic("manual-log");
      const report = JSON.stringify(bgmDiagnostics, null, 2);
      try {
        await navigator.clipboard.writeText(report);
        button.textContent = "LOG COPIED";
        window.setTimeout(() => { button.textContent = "BGM LOG"; }, 1400);
      } catch (_) { window.prompt("BGM loss diagnostic log", report); }
    });
    document.body.appendChild(button);
    updateAdminBgmDiagnosticsToggle();
    recordBgmDiagnostic("startup");
    window.setInterval(() => {
      if (!bgmDiagnosticsEnabled) return;
      const ctx = state.audio;
      const shouldPlay = !document.hidden && state.bgmEnabled && Boolean(activeBgmGroup());
      const unexpected = shouldPlay && (ctx?.state === "suspended" || (
        !state.bgmSource && !state.bgmFadeTimer && Boolean(state.desiredBgmGroup)
      ) || (
        state.bgmSource && (state.bgmGain?.gain?.value ?? 1) < 0.0005 && !state.bgmFadeTimer
      ));
      const signature = unexpected ? [ctx?.state, state.bgmGroup, audioMutedForBackground].join(":") : "";
      if (unexpected && signature !== bgmDiagnosticLastSignature) recordBgmDiagnostic("possible-silence");
      bgmDiagnosticLastSignature = signature;
      // Periodic snapshots also capture silent output without a detectable state change.
      if (++bgmDiagnosticPollCount % 5 === 0) recordBgmDiagnostic("audio-heartbeat");
    }, 2000);
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
    try {
      const attempt = Promise.resolve(ctx.resume()).catch(() => null);
      audioResumePromise = attempt;
      return attempt.finally(() => {
        if (audioResumePromise === attempt) audioResumePromise = null;
      });
    } catch (_) {
      audioResumePromise = null;
    }
  }
  // One owner for the pending background suspension timer. Keeping the
  // cancellation and clearing logic together avoids stale timer handles.
  function clearAudioVisibilitySuspendTimer() {
    if (audioVisibilitySuspendTimer === null) return;
    window.clearTimeout(audioVisibilitySuspendTimer);
    audioVisibilitySuspendTimer = null;
  }
  function scheduleAudioVisibilitySuspend(requireHidden, suspendDelayMs) {
    audioVisibilitySuspendTimer = window.setTimeout(() => {
      audioVisibilitySuspendTimer = null;
      if ((requireHidden && !document.hidden) || !state.audio || state.audio.state === "closed" || state.audio.state === "suspended") return;
      try { state.audio.suspend(); } catch (_) {}
    }, suspendDelayMs);
  }
  function suspendAudioForBackground(reason, { requireHidden = true, fadeMs = 80, suspendDelayMs = 100 } = {}) {
    const ctx = state.audio;
    recordBgmDiagnostic("background-suspend", { reason });
    if (!ctx || ctx.state === "closed") return;
    clearAudioVisibilitySuspendTimer();

    // Background handoff owns the audio lifecycle. Cancel every pending
    // screen-to-screen BGM transition first so no delayed BufferSource.stop()
    // or late async start can fire while iOS is suspending Web Audio.
    cancelBgmTransitionForLifecycle();

    if (state.bgmGain && ctx.state === "running") {
      const gain = state.bgmGain.gain;
      cancelBgmGainAutomation(ctx, state.bgmGain);
      gain.setValueAtTime(Math.max(0.0001, gain.value), ctx.currentTime);
      gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeMs / 1000);
      audioMutedForBackground = true;
    }
    scheduleAudioVisibilitySuspend(requireHidden, suspendDelayMs);
  }
  // Keep foreground restoration in one place. The AudioContext may still be
  // suspended when focus/pageshow fires; its statechange listener also retries
  // gain restoration as soon as Web Audio actually becomes running.
  function restoreForegroundBackgroundMusic() {
    restoreAudioGainAfterVisibility();
    if (!document.hidden) syncBackgroundMusicForActiveScreen();
  }
  function resumeAudioAfterVisible(reason) {
    recordBgmDiagnostic("foreground-resume", { reason });
    clearAudioVisibilitySuspendTimer();
    const resumed = resumeAudioContext(reason);
    Promise.resolve(resumed).finally(restoreForegroundBackgroundMusic);
  }
  function audioContext() {
    if (!state.audio) {
      state.audio = new (window.AudioContext || window.webkitAudioContext)();
      state.audio.addEventListener?.("statechange", () => {
        recordBgmDiagnostic("audio-context-statechange");
        if (state.audio?.state === "running" && !document.hidden) restoreForegroundBackgroundMusic();
      });
    }
    return state.audio;
  }
  function loadBgmEnabledPreference() {
    try { return localStorage.getItem(bgmConfig.storageKey) !== "false"; } catch (_) { return true; }
  }
  function activeScreenId() {
    return screens.find((screenId) => $(screenId).classList.contains("active")) || null;
  }
  function activeBgmGroup() {
    return bgmConfig.screenGroups[activeScreenId()] || null;
  }
  function bgmTrack(group = state.bgmGroup || state.desiredBgmGroup) {
    return group ? bgmConfig.tracks[group] || null : null;
  }
  function backgroundMusicVolume(group = state.bgmGroup || state.desiredBgmGroup) {
    const track = bgmTrack(group);
    if (!track) return 0;
    return track.normalVolume * (state.bgmDucked ? bgmConfig.rewardDuckMultiplier : 1);
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
  function ensureBackgroundMusic(group = state.desiredBgmGroup) {
    const track = bgmTrack(group);
    if (!track) return Promise.resolve(null);
    if (state.bgmBuffers[group]) return Promise.resolve(state.bgmBuffers[group]);
    if (state.bgmBufferPromises[group]) return state.bgmBufferPromises[group];
    const ctx = audioContext();
    state.bgmBufferPromises[group] = fetch(track.filePath)
      .then((response) => { if (!response.ok) throw new Error(track.filePath); return response.arrayBuffer(); })
      .then((arrayBuffer) => decodeAudio(ctx, arrayBuffer))
      .then((buffer) => { state.bgmBuffers[group] = buffer; return buffer; })
      .catch((error) => { console.error(`BGM failed to load: ${group}`, error); return null; });
    return state.bgmBufferPromises[group];
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
  function cancelBgmGainAutomation(ctx, gain = state.bgmGain) {
    if (!gain) return;
    const parameter = gain.gain;
    if (typeof parameter.cancelAndHoldAtTime === "function") parameter.cancelAndHoldAtTime(ctx.currentTime);
    else {
      const currentValue = parameter.value;
      parameter.cancelScheduledValues(ctx.currentTime);
      parameter.setValueAtTime(currentValue, ctx.currentTime);
    }
  }
  function clearBgmFadeTimer() {
    if (state.bgmFadeTimer === null) return;
    window.clearTimeout(state.bgmFadeTimer);
    state.bgmFadeTimer = null;
  }
  // Invalidate pending BGM fade callbacks before changing audio lifecycle.
  // Screen changes and background handoff share this cancellation path.
  function invalidateBgmFadeTransition() {
    state.bgmTransitionId += 1;
    clearBgmFadeTimer();
    return state.bgmTransitionId;
  }
  function cancelBgmTransitionForLifecycle() {
    state.bgmRequestId += 1;
    invalidateBgmFadeTransition();
  }
  function disconnectBackgroundMusicSource() {
    const source = state.bgmSource;
    state.bgmSource = null;
    state.bgmGroup = null;
    document.documentElement.dataset.bgmGroup = "";
    if (!source) return;
    try { source.stop(); } catch (_) {}
    try { source.disconnect(); } catch (_) {}
  }
  function startDecodedBackgroundMusic(buffer, group) {
    if (!buffer || !canPlayBackgroundMusic(group) || state.desiredBgmGroup !== group) return;
    if (state.bgmSource && state.bgmGroup === group) return;
    if (state.bgmSource) { transitionBackgroundMusic(group); return; }
    const ctx = audioContext();
    const gain = ensureBgmGain();
    cancelBgmGainAutomation(ctx, gain);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(backgroundMusicVolume(group), ctx.currentTime + bgmConfig.transitionDurationSeconds);
    const source = ctx.createBufferSource();
    const bounds = detectBgmLoopBounds(buffer);
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = bounds.start;
    source.loopEnd = bounds.end;
    source.connect(gain);
    source.onended = () => {
      if (state.bgmSource === source) {
        state.bgmSource = null;
        state.bgmGroup = null;
      }
    };
    state.bgmSource = source;
    state.bgmGroup = group;
    document.documentElement.dataset.bgmGroup = group;
    source.start(0, bounds.start);
  }
  function updateBgmToggleButton() {
    document.querySelectorAll("[data-bgm-toggle]").forEach((button) => {
      button.textContent = state.bgmEnabled ? "🔊" : "🔇";
      button.setAttribute("aria-pressed", String(state.bgmEnabled));
      button.setAttribute("aria-label", state.bgmEnabled ? "BGMをオフにする" : "BGMをオンにする");
    });
  }
  function stopBackgroundMusic({ clearDesired = true } = {}) {
    cancelBgmTransitionForLifecycle();
    if (state.bgmGain) cancelBgmGainAutomation(audioContext());
    disconnectBackgroundMusicSource();
    state.bgmDucked = false;
    if (clearDesired) state.desiredBgmGroup = null;
    if (state.bgmGain) state.bgmGain.gain.value = backgroundMusicVolume();
  }
  function isBgmTransitionObsolete(transitionId) {
    return transitionId !== state.bgmTransitionId || document.hidden || audioMutedForBackground;
  }
  function isBgmStartRequestObsolete(requestId, group) {
    return requestId !== state.bgmRequestId || state.desiredBgmGroup !== group;
  }
  function transitionBackgroundMusic(nextGroup) {
    if (!state.bgmSource || state.bgmGroup === nextGroup) {
      if (nextGroup) startBackgroundMusic(nextGroup);
      return;
    }
    state.bgmRequestId += 1;
    const transitionId = invalidateBgmFadeTransition();
    const ctx = audioContext();
    const gain = ensureBgmGain();
    if (nextGroup) ensureBackgroundMusic(nextGroup);
    cancelBgmGainAutomation(ctx, gain);
    gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + bgmConfig.transitionDurationSeconds);
    state.bgmFadeTimer = window.setTimeout(() => {
      if (isBgmTransitionObsolete(transitionId)) return;
      state.bgmFadeTimer = null;
      disconnectBackgroundMusicSource();
      if (nextGroup && state.desiredBgmGroup === nextGroup && state.bgmEnabled) startBackgroundMusic(nextGroup);
    }, bgmConfig.transitionDurationSeconds * 1000);
  }
  function setBackgroundMusicDucked(ducked) {
    state.bgmDucked = Boolean(ducked);
    if (state.bgmGain) {
      const ctx = audioContext();
      state.bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      state.bgmGain.gain.setTargetAtTime(backgroundMusicVolume(), ctx.currentTime, 0.025);
    }
  }
  function canPlayBackgroundMusic(group = state.desiredBgmGroup) {
    if (!group || document.hidden || !state.bgmEnabled || activeBgmGroup() !== group) return false;
    if (group !== "game") return true;
    return (state.phase === "initial" || state.phase === "retry") && Boolean(state.current);
  }
  function startBackgroundMusic(group = state.desiredBgmGroup) {
    if (!canPlayBackgroundMusic(group)) return;
    if (state.bgmSource && state.bgmGroup === group) return;
    const requestId = ++state.bgmRequestId;
    setBackgroundMusicDucked(false);
    ensureBackgroundMusic(group).then((buffer) => {
      if (isBgmStartRequestObsolete(requestId, group)) return;
      startDecodedBackgroundMusic(buffer, group);
    });
  }
  function setDesiredBgmGroup(group) {
    const normalized = bgmTrack(group) ? group : null;
    state.desiredBgmGroup = normalized;
    document.documentElement.dataset.bgmDesiredGroup = normalized || "";
    if (state.bgmSource && state.bgmGroup === normalized && state.bgmFadeTimer !== null) {
      invalidateBgmFadeTransition();
      const ctx = audioContext();
      const gain = ensureBgmGain();
      cancelBgmGainAutomation(ctx, gain);
      gain.gain.linearRampToValueAtTime(backgroundMusicVolume(normalized), ctx.currentTime + bgmConfig.transitionDurationSeconds);
      return;
    }
    if (state.bgmSource && state.bgmGroup !== normalized) { transitionBackgroundMusic(normalized); return; }
    if (!normalized || !state.bgmEnabled) return;
    startBackgroundMusic(normalized);
  }
  function syncBackgroundMusicForActiveScreen() {
    setDesiredBgmGroup(activeBgmGroup());
  }
  function primeBackgroundMusicFromGesture(group = state.desiredBgmGroup || activeBgmGroup()) {
    if (!state.bgmEnabled || !group) return;
    if (state.desiredBgmGroup !== group) setDesiredBgmGroup(group);
    audioContext();
    resumeAudioContext();
    startBackgroundMusic(group);
  }
  function setBgmEnabled(enabled) {
    state.bgmEnabled = Boolean(enabled);
    try { localStorage.setItem(bgmConfig.storageKey, String(state.bgmEnabled)); } catch (_) {}
    updateBgmToggleButton();
    if (!state.bgmEnabled) stopBackgroundMusic({ clearDesired: false });
    else primeBackgroundMusicFromGesture(state.desiredBgmGroup || activeBgmGroup());
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
  function preloadFanfareSounds() {
    if (state.fanfareSoundsLoading) return state.fanfareSoundsLoading;
    const ctx = audioContext();
    state.fanfareSoundsLoading = Promise.all(fanfareSoundPaths.map(async (path) => {
      const response = await fetch(path); if (!response.ok) throw new Error(path); return decodeAudio(ctx, await response.arrayBuffer());
    })).then((buffers) => { state.fanfareSoundBuffers = buffers; return buffers; }).catch(() => []);
    return state.fanfareSoundsLoading;
  }
  function preloadStartSound() { state.startSound = new Audio(startSoundPath); state.startSound.preload = "auto"; state.startSound.load(); }
  function playStartSound() { if (!state.startSound) preloadStartSound(); state.startSound.currentTime = 0; state.startSound.play().catch(() => {}); }
  function playFanfareSound() {
    const buffers = state.fanfareSoundBuffers;
    if (buffers.length !== fanfareSoundPaths.length) { preloadFanfareSounds(); tone(660, 0, .15, "sine", .18); tone(880, .16, .3, "sine", .18); return; }
    let index = Math.floor(Math.random() * buffers.length);
    if (buffers.length > 1 && index === state.lastFanfareSoundIndex) index = (index + 1) % buffers.length;
    state.lastFanfareSoundIndex = index;
    const ctx = audioContext(), source = ctx.createBufferSource(), gain = ctx.createGain(), compressor = ctx.createDynamicsCompressor();
    source.buffer = buffers[index]; gain.gain.value = 0.75; compressor.threshold.value = -10; compressor.ratio.value = 4;
    source.connect(gain).connect(compressor).connect(ctx.destination); source.start();
  }
  function playSimpleCorrectSound() { tone(880, 0, .12, "sine", .234); tone(1320, .14, .18, "sine", .234); }
  function playWrongSound() { tone(170, 0, .42, "sawtooth", .143); }
  // 数字カード専用の、各カードを押した瞬間の軽い入力フィードバック。
  // 問題クリアや他モードの正誤SEとは分離している。
  function playNumberCardCorrectSound() { tone(620, 0, .12, "sine", .238); tone(880, .065, .12, "sine", .179); }
  function playFinishSound() { tone(523, 0, .14); tone(659, .14, .14); tone(784, .28, .3); }
  function playCollectionEndSound() { tone(660, 0, .22, "sine", .12); tone(523, .2, .24, "sine", .12); tone(392, .4, .35, "sine", .1); }
  let adminResetInProgress = false;
  let gameInitialized = false;
  let parentSettingsProfileId = null;
  let parentSettingsDrafts = new Map();
  function setProfileError(element, message) {
    element.textContent = message || "";
    element.hidden = !message;
  }
  const levelSystem = window.MiqueLevelSystem;
  let pendingLevelCelebration = null;
  let levelFanfareDeferred = false;
  function refreshTopLevel() {
    const ledger = profileStore.getPointLedger();
    const panel = $("top-level-panel");
    panel.hidden = !ledger;
    if (!ledger) return;
    const currentLevel = levelSystem.levelAt(ledger.total);
    $("top-level-value").textContent = `レベル${currentLevel}`;
    $("top-level-title").innerHTML = levelSystem.titleHtml(currentLevel);
    $("top-points-value").textContent = levelSystem.formatPoints(ledger.total);
    $("top-next-level").textContent = currentLevel >= 50
      ? "さいこうレベル！"
      : `つぎのレベルまで あと${(levelSystem.requiredPoints(currentLevel + 1) - ledger.total).toLocaleString("ja-JP")}ポイント`;
  }
  function prepareLevelCelebration() {
    refreshTopLevel();
    if (qaProgressModeEnabled()) return;
    const ledger = profileStore.getPointLedger();
    if (!ledger) return;
    const current = levelSystem.levelAt(ledger.total);
    const previous = profileStore.getLevelAcknowledged();
    const capsulesAdded = profileStore.awardEnergyCapsulesThroughLevel(current);
    // prepareLevelCelebration can run again before a pending popup is opened.
    // Preserve the award notice without granting the item a second time.
    const previousAward = pendingLevelCelebration?.previous === previous && pendingLevelCelebration?.current === current
      ? pendingLevelCelebration.awardedCapsules : 0;
    const awardNoticeCount = capsulesAdded || previousAward;
    const awardLabel = $("level-up-capsule-award");
    awardLabel.hidden = !awardNoticeCount;
    awardLabel.textContent = awardNoticeCount ? "エネルギーカプセル +" + awardNoticeCount + " ゲット！" : "";
    if (previous === null) {
      profileStore.setLevelAcknowledged(current); // First install: existing points are baseline, not a new level-up.
      return;
    }
    if (current <= previous) return;
    pendingLevelCelebration = { previous, current, points: ledger.total, awardedCapsules: awardNoticeCount };
    $("level-up-from").textContent = `レベル${previous}`;
    $("level-up-to").textContent = `レベル${current}`;
    $("level-up-old-title").innerHTML = levelSystem.titleHtml(previous);
    $("level-up-new-title").innerHTML = levelSystem.titleHtml(current);
    $("level-up-points-value").textContent = levelSystem.formatPoints(ledger.total);
    preloadFanfareSounds();
  }
  function openPendingLevelCelebration() {
    if (!pendingLevelCelebration || qaProgressModeEnabled() || !$("level-up-overlay").hidden) return;
    $("level-up-overlay").hidden = false;
    $("level-up-close").focus();
    // Safari may require a gesture before audio; retry on the dismissal gesture.
    levelFanfareDeferred = true;
    preloadFanfareSounds().then(() => {
      if (!pendingLevelCelebration || $("level-up-overlay").hidden) return;
      try {
        const context = audioContext();
        if (context.state === "running") {
          playFanfareSound();
          levelFanfareDeferred = false;
        } else {
          context.resume().then(() => {
            if (context.state === "running" && pendingLevelCelebration && !$("level-up-overlay").hidden && levelFanfareDeferred) {
              playFanfareSound();
              levelFanfareDeferred = false;
            }
          }).catch(() => {});
        }
      } catch (_) {}
    });
  }
  function closeLevelCelebration() {
    if (!pendingLevelCelebration) return;
    if (levelFanfareDeferred) { try { playFanfareSound(); } catch (_) {} }
    try {
      profileStore.setLevelAcknowledged(pendingLevelCelebration.current);
      pendingLevelCelebration = null;
      levelFanfareDeferred = false;
      $("level-up-overlay").hidden = true;
    } catch (error) { console.error("Level notice save failed",error); }
  }
  window.addEventListener("mique-startup-finished", openPendingLevelCelebration);
  function updateActiveProfileUi() {
    const profile = profileStore.getActiveProfile();
    const button = $("profile-switch-button");
    button.hidden = !profile;
    $("active-profile-name").textContent = profile?.displayName || "";
  }
  function renderProfileList() {
    const list = $("profile-list");
    const activeId = profileStore.getActiveProfileId();
    list.replaceChildren();
    profileStore.listProfiles().forEach((profile) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = profile.displayName;
      button.dataset.profileId = profile.profileId;
      button.setAttribute("aria-current", profile.profileId === activeId ? "true" : "false");
      button.addEventListener("click", () => {
        if (profile.profileId === activeId) { $("profile-manager-overlay").hidden = true; return; }
        profileStore.setActiveProfile(profile.profileId);
        window.location.reload();
      });
      list.append(button);
    });
  }
  function openProfileManager() {
    renderProfileList();
    setProfileError($("profile-manager-error"), "");
    $("profile-manager-overlay").hidden = false;
    document.querySelector('#profile-list [aria-current="true"]')?.focus();
  }
  function openAdminPin() {
    $("admin-pin-input").value = "";
    setProfileError($("admin-pin-error"), "");
    $("admin-pin-overlay").hidden = false;
    document.querySelector("[data-admin-pin-digit]")?.focus();
  }

  function parentModeSetting(settings, modeId) {
    const legacyPhonicsSetting = modeId.startsWith("phonics-part-")
      && settings.dailyTargetCounts?.[modeId] === undefined
      && settings.enabledModes?.[modeId] === undefined;
    const settingsKey = legacyPhonicsSetting ? "phonics" : modeId;
    const storedEnergy = settings.energyMultipliers?.[settingsKey];
    const energy = parentEnergyLevels.some((level) => level.id === storedEnergy) ? storedEnergy : "medium";
    const rawTarget = Number(settings.dailyTargetCounts?.[settingsKey]);
    const hasStoredTarget = Number.isInteger(rawTarget);
    // Newly introduced modes must not silently add a daily requirement to existing children.
    const newModeUnconfigured = modeId === "multiplication2x2-zero"
      && settings.enabledModes?.[settingsKey] === undefined;
    const target = hasStoredTarget
      ? Math.max(0, Math.min(9, rawTarget))
      : settings.enabledModes?.[settingsKey] === false || newModeUnconfigured ? 0 : 1;
    return { enabled: target > 0, energy, target };
  }

  function cloneParentSettings(settings) {
    return JSON.parse(JSON.stringify(settings || { enabledModes:{}, energyMultipliers:{}, dailyTargetCounts:{} }));
  }

  function initializeParentSettingsDrafts() {
    parentSettingsDrafts = new Map();
    profileStore.listProfiles().forEach((profile) => {
      parentSettingsDrafts.set(profile.profileId, cloneParentSettings(profileStore.getProfileLearningSettings(profile.profileId)));
    });
  }

  function parentDraftForProfile(profileId) {
    if (!profileId) return null;
    if (!parentSettingsDrafts.has(profileId)) {
      parentSettingsDrafts.set(profileId, cloneParentSettings(profileStore.getProfileLearningSettings(profileId)));
    }
    return parentSettingsDrafts.get(profileId);
  }

  function renderParentProfileTabs() {
    const profiles = profileStore.listProfiles();
    const activeId = profileStore.getActiveProfileId();
    if (!parentSettingsProfileId || !profiles.some((profile) => profile.profileId === parentSettingsProfileId)) {
      parentSettingsProfileId = profiles.some((profile) => profile.profileId === activeId) ? activeId : profiles[0]?.profileId || null;
    }
    const tabs = $("parent-profile-tabs");
    tabs.replaceChildren();
    profiles.forEach((profile) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = profile.displayName;
      button.dataset.profileId = profile.profileId;
      const selected = profile.profileId === parentSettingsProfileId;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.addEventListener("click", () => {
        parentSettingsProfileId = profile.profileId;
        renderParentProfileTabs();
        renderParentModeSettings();
        renderParentFreePlaySettings();
      });
      tabs.append(button);
    });
  }

  function renderParentModeSettings() {
    const container = $("parent-mode-settings");
    container.replaceChildren();
    if (!parentSettingsProfileId) return;
    const settings = parentDraftForProfile(parentSettingsProfileId);
    parentModeDefinitions.forEach((mode) => {
      const current = parentModeSetting(settings, mode.id);
      const row = document.createElement("div");
      row.className = "parent-mode-row";
      row.dataset.mode = mode.id;
      row.classList.toggle("is-off", !current.enabled);

      const name = document.createElement("div");
      name.className = "parent-mode-name";
      const strong = document.createElement("strong");
      strong.textContent = mode.label;
      name.append(strong);
      if (mode.detail) {
        const small = document.createElement("small");
        small.textContent = mode.detail;
        name.append(small);
      }

      const target = document.createElement("div");
      target.className = "parent-target-control";
      const minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "−";
      minus.setAttribute("aria-label", mode.label + "の目標回数を減らす");
      minus.disabled = current.target <= 0;
      const value = document.createElement("strong");
      value.textContent = current.target === 0 ? "OFF" : current.target + "回";
      const plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "＋";
      plus.setAttribute("aria-label", mode.label + "の目標回数を増やす");
      plus.disabled = current.target >= 9;
      minus.addEventListener("click", () => changeParentTarget(mode.id, -1));
      plus.addEventListener("click", () => changeParentTarget(mode.id, 1));
      target.append(minus, value, plus);

      const energy = document.createElement("div");
      energy.className = "parent-energy-options";
      energy.classList.toggle("disabled", Boolean(mode.energyDisabled));
      energy.setAttribute("aria-label", mode.label + "のエネルギー");
      if (mode.energyDisabled) {
        const unavailable = document.createElement("span");
        unavailable.className = "parent-energy-unavailable";
        unavailable.textContent = "なし";
        energy.append(unavailable);
      } else {
        parentEnergyLevels.forEach((level) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = level.label;
          button.dataset.energy = level.id;
          button.disabled = !current.enabled;
          const selected = current.energy === level.id;
          button.classList.toggle("selected", selected);
          button.setAttribute("aria-pressed", String(selected));
          button.addEventListener("click", () => setParentEnergy(mode.id, level.id));
          energy.append(button);
        });
      }

      row.append(name, target, energy);
      container.append(row);
    });
  }

  function renderParentFreePlaySettings() {
    const settings = parentDraftForProfile(parentSettingsProfileId);
    const enabled = settings?.freePlayEnabled === true;
    const energyMode = settings?.freePlayEnergyMode === "almost-zero" ? "almost-zero" : "normal";
    const toggle = $("parent-free-play-toggle");
    toggle.setAttribute("aria-checked", String(enabled));
    toggle.querySelector("span").textContent = enabled ? "ON" : "OFF";
    const options = $("parent-free-play-energy");
    options.hidden = !enabled;
    options.querySelectorAll("[data-free-play-energy]").forEach((button) => {
      const selected = button.dataset.freePlayEnergy === energyMode;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function updateParentDraftModeSetting(modeId, updater) {
    if (!parentSettingsProfileId) return;
    const settings = parentDraftForProfile(parentSettingsProfileId);
    const current = parentModeSetting(settings, modeId);
    const next = updater(current);
    settings.enabledModes[modeId] = next.target > 0;
    settings.energyMultipliers[modeId] = next.energy;
    settings.dailyTargetCounts[modeId] = next.target;
    renderParentModeSettings();
  }

  function setParentEnergy(modeId, energy) {
    if (!parentEnergyLevels.some((level) => level.id === energy)) return;
    updateParentDraftModeSetting(modeId, (current) => ({ ...current, energy }));
  }

  function changeParentTarget(modeId, delta) {
    updateParentDraftModeSetting(modeId, (current) => ({
      ...current,
      target: Math.max(0, Math.min(9, current.target + delta))
    }));
  }

  function setAllParentTargetsToZero() {
    if (!parentSettingsProfileId) return;
    const settings = parentDraftForProfile(parentSettingsProfileId);
    // Explicit zeros override default targets and legacy shared phonics settings.
    for (const mode of parentModeDefinitions) {
      settings.dailyTargetCounts[mode.id] = 0;
      settings.enabledModes[mode.id] = false;
    }
    renderParentModeSettings();
  }

  function saveParentSettings() {
    parentSettingsDrafts.forEach((settings, profileId) => {
      profileStore.setProfileLearningSettings(profileId, settings);
    });
    closeParentSettings();
    // Recalculate completed / remaining counts against the newly saved goals.
    // In particular, raising a completed goal by one must show 「あと1回」.
    renderModeSelectMission();
  }

  function openParentPin() {
    $("parent-pin-input").value = "";
    setProfileError($("parent-pin-error"), "");
    $("parent-pin-overlay").hidden = false;
    document.querySelector("[data-parent-pin-digit]")?.focus();
  }

  function submitParentPin() {
    const input = $("parent-pin-input");
    const pin = input.value;
    if (!/^\d{4}$/.test(pin)) return;
    if (pin !== parentPin) {
      setProfileError($("parent-pin-error"), "PINがちがいます。");
      input.value = "";
      document.querySelector("[data-parent-pin-digit]")?.focus();
      return;
    }
    setProfileError($("parent-pin-error"), "");
    $("parent-pin-overlay").hidden = true;
    openParentSettings();
  }

  function appendParentPinDigit(digit) {
    const input = $("parent-pin-input");
    if (input.value.length >= 4) return;
    input.value += digit;
    setProfileError($("parent-pin-error"), "");
    if (input.value.length === 4) submitParentPin();
  }

  function closeParentPin() {
    $("parent-pin-overlay").hidden = true;
    $("parent-settings-button").focus();
  }

  function openParentSettings() {
    parentSettingsProfileId = profileStore.getActiveProfileId() || profileStore.listProfiles()[0]?.profileId || null;
    initializeParentSettingsDrafts();
    renderParentProfileTabs();
    renderParentModeSettings();
    renderParentFreePlaySettings();
    $("parent-settings-overlay").hidden = false;
    $("parent-settings-close").focus();
  }

  function closeParentSettings() {
    $("parent-settings-overlay").hidden = true;
    parentSettingsDrafts = new Map();
    $("parent-settings-button").focus();
  }

  async function reloadApplication() {
    const button = $("top-reload-button");
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute("aria-label", "再読み込み中");
    try {
      const registration = await navigator.serviceWorker?.getRegistration?.();
      await registration?.update?.();
    } catch (error) {
      console.warn("PWA update check failed; reloading current app", error);
    }
    window.location.reload();
  }
  function submitAdminPin() {
    const input = $("admin-pin-input");
    const pin = input.value;
    if (!/^\d{4}$/.test(pin)) return;
    if (pin !== adminPin) {
      setProfileError($("admin-pin-error"), "PINがちがいます。");
      input.value = "";
      document.querySelector("[data-admin-pin-digit]")?.focus();
      return;
    }
    setProfileError($("admin-pin-error"), "");
    $("admin-pin-overlay").hidden = true;
    openAdminPanel();
  }
  function appendAdminPinDigit(digit) {
    const input = $("admin-pin-input");
    if (input.value.length >= 4) return;
    input.value += digit;
    setProfileError($("admin-pin-error"), "");
    if (input.value.length === 4) submitAdminPin();
  }
  function closeAdminPin() {
    $("admin-pin-overlay").hidden = true;
    $("admin-settings-button").focus();
  }
  function setAdminActionStatus(message) {
    const status = $("admin-action-status");
    status.textContent = message || "";
    status.hidden = !message;
  }
  function openAdminPanel() {
    updateAdminQaToggle();
    updateAdminViewportDiagnosticsToggle();
    setAdminActionStatus("");
    $("admin-panel-overlay").hidden = false;
    $("admin-qa-toggle").focus();
  }
  function openPointsDiagnostics() {
    const active = profileStore.getActiveProfile();
    const ledger = profileStore.getPointLedger();
    $("admin-points-profile").textContent = active ? `プレイヤー：${active.displayName}` : "プレイヤーが見つかりません";
    const isQaPreview = qaProgressModeEnabled();
    const snapshot = Array.isArray(active?.progress?.rewardProgressPhase1) ? active.progress.rewardProgressPhase1 : [];
    const referenceTotal = snapshot.reduce((sum, progress) => sum + profileStore.calculateVehiclePointValue(progress), 0);
    $("admin-points-total").textContent = isQaPreview
      ? `QAテスト参考合計：${referenceTotal.toLocaleString("ja-JP")} pt（仮データ・未加算）`
      : ledger ? `確定済み累計：${ledger.total.toLocaleString("ja-JP")} pt` : "ポイント台帳未作成";
    $("admin-points-qa-note").hidden = !isQaPreview;
    $("admin-points-migration").textContent = ledger
      ? `初回移行：${ledger.initialPoints.toLocaleString("ja-JP")} pt ／ 記録イベント数（保持分）：${ledger.recentEvents?.length || 0}`
      : "このプレイヤーにはまだ累計ポイント記録がありません";
    const rows = $("admin-points-rows");
    rows.replaceChildren();
    vehicles.forEach((vehicle, index) => {
      const state = snapshot[index] || emptyVehicleProgress();
      const tr = document.createElement("tr");
      const cells = [vehicle.nameJa,
        !state.discovered ? "未発見" : state.masterMedal ? `メダル・エネルギー${state.energy}/500`
          : !state.friendly ? `ハート${state.friendship}/5` : `段階${state.stage}・エネルギー${state.energy}/${requiredEnergyForStage(state.stage)}`,
        String(profileStore.calculateVehiclePointValue(state))];
      cells.forEach((value) => { const td = document.createElement("td"); td.textContent = value; tr.appendChild(td); });
      rows.appendChild(tr);
    });
    $("admin-panel-overlay").hidden = true;
    $("admin-points-overlay").hidden = false;
    $("admin-points-close").focus();
  }
  function closePointsDiagnostics() {
    $("admin-points-overlay").hidden = true;
    $("admin-panel-overlay").hidden = false;
    $("admin-points-open").focus();
  }
  function closeAdminPanel() {
    $("admin-panel-overlay").hidden = true;
    setAdminActionStatus("");
    $("admin-settings-button").focus();
  }
  function reenableTopCollectionForActiveProfile() {
    try {
      profileStore.setTopCollectionLastUsedJst(null);
      state.collectionUsed = false;
      updateTopCollectionButton();
      setAdminActionStatus("このプレイヤーは、今日もう一度コレクションを見られます。");
    } catch (error) {
      console.error("Collection daily reset failed", error);
      setAdminActionStatus("コレクションの利用状態をリセットできませんでした。");
    }
  }
  function reenableOpeningMovieForActiveProfile() {
    try {
      profileStore.setOpeningMovieLastPlayedJst(null);
      setAdminActionStatus("このプレイヤーの開始時ムービー再生済み状態をリセットしました。");
    } catch (error) {
      console.error("Opening movie daily reset failed", error);
      setAdminActionStatus("開始時ムービーの利用状態をリセットできませんでした。");
    }
  }
  function initializeGameForActiveProfile() {
    if (gameInitialized) return;
    gameInitialized = true;
    updateActiveProfileUi();
    const previewQaInitialVehicleIndex = seedPreviewQaProgressPreset();
    loadRewardProgress();
    if (!qaProgressModeEnabled()) profileStore.initializePointLedger(state.rewardProgress);
    prepareLevelCelebration();
    loadRecentVehicles();
    state.previewQaInitialVehicleIndex = previewQaInitialVehicleIndex;
    setNeutralBackground();
    prepareInitialVehicle();
    preloadImages();
    preloadStartSound();
    updateTopCollectionButton();
    schedulePlayStageSize("initial");
  }
  function beginProfileExperience() {
    if (profileStore.listProfiles().length) {
      profileStore.ensureActiveProfile();
      initializeGameForActiveProfile();
      return;
    }
    const hasLegacyData = profileStore.hasLegacyChildData();
    $("profile-setup-message").textContent = hasLegacyData
      ? "いままでのきろくを、このプレイヤーにひきつぎます"
      : "なまえをいれてね";
    $("profile-setup-overlay").hidden = false;
    $("profile-setup-name").focus();
  }
  function closeAdminResetConfirm() {
    if (adminResetInProgress) return;
    $("admin-reset-confirm-overlay").hidden = true;
    $("admin-reset-button").focus();
  }
  function resetActiveProfileFromAdmin() {
    if (adminResetInProgress) return;
    adminResetInProgress = true;
    $("admin-reset-confirm").disabled = true;
    $("admin-reset-cancel").disabled = true;
    try {
      profileStore.resetActiveProfileData();
      profileStore.setActiveQaState({});
    } catch (error) {
      console.error("Active profile data reset failed", error);
      adminResetInProgress = false;
      $("admin-reset-confirm").disabled = false;
      $("admin-reset-cancel").disabled = false;
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("qa");
    url.searchParams.delete("reset");
    window.location.assign(url.toString());
  }

  setupVisualDiagnostics();
  setupViewportDiagnostics();
  setupBgmDiagnostics();
  state.bgmEnabled = loadBgmEnabledPreference();
  updateBgmToggleButton();
  syncBackgroundMusicForActiveScreen();
  updateVersionLabelWithPreviewMetadata();
  beginProfileExperience();
  window.setInterval(updateTopCollectionButton, 60000);
  window.addEventListener("resize", () => schedulePlayStageSize("resize"));
  window.addEventListener("resize", scheduleCollectionStageSize);
  window.addEventListener("pageshow", (event) => {
    resumeAudioAfterVisible("pageshow");
    syncBackgroundMusicForActiveScreen();
    if (!recoverAbnormalPwaZoom("pageshow")) schedulePlayStageSize("pageshow");
  });
  window.addEventListener("pageshow", scheduleCollectionStageSize);
  window.addEventListener("pagehide", () => {
    // Do not stop/disconnect the BufferSource during iOS app handoff.
    // An abrupt source.stop() here can create a short click/beep before the OS
    // suspends Web Audio. Reuse the same short fade+suspend path as blur.
    suspendAudioForBackground("pagehide", { requireHidden: false, fadeMs: 24, suspendDelayMs: 40 });
    pausePhonicsYoutubeForLifecycle();
  });
  window.addEventListener("pointerdown", () => primeBackgroundMusicFromGesture(), { capture: true, passive: true });
  window.addEventListener("touchstart", () => primeBackgroundMusicFromGesture(), { capture: true, passive: true });
  window.addEventListener("keydown", () => primeBackgroundMusicFromGesture(), { capture: true });
  window.addEventListener("orientationchange", () => {
    schedulePlayStageSize("orientationchange");
  });
  window.visualViewport?.addEventListener("resize", () => {
    recordViewportDiagnostic("visualViewport.resize");
    if (!recoverAbnormalPwaZoom("visualViewport.resize")) schedulePlayStageSize("visualViewport.resize");
  });
  $("start-button").addEventListener("click", openModeSelect); $("mode-select-back").addEventListener("click", () => showFixedScreenWhenReady("start-screen")); $("mode-select-number-cards").addEventListener("click", startNumberCardApp); $("mode-select-counting-1").addEventListener("click", startCounting1App); $("mode-select-counting-2").addEventListener("click", startCounting2App); $("mode-select-multiplication").addEventListener("click", startMultiplicationApp); $("mode-select-multiplication-2x2").addEventListener("click", startTwoDigitMultiplicationApp); $("mode-select-multiplication-2x2-unguided").addEventListener("click", startTwoDigitMultiplicationUnguidedApp); $("mode-select-multiplication-2x2-zero").addEventListener("click", startTwoDigitMultiplicationZeroApp); $("mode-select-normal").addEventListener("click", startApp); $("mode-select-long-division").addEventListener("click", startLongDivisionApp); document.querySelectorAll("[data-phonics-lesson]").forEach((button) => button.addEventListener("click", () => showPhonicsIntro(button.dataset.phonicsLesson, button.dataset.mode))); $("phonics-intro-start").addEventListener("click", startPhonicsFromIntroGesture); $("phonics-intro-back").addEventListener("click", leavePhonicsIntro); $("phonics-youtube-start").addEventListener("click", startPhonicsYoutubeFromGesture); $("phonics-youtube-back").addEventListener("click", leavePhonicsYoutube); $("phonics-youtube-end").addEventListener("click", completePhonicsYoutubeAndLeave); $("again-button").addEventListener("click", () => {
    const mode = state.mode || "normal";
    if (!isModeAvailableForMission(mode)) { renderModeSelectMission(); showFixedScreenWhenReady("mode-select-screen"); return; }
    primeBackgroundMusicFromGesture("game"); beginRound(mode);
  });
  $("top-collection-button").addEventListener("click", openTopCollection);
  $("finish-button").addEventListener("click", endToModeSelect); $("quit-button").addEventListener("click", openQuitConfirmation); $("bgm-toggle-button").addEventListener("click", toggleBackgroundMusic);
  $("collection-button").addEventListener("click", openCollection); $("collection-exit").addEventListener("click", exitCollection);
  $("collection-item-button").addEventListener("click", openCapsuleInventory);
  $("collection-item-close").addEventListener("click", closeCapsuleInventory);
  $("collection-item-use").addEventListener("click", startCapsuleSelection);
  $("collection-item-select-start").addEventListener("click", beginCapsuleVehicleChoice);
  $("collection-item-cancel").addEventListener("click", cancelCapsuleSelection);
  $("admin-settings-button").addEventListener("click", openAdminPin);
  $("parent-settings-button").addEventListener("click", openParentPin);
  $("top-reload-button").addEventListener("click", reloadApplication);
  $("parent-pin-form").addEventListener("submit", (event) => event.preventDefault());
  document.querySelectorAll("[data-parent-pin-digit]").forEach((button) => button.addEventListener("click", () => appendParentPinDigit(button.dataset.parentPinDigit)));
  $("parent-pin-clear").addEventListener("click", () => {
    $("parent-pin-input").value = "";
    setProfileError($("parent-pin-error"), "");
  });
  $("parent-pin-backspace").addEventListener("click", () => {
    $("parent-pin-input").value = $("parent-pin-input").value.slice(0, -1);
    setProfileError($("parent-pin-error"), "");
  });
  $("parent-pin-cancel").addEventListener("click", closeParentPin);
  $("parent-settings-close").addEventListener("click", closeParentSettings);
  $("parent-settings-cancel").addEventListener("click", closeParentSettings);
  $("parent-all-modes-off").addEventListener("click", setAllParentTargetsToZero);
  $("parent-settings-save").addEventListener("click", saveParentSettings);
  $("admin-pin-form").addEventListener("submit", (event) => event.preventDefault());
  document.querySelectorAll("[data-admin-pin-digit]").forEach((button) => button.addEventListener("click", () => appendAdminPinDigit(button.dataset.adminPinDigit)));
  $("admin-pin-clear").addEventListener("click", () => {
    $("admin-pin-input").value = "";
    setProfileError($("admin-pin-error"), "");
  });
  $("admin-pin-backspace").addEventListener("click", () => {
    $("admin-pin-input").value = $("admin-pin-input").value.slice(0, -1);
    setProfileError($("admin-pin-error"), "");
  });
  $("admin-pin-cancel").addEventListener("click", closeAdminPin);
  $("admin-panel-close").addEventListener("click", closeAdminPanel);
  $("admin-points-open").addEventListener("click", openPointsDiagnostics);
  $("admin-points-close").addEventListener("click", closePointsDiagnostics);
  $("admin-qa-toggle").addEventListener("click", toggleQaProgressMode);
  $("parent-free-play-toggle").addEventListener("click", () => {
    const settings = parentDraftForProfile(parentSettingsProfileId);
    if (!settings) return;
    settings.freePlayEnabled = settings.freePlayEnabled === false;
    renderParentFreePlaySettings();
  });
  document.querySelectorAll("[data-free-play-energy]").forEach((button) => button.addEventListener("click", () => {
    const settings = parentDraftForProfile(parentSettingsProfileId);
    if (!settings) return;
    settings.freePlayEnergyMode = button.dataset.freePlayEnergy;
    renderParentFreePlaySettings();
  }));
  $("admin-viewport-diagnostics-toggle").addEventListener("click", toggleViewportDiagnostics);
  $("admin-bgm-diagnostics-toggle").addEventListener("click", toggleBgmDiagnostics);
  $("admin-reenable-collection").addEventListener("click", reenableTopCollectionForActiveProfile);
  $("admin-reenable-opening-movie").addEventListener("click", reenableOpeningMovieForActiveProfile);
  $("admin-reset-button").addEventListener("click", () => { $("admin-reset-confirm-overlay").hidden = false; $("admin-reset-cancel").focus(); });
  $("admin-reset-cancel").addEventListener("click", closeAdminResetConfirm);
  $("admin-reset-confirm").addEventListener("click", resetActiveProfileFromAdmin);
  $("level-up-close").addEventListener("click", closeLevelCelebration);
  $("profile-switch-button").addEventListener("click", openProfileManager);
  $("profile-manager-close").addEventListener("click", () => { $("profile-manager-overlay").hidden = true; });
  // Only taps on the backdrop dismiss a dialog; taps within its card never do.
  // Dismiss every nested dialog so the app returns to the underlying top screen.
  const dismissibleOverlays = [
    "profile-manager-overlay", "admin-pin-overlay", "parent-pin-overlay",
    "admin-panel-overlay", "parent-settings-overlay",
    "admin-points-overlay", "admin-reset-confirm-overlay"
  ];
  dismissibleOverlays.forEach((id) => {
    $(id).addEventListener("click", (event) => {
      if (event.target !== event.currentTarget || adminResetInProgress) return;
      if (!$("parent-settings-overlay").hidden) closeParentSettings();
      if (!$("parent-pin-overlay").hidden) closeParentPin();
      if (!$("admin-reset-confirm-overlay").hidden) closeAdminResetConfirm();
      if (!$("admin-points-overlay").hidden) closePointsDiagnostics();
      if (!$("admin-panel-overlay").hidden) closeAdminPanel();
      if (!$("admin-pin-overlay").hidden) closeAdminPin();
      $("profile-manager-overlay").hidden = true;
    });
  });
  $("profile-setup-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("profile-setup-name").value;
    try {
      if (profileStore.hasLegacyChildData()) profileStore.migrateLegacyProfile(name);
      else profileStore.createProfile(name);
      setProfileError($("profile-setup-error"), "");
      $("profile-setup-overlay").hidden = true;
      initializeGameForActiveProfile();
    } catch (error) {
      console.error("Profile setup failed", error);
      setProfileError($("profile-setup-error"), "プロフィールを作れませんでした。もう一度ためしてください。");
    }
  });
  $("profile-add-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      profileStore.createProfile($("profile-add-name").value);
      window.location.reload();
    } catch (error) {
      console.error("Profile creation failed", error);
      setProfileError($("profile-manager-error"), "プロフィールを作れませんでした。なまえを確認してください。");
    }
  });
  $("phonics-reward-intro-cancel").addEventListener("click", cancelPhonicsRewardSelection);
  $("phonics-reward-intro-continue").addEventListener("click", startPhonicsRewardVehicleSelection);
  $("phonics-grow-cancel").addEventListener("click", closePhonicsGrowConfirm);
  $("phonics-grow-accept").addEventListener("click", () => {
    const quest = questBonusSelecting;
    if (quest) {
      void runPhonicsCrossScan({selectedVehicleIndex:state.phonicsRewardSelectedVehicleIndex,skipSearch:true});
    } else {
      applyPhonicsRewardGrowth(state.phonicsRewardSelectedVehicleIndex, showPhonicsCollectionHandoff);
    }
  });
  $("collection-exit-no").addEventListener("click", closeCollectionExit);
  $("collection-exit-yes").addEventListener("click", () => { $("collection-exit-confirm").hidden = true; acknowledgeCollectionCategoryTabs(); endToModeSelect(); });
  document.querySelectorAll(".category-button").forEach((button) => button.addEventListener("click", () => {
    const category = button.dataset.category;
    setCollectionCategory(category);
    sizeCollectionStage();
    showScreen("collection-screen");
  }));
  $("collection-series-prev").addEventListener("click", () => {
    setCollectionCategoryPage(state.collectionCategoryPage - 1);
  });
  $("collection-series-next").addEventListener("click", () => {
    setCollectionCategoryPage(state.collectionCategoryPage + 1);
  });
  $("collection-category-scene").addEventListener("pointerdown", (event) => {
    if (collectionCategoryPageCount(state.collectionCategory) > 1) state.collectionSwipeStartX = event.clientX;
  });
  $("collection-category-scene").addEventListener("pointerup", (event) => {
    if (state.collectionSwipeStartX === null || collectionCategoryPageCount(state.collectionCategory) < 2) return;
    const deltaX = event.clientX - state.collectionSwipeStartX;
    state.collectionSwipeStartX = null;
    if (Math.abs(deltaX) < 70) return;
    setCollectionCategoryPage(deltaX > 0 ? state.collectionCategoryPage + 1 : state.collectionCategoryPage - 1);
  });
  attachDetailCategoryLink(document.querySelector(".detail-slot-vehicle"), "vehicle");
  attachDetailCategoryLink(document.querySelector(".detail-slot-robot"), "robot");
  attachDetailCategoryLink(document.querySelector(".detail-slot-super"), "super-robot");
  attachDetailCategoryLink($("detail-master-medal-display"), "medal");
  $("detail-prev").addEventListener("click", () => moveVehicleDetail(-1));
  $("detail-next").addEventListener("click", () => moveVehicleDetail(1));
  $("detail-back").addEventListener("click", () => { setCollectionCategory("summary"); sizeCollectionStage(); showScreen("collection-screen"); exitCollection(); });
  document.querySelectorAll(".number-key").forEach((button) => button.addEventListener("click", () => inputNumber(button.dataset.number)));
  document.querySelectorAll(".counting-key").forEach((button) => button.addEventListener("click", () => inputCountingAnswer(Number(button.dataset.countingNumber))));
  $("clear-key").addEventListener("click", clearInput); $("long-division-skip-key").addEventListener("click", skipLongDivisionSlot); $("remainder-key").addEventListener("click", chooseRemainder); $("no-remainder-key").addEventListener("click", chooseNoRemainder);
  $("assist-button").addEventListener("click", useAssist);
  $("answer-confirm-back").addEventListener("click", closeAnswerConfirmation);
  $("answer-confirm-proceed").addEventListener("click", revealAnswer);
  $("quit-confirm-cancel").addEventListener("click", confirmQuitToModeSelect);
  $("quit-confirm-continue").addEventListener("click", closeQuitConfirmation);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.confirmingQuit) closeQuitConfirmation();
    else if (state.confirmingAnswer) closeAnswerConfirmation();
  });
  document.addEventListener("visibilitychange", () => {
    recordViewportDiagnostic("visibilitychange", { hidden: document.hidden });
    if (document.hidden) {
      suspendAudioForBackground("visibilitychange:hidden");
      pausePhonicsYoutubeForLifecycle();
    } else {
      resumeAudioAfterVisible("visibilitychange:visible");
      if (!recoverAbnormalPwaZoom("visibilitychange:visible")) schedulePlayStageSize("visibilitychange:visible");
      updateTopCollectionButton();
      checkQuestionTimeout();
    }
  });
  window.addEventListener("blur", () => {
    // iOS can interrupt Web Audio before visibilitychange fires when switching
    // to another app. Fade and suspend on blur first so the OS handoff is silent.
    suspendAudioForBackground("blur", { requireHidden: false, fadeMs: 24, suspendDelayMs: 40 });
  });
  window.addEventListener("focus", () => {
    resumeAudioAfterVisible("focus");
    recoverAbnormalPwaZoom("focus");
    checkQuestionTimeout();
  });
  // WebKit can leave double-tap smart zoom enabled on non-interactive hit targets
  // even when touch-action: manipulation is applied. A no-op click listener on
  // the app root keeps the full app surface in the interactive hit-test path.
  $("app").addEventListener("click", () => {});
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
