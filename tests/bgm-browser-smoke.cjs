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

async function waitForBgmGroup(page, group) {
  await page.waitForFunction((expected) => document.documentElement.dataset.bgmGroup === expected, group, { timeout: 30000 });
}
async function bgmStarts(page) { return page.evaluate(() => window.__bgmStarts || 0); }

test("BGM follows screens, persists OFF, and does not restart inside a group", async (t) => {
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}), args: ["--autoplay-policy=user-gesture-required"] });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1400, height: 1050 } });
  await context.addInitScript(() => {
    window.__bgmStarts = 0;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor || AudioCtor.prototype.__mqBgmInstrumented) return;
    const create = AudioCtor.prototype.createBufferSource;
    AudioCtor.prototype.createBufferSource = function instrumentedCreateBufferSource(...args) {
      window.__bgmAudioContext = this;
      const source = create.apply(this, args);
      const start = source.start;
      source.start = function instrumentedStart(...startArgs) {
        window.__bgmStarts += 1;
        return start.apply(this, startArgs);
      };
      return source;
    };
    AudioCtor.prototype.__mqBgmInstrumented = true;
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(baseUrl);
  await page.locator("#profile-setup-name").fill("BGM確認");
  await page.locator("#profile-setup-form button[type=submit]").click();
  await page.locator("#profile-setup-overlay").waitFor({ state: "hidden" });

  await waitForBgmGroup(page, "heroic");
  await page.waitForFunction(() => window.__bgmAudioContext?.state === "running");
  const heroicStartCount = await bgmStarts(page);
  assert.ok(heroicStartCount >= 1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow")));
  await page.waitForTimeout(50);
  assert.equal(await bgmStarts(page), heroicStartCount);
  assert.equal(await page.locator(".start-developer").count(), 0);
  const speakerBox = await page.locator("#top-bgm-toggle-button").boundingBox();
  assert.ok(speakerBox);
  assert.ok(1400 - (speakerBox.x + speakerBox.width) <= 20);
  assert.ok(1050 - (speakerBox.y + speakerBox.height) <= 20);
  const reloadBox = await page.locator("#top-reload-button").boundingBox();
  const settingsBox = await page.locator("#admin-settings-button").boundingBox();
  assert.ok(reloadBox && settingsBox);
  assert.ok(reloadBox.x + reloadBox.width < settingsBox.x);
  assert.ok(settingsBox.x - (reloadBox.x + reloadBox.width) <= 12);
  assert.equal(reloadBox.y, settingsBox.y);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.locator("#top-reload-button").click()
  ]);
  await page.locator("#start-screen.active").waitFor();
  await waitForBgmGroup(page, "heroic");
  await page.locator("#start-title").click({ position: { x: 20, y: 20 } });
  await page.waitForFunction(() => window.__bgmAudioContext?.state === "running");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.bgmGroup), "heroic");
  const reloadedHeroicStartCount = await bgmStarts(page);

  await page.locator("#start-button").click();
  await page.locator("#mode-select-screen.active").waitFor();
  await waitForBgmGroup(page, "heroic");
  assert.equal(await bgmStarts(page), reloadedHeroicStartCount);

  await page.locator("#mode-select-normal").click();
  await page.locator("#play-screen.active").waitFor();
  await waitForBgmGroup(page, "game");
  const gameSpeakerBox = await page.locator("#bgm-toggle-button").boundingBox();
  assert.ok(gameSpeakerBox);
  assert.ok(Math.abs(speakerBox.width - gameSpeakerBox.width) < 0.5);
  assert.ok(Math.abs(speakerBox.height - gameSpeakerBox.height) < 0.5);
  assert.equal(await bgmStarts(page), reloadedHeroicStartCount + 1);
  assert.equal(await page.locator("#bgm-toggle-button").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#top-bgm-toggle-button").getAttribute("aria-pressed"), "true");

  await page.locator("#bgm-toggle-button").click();
  await waitForBgmGroup(page, "");
  assert.equal(await page.evaluate(() => localStorage.getItem("warizan-robot:bgm-enabled-v1")), "false");
  assert.equal(await page.locator("#top-bgm-toggle-button").getAttribute("aria-pressed"), "false");
  await page.locator("#bgm-toggle-button").click();
  await waitForBgmGroup(page, "game");
  assert.equal(await page.locator("#top-bgm-toggle-button").getAttribute("aria-pressed"), "true");

  await page.locator("#quit-button").click();
  await page.locator("#quit-confirm-cancel").click();
  await page.locator("#mode-select-screen.active").waitFor();
  await waitForBgmGroup(page, "heroic");
  await page.locator("#mode-select-back").click();
  await page.locator("#start-screen.active").waitFor();
  const beforeTopCollection = await bgmStarts(page);

  await page.locator("#top-collection-button").click();
  await page.locator("#collection-screen.active").waitFor({ timeout: 30000 });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.bgmGroup), "heroic");
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.bgmGroup), "heroic");
  await waitForBgmGroup(page, "collection");
  const collectionStartCount = await bgmStarts(page);
  assert.equal(collectionStartCount, beforeTopCollection + 1);
  await page.locator(".collection-card").first().click();
  await page.locator("#collection-detail-screen.active").waitFor();
  await waitForBgmGroup(page, "collection");
  assert.equal(await bgmStarts(page), collectionStartCount);
  await page.locator("#detail-back").click();
  await page.locator("#collection-screen.active").waitFor();
  assert.equal(await bgmStarts(page), collectionStartCount);

  await page.locator("#collection-exit").click();
  await page.locator("#collection-exit-yes").click();
  await page.locator("#mode-select-screen.active").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.bgmGroup), "collection");
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.bgmGroup), "collection");
  await waitForBgmGroup(page, "heroic");
  await page.locator("#mode-select-back").click();
  await page.locator("#start-screen.active").waitFor();
  await page.locator("#top-bgm-toggle-button").click();
  await waitForBgmGroup(page, "");
  await page.locator("#start-button").click();
  await page.locator("#mode-select-normal").click();
  await page.locator("#play-screen.active").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.bgmGroup || ""), "");
  assert.equal(await page.locator("#bgm-toggle-button").getAttribute("aria-pressed"), "false");
  assert.deepEqual(pageErrors, []);
});
