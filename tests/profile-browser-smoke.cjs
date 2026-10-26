const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const browserExecutable = process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : undefined;

const root = path.resolve(__dirname, "../dist");
let server;
let baseUrl;

test.before(async () => {
  server = http.createServer((request, response) => {
    const requestPath = new URL(request.url, "http://localhost").pathname;
    const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\//, "");
    const filePath = path.resolve(root, relative);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404); response.end("not found"); return;
    }
    const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml", ".mp3":"audio/mpeg", ".wav":"audio/wav" };
    response.setHeader("content-type", types[path.extname(filePath)] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/preview-meta.json")) errors.push(`${response.status()} ${response.url()}`);
  });
  return errors;
}

async function createInitialProfile(page, name) {
  await page.goto(baseUrl);
  await page.locator("#profile-setup-overlay").waitFor({ state: "visible" });
  await page.locator("#profile-setup-name").fill(name);
  await page.locator("#profile-setup-form button[type=submit]").click();
  await page.locator("#profile-setup-overlay").waitFor({ state: "hidden" });
}

async function enterAdminPinDigits(page, pin) {
  for (const digit of String(pin)) await page.locator(`[data-admin-pin-digit="${digit}"]`).click();
}
async function unlockAdmin(page, pin = "3710") {
  await page.locator("#admin-settings-button").click();
  await page.locator("#admin-pin-overlay").waitFor({ state: "visible" });
  await enterAdminPinDigits(page, pin);
  if (pin === "3710") await page.locator("#admin-panel-overlay").waitFor({ state: "visible" });
}

async function enterQaMode(page) {
  await unlockAdmin(page);
  assert.equal(await page.locator("#admin-qa-toggle").getAttribute("aria-checked"), "false");
  await Promise.all([
    page.waitForEvent("load"),
    page.locator("#admin-qa-toggle").click()
  ]);
  assert.equal(await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getActiveQaState().qaEnabled), true);
  await page.locator("#profile-setup-overlay").waitFor({ state: "hidden" });
}

async function exitQaMode(page) {
  await unlockAdmin(page);
  assert.equal(await page.locator("#admin-qa-toggle").getAttribute("aria-checked"), "true");
  await Promise.all([
    page.waitForEvent("load"),
    page.locator("#admin-qa-toggle").click()
  ]);
  assert.equal(await page.evaluate(() => Boolean(window.MQProfileStorage.createProfileStorage(localStorage).getActiveQaState().qaEnabled)), false);
  await page.locator("#profile-setup-overlay").waitFor({ state: "hidden" });
}

test("admin PIN gates QA and the old direct controls are absent", async (t) => {
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await createInitialProfile(page, "管理確認");

  assert.equal(await page.locator("#qa-mode-toggle").count(), 0);
  assert.equal(await page.locator("#developer-reset-button").count(), 0);
  assert.equal(await page.locator("#developer-reset-confirm").count(), 0);
  assert.equal(await page.locator("#admin-settings-button").isVisible(), true);
  await page.locator("#admin-settings-button").click();
  await page.locator("#admin-pin-overlay").waitFor({ state: "visible" });
  assert.equal(await page.locator("#admin-pin-input").getAttribute("readonly"), "");
  assert.equal(await page.locator("[data-admin-pin-digit]").count(), 10);
  await page.locator("#admin-pin-cancel").click();

  await unlockAdmin(page, "1234");
  assert.equal(await page.locator("#admin-panel-overlay").isVisible(), false);
  assert.match(await page.locator("#admin-pin-error").textContent(), /ちがいます/);
  assert.equal(await page.locator("#admin-pin-input").inputValue(), "");
  await enterAdminPinDigits(page, "371");
  assert.equal(await page.locator("#admin-panel-overlay").isVisible(), false);
  await page.locator("#admin-pin-backspace").click();
  await page.locator('[data-admin-pin-digit="1"]').click();
  assert.equal(await page.locator("#admin-pin-input").inputValue(), "371");
  await page.locator("#admin-pin-clear").click();
  assert.equal(await page.locator("#admin-pin-input").inputValue(), "");
  await enterAdminPinDigits(page, "3710");
  await page.locator("#admin-panel-overlay").waitFor({ state: "visible" });
  assert.equal(await page.locator("#admin-qa-toggle").getAttribute("aria-checked"), "false");
  assert.deepEqual(errors, []);
});

