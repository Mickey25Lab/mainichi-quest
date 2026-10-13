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
