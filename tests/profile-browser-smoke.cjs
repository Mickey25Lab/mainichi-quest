const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const browserExecutable = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

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

async function unlockAdmin(page, pin = "3710") {
  await page.locator("#admin-settings-button").click();
  await page.locator("#admin-pin-overlay").waitFor({ state: "visible" });
  await page.locator("#admin-pin-input").fill(pin);
  await page.locator("#admin-pin-form button[type=submit]").click();
  if (pin === "3710") await page.locator("#admin-panel-overlay").waitFor({ state: "visible" });
}

async function enterQaMode(page) {
  await unlockAdmin(page);
  assert.equal(await page.locator("#admin-qa-toggle").getAttribute("aria-checked"), "false");
  await page.locator("#admin-qa-toggle").click();
  await page.waitForURL(/\?qa=progress&reset=1$/);
  await page.locator("#profile-setup-overlay").waitFor({ state: "hidden" });
}

async function exitQaMode(page) {
  await unlockAdmin(page);
  assert.equal(await page.locator("#admin-qa-toggle").getAttribute("aria-checked"), "true");
  await page.locator("#admin-qa-toggle").click();
  await page.waitForURL((url) => !url.searchParams.has("qa"));
  await page.locator("#profile-setup-overlay").waitFor({ state: "hidden" });
}

test("admin PIN gates QA and the old direct controls are absent", async (t) => {
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await createInitialProfile(page, "管理確認");

  assert.equal(await page.locator("#qa-mode-toggle").count(), 0);
  assert.equal(await page.locator("#developer-reset-button").count(), 0);
  assert.equal(await page.locator("#developer-reset-confirm").count(), 0);
  assert.equal(await page.locator("#admin-settings-button").isVisible(), true);

  await unlockAdmin(page, "1234");
  assert.equal(await page.locator("#admin-panel-overlay").isVisible(), false);
  assert.match(await page.locator("#admin-pin-error").textContent(), /ちがいます/);
  await page.locator("#admin-pin-input").fill("371");
  await page.locator("#admin-pin-form button[type=submit]").click();
  assert.equal(await page.locator("#admin-panel-overlay").isVisible(), false);
  await page.locator("#admin-pin-input").fill("3710");
  await page.locator("#admin-pin-form button[type=submit]").click();
  await page.locator("#admin-panel-overlay").waitFor({ state: "visible" });
  assert.equal(await page.locator("#admin-qa-toggle").getAttribute("aria-checked"), "false");
  assert.deepEqual(errors, []);
});

test("new profile, profile separation, persistence, and game smoke", async (t) => {
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
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

test("legacy migration copies progress and keeps legacy keys", async (t) => {
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
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
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
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
  await page.goto(`${baseUrl}/?qa=progress`);
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
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
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
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
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
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
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