test("admin can re-enable today's collection and opening movie only for the active profile", async (t) => {
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await createInitialProfile(page, "A");

  const seeded = await page.evaluate(() => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    const profileA = store.getActiveProfile();
    const parts = new Intl.DateTimeFormat("en-US", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
    const dateKey = `${values.year}-${values.month}-${values.day}`;
    store.setTopCollectionLastUsedJst(dateKey);
    store.setOpeningMovieLastPlayedJst(dateKey);
    const profileB = store.createProfile("B");
    store.setTopCollectionLastUsedJst(dateKey);
    store.setOpeningMovieLastPlayedJst(dateKey);
    store.setActiveProfile(profileA.profileId);
    return { profileAId: profileA.profileId, profileBId: profileB.profileId, dateKey };
  });
  await page.reload();
  assert.equal(await page.locator("#top-collection-button").isDisabled(), true);

  await unlockAdmin(page);
  await page.locator("#admin-reenable-collection").click();
  assert.equal(await page.locator("#top-collection-button").isDisabled(), false);
  await page.locator("#admin-reenable-opening-movie").click();

  const after = await page.evaluate(({ profileAId, profileBId }) => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    const active = { collection: store.getTopCollectionLastUsedJst(), movie: store.getOpeningMovieLastPlayedJst() };
    store.setActiveProfile(profileBId);
    const other = { collection: store.getTopCollectionLastUsedJst(), movie: store.getOpeningMovieLastPlayedJst() };
    store.setActiveProfile(profileAId);
    return { active, other };
  }, seeded);
  assert.deepEqual(after.active, { collection: null, movie: null });
  assert.deepEqual(after.other, { collection: seeded.dateKey, movie: seeded.dateKey });

  await page.reload();
  assert.equal(await page.locator("#top-collection-button").isDisabled(), false);
  assert.deepEqual(errors, []);
});

test("new profile, profile separation, persistence, and game smoke", async (t) => {
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await page.goto(baseUrl);

  await assert.doesNotReject(() => page.locator("#profile-setup-overlay").waitFor({ state: "visible" }));
  await page.locator("#profile-setup-name").fill("すみれ");
  await page.locator("#profile-setup-form button[type=submit]").click();
  await page.locator("#profile-setup-overlay").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#active-profile-name").textContent(), "すみれ");

  const profileA = await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getActiveProfile());
  await page.evaluate(() => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    store.setRewardProgress(Array.from({ length: 20 }, (_, index) => ({ discovered:index === 0, friendship:index === 0 ? 5 : 0, friendly:index === 0, stage:index === 0 ? 2 : 1, energy:0, masterMedal:false })));
  });

  await page.locator("#profile-switch-button").click();
  await page.locator("#profile-add-name").fill("みなと");
  await page.locator("#profile-add-form button[type=submit]").click();
  await page.waitForLoadState("load");
  assert.equal(await page.locator("#active-profile-name").textContent(), "みなと");
  assert.equal(await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getRewardProgress()), null);

  await page.locator("#profile-switch-button").click();
  await page.locator(`#profile-list button[data-profile-id="${profileA.profileId}"]`).click();
  await page.waitForLoadState("load");
  assert.equal(await page.locator("#active-profile-name").textContent(), "すみれ");
  assert.equal(await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getRewardProgress()[0].discovered), true);

  await page.reload();
  assert.equal(await page.locator("#active-profile-name").textContent(), "すみれ");
  await page.locator("#start-button").click();
  await page.locator("#mode-select-screen.active").waitFor();
  await page.locator("#mode-select-normal").click();
  await page.locator("#play-screen.active").waitFor();
  assert.match(await page.locator("#problem-card").textContent(), /÷/);
  assert.deepEqual(errors, []);
});

