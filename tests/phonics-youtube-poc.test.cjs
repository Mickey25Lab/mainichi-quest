const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (_) { chromium = null; }

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

function installMockPlayer() {
  window.__ytPlayers = [];
  window.YT = {
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
    Player: function Player(id, options) {
      const player = {
        id, options, currentTime: 0, state: -1, playCalls: 0, pauseCalls: 0, seekCalls: [], destroyed: false,
        getPlayerState() { return this.state; },
        getCurrentTime() { return this.currentTime; },
        seekTo(seconds) { this.seekCalls.push(seconds); this.currentTime = seconds; },
        playVideo() { this.playCalls += 1; this.state = window.YT.PlayerState.PLAYING; options.events.onStateChange({ data: this.state, target: this }); },
        pauseVideo() { this.pauseCalls += 1; this.state = window.YT.PlayerState.PAUSED; options.events.onStateChange({ data: this.state, target: this }); },
        stopVideo() { this.state = -1; },
        destroy() { this.destroyed = true; },
        finish() { this.state = window.YT.PlayerState.ENDED; options.events.onStateChange({ data: this.state, target: this }); }
      };
      window.__ytPlayers.push(player);
      window.setTimeout(() => options.events.onReady({ target: player }), 0);
      return player;
    }
  };
}

test("phonics YouTube PoC pauses only at its configured checkpoints and never rewards viewing", async (t) => {
  if (!chromium) {
    t.skip("Playwright is not installed in this local checkout; run this browser test in CI or with the project browser-test dependency.");
    return;
  }
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 834, height: 1112 }, isMobile: true, hasTouch: true });
  await context.addInitScript(installMockPlayer);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(baseUrl);
  await page.locator("#profile-setup-name").fill("動画確認");
  await page.locator("#profile-setup-form button[type=submit]").click();
  await page.locator("#profile-setup-overlay").waitFor({ state: "hidden" });
  await page.locator("#start-button").click();
  await page.waitForFunction(() => window.__ytPlayers.length === 1);
  await page.locator("#mode-select-phonics").click();
  await page.locator("#phonics-youtube-screen.active").waitFor();
  await page.waitForFunction(() => window.__ytPlayers[0].playCalls === 1);

  const playerOptions = await page.evaluate(() => window.__ytPlayers[0].options);
  assert.equal(playerOptions.videoId, "ChqnN3cKzXQ");
  assert.equal(playerOptions.host, "https://www.youtube-nocookie.com");
  assert.equal(playerOptions.playerVars.playsinline, 1);
  assert.equal(playerOptions.playerVars.enablejsapi, 1);
  assert.equal(playerOptions.playerVars.autoplay, 0);
  assert.equal(playerOptions.playerVars.controls, 0);
  assert.equal(playerOptions.playerVars.disablekb, 1);
  assert.equal(playerOptions.playerVars.fs, 0);
  const playerFrame = await page.locator(".phonics-youtube-player-frame").boundingBox();
  assert.ok(playerFrame && playerFrame.width / playerFrame.height > 1.7 && playerFrame.width / playerFrame.height < 1.9);

  assert.equal(await page.locator("#phonics-youtube-start").isVisible(), false);
  assert.deepEqual(await page.evaluate(() => window.__ytPlayers[0].seekCalls), [10]);
  await page.evaluate(() => { window.__ytPlayers[0].currentTime = 20; });
  await page.waitForFunction(() => window.__ytPlayers[0].pauseCalls === 1);
  await page.waitForFunction(() => document.querySelector("#phonics-youtube-status").textContent.includes("一時停止 1 / 5"));
  await page.waitForFunction(() => window.__ytPlayers[0].playCalls === 2, { timeout: 5000 });

  // A manual play during the three-second prompt cancels the queued resume.
  await page.evaluate(() => { const player = window.__ytPlayers[0]; player.currentTime = 30; });
  await page.waitForFunction(() => window.__ytPlayers[0].pauseCalls === 2);
  await page.evaluate(() => window.__ytPlayers[0].playVideo());
  await page.waitForTimeout(3200);
  assert.equal(await page.evaluate(() => window.__ytPlayers[0].playCalls), 3);

  // Seeking back over a completed point cannot pause it a second time.
  await page.evaluate(() => { window.__ytPlayers[0].currentTime = 20; });
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__ytPlayers[0].pauseCalls), 2);

  // PWA/background lifecycle pauses but does not resume playback on its own.
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.waitForFunction(() => window.__ytPlayers[0].pauseCalls === 3);
  await page.waitForTimeout(3200);
  assert.equal(await page.evaluate(() => window.__ytPlayers[0].playCalls), 3);

  await page.evaluate(() => window.__ytPlayers[0].finish());
  await page.locator("#phonics-youtube-end").waitFor({ state: "visible" });
  assert.equal(await page.locator("#phonics-youtube-start").isVisible(), false);
  assert.equal(await page.locator("#phonics-youtube-end").isVisible(), true);
  await page.locator("#phonics-youtube-end").click();
  await page.locator("#mode-select-screen.active").waitFor();
  assert.equal(await page.evaluate(() => window.__ytPlayers[0].destroyed), true);
  assert.deepEqual(pageErrors, []);
});

test("phonics YouTube PoC is explicitly playback-only", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.match(app, /videoId: "ChqnN3cKzXQ"/);
  assert.match(app, /startTimeSeconds: 10/);
  assert.match(app, /endTimeSeconds: 60/);
  assert.match(app, /timeSeconds: 20/);
  assert.match(app, /timeSeconds: 30/);
  assert.match(app, /timeSeconds: 40/);
  assert.match(app, /timeSeconds: 50/);
  assert.match(app, /timeSeconds: 60, final: true/);
  assert.match(app, /host: "https:\/\/www\.youtube-nocookie\.com"/);
  assert.match(app, /playsinline: 1/);
  assert.match(app, /controls: 0/);
  assert.match(app, /onAutoplayBlocked/);
  assert.match(app, /pausePhonicsYoutubeForLifecycle/);
  const pocSection = app.slice(app.indexOf("const phonicsYoutube ="), app.indexOf("let collectionScaleRequest"));
  assert.doesNotMatch(pocSection, /profileStore|setReward|scaledEnergyGain|completeDailyMission/);
});