test("unfinished acquisition is not persisted and QA preset does not add history", async (t) => {
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await createInitialProfile(page, "履歴確認");
  await page.locator("#start-button").click();
  await page.locator("#mode-select-normal").click();
  await page.locator("#play-screen.active").waitFor();
  const match = (await page.locator("#problem-card").textContent()).match(/(\d+)\s*÷\s*(\d+)/);
  assert.ok(match);
  const dividend = Number(match[1]);
  const divisor = Number(match[2]);
  const clickDigits = async (value) => {
    for (const digit of String(value)) await page.locator(`.number-key[data-number="${digit}"]`).click();
  };
  await clickDigits(Math.floor(dividend / divisor));
  const remainder = dividend % divisor;
  if (remainder === 0) await page.locator("#no-remainder-key").click();
  else {
    await page.locator("#remainder-key").click();
    await clickDigits(remainder);
  }
  // The first discovery appears in play but is not persisted until the full round ends.
  await page.waitForFunction(() => {
    const progress = window.MQProfileStorage.createProfileStorage(localStorage).getRewardProgress();
    return progress === null || progress.every((entry) => !entry.discovered);
  });
  assert.equal(await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getAcquisitionHistory().length), 0);
  await page.reload();
  assert.equal(await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getAcquisitionHistory().length), 0);
  const reloadedProgress = await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getRewardProgress());
  assert.ok(reloadedProgress === null || reloadedProgress.every((entry) => !entry.discovered));
  await enterQaMode(page);
  assert.equal(await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getAcquisitionHistory().length), 0);
  assert.deepEqual(errors, []);
});

test("legacy migration copies progress and keeps legacy keys", async (t) => {
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
  const page = await context.newPage();
  const errors = watchErrors(page);
  const progress = Array.from({ length: 20 }, (_, index) => ({ discovered:index < 2, friendship:index < 2 ? 5 : 0, friendly:index < 2, stage:index < 2 ? 3 : 1, energy:0, masterMedal:false }));
  await page.addInitScript((seed) => {
    localStorage.setItem("warizan-robot:reward-progress-phase1-v1", JSON.stringify(seed));
    localStorage.setItem("warizan-robot:best-time-ms", "4567");
  }, progress);
  await page.goto(baseUrl);
  assert.match(await page.locator("#profile-setup-message").textContent(), /ひきつぎ/);
  await page.locator("#profile-setup-name").fill("これまでのデータ");
  await page.locator("#profile-setup-form button[type=submit]").click();
  await page.locator("#profile-setup-overlay").waitFor({ state: "hidden" });

  const result = await page.evaluate(() => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    return {
      profile: store.getActiveProfile(),
      migrated: store.getMigrationState(),
      oldProgress: localStorage.getItem("warizan-robot:reward-progress-phase1-v1"),
      oldBest: localStorage.getItem("warizan-robot:best-time-ms")
    };
  });
  assert.equal(result.profile.displayName, "これまでのデータ");
  assert.equal(result.profile.progress.rewardProgressPhase1[0].discovered, true);
  assert.equal(result.profile.bestRecords.bestTimeMs, 4567);
  assert.equal(result.migrated.migrationCompleted, true);
  assert.equal(result.oldProgress, JSON.stringify(progress));
  assert.equal(result.oldBest, "4567");
  assert.deepEqual(errors, []);
});

test("new profile returns to its exact empty progress after QA mode and reload", async (t) => {
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await createInitialProfile(page, "新規QA");

  const before = await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getProgressSnapshot());
  await enterQaMode(page);
  const during = await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getProgressSnapshot());
  assert.ok(during.rewardProgress.some((item) => item.discovered));
  assert.ok(during.collection.some((stage) => stage > 0));

  await page.locator("#top-collection-button").click();
  await page.locator("#collection-screen.active").waitFor();
  await page.reload(); // Admin gear is on TOP, not inside the collection screen.
  await exitQaMode(page);
  assert.deepEqual(await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getProgressSnapshot()), before);
  await page.reload();
  const afterReload = await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getProgressSnapshot());
  assert.deepEqual(afterReload, before);
  assert.equal(afterReload.rewardProgress, null);
  assert.ok(afterReload.collection.every((stage) => stage === 0));
  assert.deepEqual(errors, []);
});

test("QA restores existing progress exactly and does not affect another profile", async (t) => {
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await createInitialProfile(page, "A");

  const result = await page.evaluate(() => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    const profileA = store.getActiveProfile();
    const progressA = Array.from({ length: 20 }, (_, index) => ({
      discovered: index < 3, friendship: index < 3 ? 5 : 0, friendly: index < 3,
      stage: index === 0 ? 3 : index === 1 ? 4 : index === 2 ? 5 : 1,
      energy: index < 3 ? index + 7 : 0, masterMedal: false
    }));
    store.setRewardProgress(progressA);
    store.setCollectionStages(progressA.map((item) => item.discovered ? item.stage - 1 : 0));
    const snapshotA = store.getProgressSnapshot();
    const profileB = store.createProfile("B");
    const progressB = Array.from({ length: 20 }, (_, index) => ({
      discovered: index === 5, friendship: index === 5 ? 2 : 0, friendly: false,
      stage: index === 5 ? 2 : 1, energy: 0, masterMedal: false
    }));
    store.setRewardProgress(progressB);
    store.setCollectionStages(progressB.map((item) => item.discovered ? 1 : 0));
    const snapshotB = store.getProgressSnapshot();
    store.setActiveProfile(profileA.profileId);
    return { profileA, profileB, snapshotA, snapshotB };
  });
  await page.reload();

  await enterQaMode(page);
  await exitQaMode(page);
  assert.deepEqual(await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getProgressSnapshot()), result.snapshotA);
  await page.reload();
  assert.deepEqual(await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getProgressSnapshot()), result.snapshotA);

  const profilesAfter = await page.evaluate(({ profileAId, profileBId }) => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    store.setActiveProfile(profileBId);
    const snapshotB = store.getProgressSnapshot();
    store.setActiveProfile(profileAId);
    const snapshotA = store.getProgressSnapshot();
    return { snapshotA, snapshotB };
  }, { profileAId: result.profileA.profileId, profileBId: result.profileB.profileId });
  assert.deepEqual(profilesAfter.snapshotA, result.snapshotA);
  assert.deepEqual(profilesAfter.snapshotB, result.snapshotB);
  assert.deepEqual(errors, []);
});

test("collection-only fallback persists transition-consistent progress for every stage", async (t) => {
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await createInitialProfile(page, "旧コレクション");
  await page.evaluate(() => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    store.setRewardProgress(null);
    store.setCollectionStages([0, 1, 2, 3, 4, 5, ...Array(14).fill(0)]);
  });
  await page.reload();

  const snapshot = await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getProgressSnapshot());
  assert.deepEqual(snapshot.collection.slice(0, 6), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(snapshot.rewardProgress.slice(0, 6).map(({ friendship, friendly, stage, masterMedal }) => ({ friendship, friendly, stage, masterMedal })), [
    { friendship: 0, friendly: false, stage: 1, masterMedal: false },
    { friendship: 0, friendly: false, stage: 2, masterMedal: false },
    { friendship: 5, friendly: true, stage: 3, masterMedal: false },
    { friendship: 5, friendly: true, stage: 4, masterMedal: false },
    { friendship: 5, friendly: true, stage: 5, masterMedal: false },
    { friendship: 5, friendly: true, stage: 5, masterMedal: true }
  ]);
  assert.ok(snapshot.rewardProgress.filter((item) => item.stage >= 3).every((item) => item.friendly && item.friendship === 5));
  assert.deepEqual(errors, []);
});

test("admin reset cancels safely then clears only the active profile progress", async (t) => {
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await createInitialProfile(page, "A");

  const seeded = await page.evaluate(() => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    const profileA = store.getActiveProfile();
    store.setRewardProgress([{ discovered:true, friendship:5, friendly:true, stage:4, energy:33, masterMedal:false }]);
    store.setCollectionStages([3]);
    store.setRecentVehicles([1, 2, 3]);
    store.setBestTime(4321);
    store.setTopCollectionLastUsedJst("2026-10-13");
    let registry = JSON.parse(localStorage.getItem(store.keys.profiles));
    let a = registry.profiles.find((profile) => profile.profileId === profileA.profileId);
    a.progress.legacyHistory = { played: 8 };
    a.progress.legacyRanking = ["rank"];
    a.enabledModes = { division: true };
    a.energyMultipliers = { division: 0.5 };
    localStorage.setItem(store.keys.profiles, JSON.stringify(registry));
    const profileB = store.createProfile("B");
    store.setRewardProgress([{ discovered:true, friendship:2, friendly:false, stage:2, energy:0, masterMedal:false }]);
    store.setCollectionStages([1]);
    store.setRecentVehicles([7]);
    store.setBestTime(9876);
    const snapshotB = store.getActiveProfile();
    store.setActiveProfile(profileA.profileId);
    return { profileA: store.getActiveProfile(), profileB, snapshotB };
  });
  await page.reload();
  const beforeCancel = await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getActiveProfile());

  await unlockAdmin(page);
  await page.locator("#admin-reset-button").click();
  await page.locator("#admin-reset-confirm-overlay").waitFor({ state: "visible" });
  await page.locator("#admin-reset-cancel").click();
  await page.locator("#admin-reset-confirm-overlay").waitFor({ state: "hidden" });
  assert.deepEqual(await page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getActiveProfile()), beforeCancel);

  await page.locator("#admin-reset-button").click();
  await page.locator("#admin-reset-confirm-overlay").waitFor({ state: "visible" });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.locator("#admin-reset-confirm").click()
  ]);
  await page.locator("#profile-setup-overlay").waitFor({ state: "hidden" });

  const after = await page.evaluate(({ profileAId, profileBId }) => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    const active = store.getActiveProfile();
    store.setActiveProfile(profileBId);
    const profileB = store.getActiveProfile();
    store.setActiveProfile(profileAId);
    return { active, profileB };
  }, { profileAId: seeded.profileA.profileId, profileBId: seeded.profileB.profileId });
  assert.equal(after.active.profileId, seeded.profileA.profileId);
  assert.equal(after.active.displayName, "A");
  assert.equal(after.active.createdAt, seeded.profileA.createdAt);
  assert.equal(after.active.progress.rewardProgressPhase1, null);
  assert.ok(after.active.collection.stages.every((stage) => stage === 0));
  assert.ok(after.active.progress.recentVehicles.length <= 1);
  assert.notDeepEqual(after.active.progress.recentVehicles, [1, 2, 3]);
  assert.equal(after.active.progress.topCollectionLastUsedJst, null);
  assert.equal(after.active.progress.legacyHistory, null);
  assert.equal(after.active.progress.legacyRanking, null);
  assert.equal(after.active.bestRecords.bestTimeMs, null);
  assert.deepEqual(after.active.enabledModes, { division: true });
  assert.deepEqual(after.active.energyMultipliers, { division: 0.5 });
  assert.deepEqual(after.profileB, seeded.snapshotB);
  await page.reload();
  assert.equal(await page.locator("#active-profile-name").textContent(), "A");
  assert.deepEqual(errors, []);
});

test("completed quest offers a chosen vehicle charge once, surviving reload", async (t) => {
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport:{width:1400,height:1050} });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await createInitialProfile(page, "クエストテスト");
  const date = await page.evaluate(() => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    const profileId = store.getActiveProfileId();
    const modes = ["numbercards","counting1","counting2","multiplication","multiplication2x2","multiplication2x2-unguided","normal","longdivision","phonics-part-1","phonics-part-2","phonics-part-3","phonics-part-4","phonics-part-5","phonics-review"];
    const dailyTargetCounts = Object.fromEntries(modes.map((mode) => [mode,mode === "normal" ? 1 : 0]));
    store.setProfileLearningSettings(profileId,{...store.getProfileLearningSettings(profileId),dailyTargetCounts});
    const parts = new Intl.DateTimeFormat("en-US", {timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const fields = Object.fromEntries(parts.filter((part)=>part.type!=="literal").map((part)=>[part.type,part.value]));
    const today = fields.year + "-" + fields.month + "-" + fields.day;
    store.setDailyMission({ date:today, completedCounts:{ normal:1 }});
    const progress = Array.from({length:20}, (_,i)=>({discovered:i===0,friendship:0,friendly:false,stage:i===0?2:1,energy:0,masterMedal:false}));
    store.setRewardProgress(progress);
    store.setCollectionStages(progress.map((p)=>p.discovered?2:0));
    return today;
  });
  await page.reload();
  await page.locator("#start-button").click();
  await page.locator("#mode-select-screen.active").waitFor();
  await page.locator("#quest-bonus-continue").click();
  await page.locator("#collection-screen.active").waitFor();
  await page.locator("#collection-grid .collection-card[data-vehicle='0']").click();
  await page.locator("#phonics-grow-confirm").waitFor({state:"visible"});
  assert.match(await page.locator("#phonics-grow-amount").textContent(), /5/);
  await page.locator("#phonics-grow-accept").click();
  await page.waitForFunction((today) => window.MQProfileStorage.createProfileStorage(localStorage).getQuestBonusClaimDate()===today,date);
  const storeAfter = await page.evaluate(() => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    return {heart:store.getRewardProgress()[0].friendship,claim:store.getQuestBonusClaimDate()};
  });
  assert.equal(storeAfter.heart,5);
  assert.equal(storeAfter.claim,date);
  await page.reload();
  await page.locator("#start-button").click();
  await page.locator("#mode-select-screen.active").waitFor();
  assert.equal(await page.locator("#collection-screen.active").count(),0);
  assert.deepEqual(errors,[]);
});
