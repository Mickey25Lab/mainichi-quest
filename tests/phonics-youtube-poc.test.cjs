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
        id, options, currentTime: 0, state: -1, playCalls: 0, pauseCalls: 0, seekCalls: [], destroyed: false, volume: 100, volumeCalls: [],
        getPlayerState() { return this.state; },
        getCurrentTime() { return this.currentTime; },
        seekTo(seconds) { this.seekCalls.push(seconds); this.currentTime = seconds; },
        playVideo() { this.playCalls += 1; this.state = window.YT.PlayerState.PLAYING; options.events.onStateChange({ data: this.state, target: this }); },
        pauseVideo() { this.pauseCalls += 1; this.state = window.YT.PlayerState.PAUSED; options.events.onStateChange({ data: this.state, target: this }); },
        setVolume(value) { this.volume = value; this.volumeCalls.push(value); },
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

test("phonics Part 2 repeats G-K normally, then moves to the next frame seamlessly", async (t) => {
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
  const completionButton = page.locator("#phonics-youtube-end");
  assert.equal(await completionButton.isVisible(), true);
  assert.equal(await completionButton.isDisabled(), false);
  assert.equal(await completionButton.evaluate((button) => button.classList.contains("is-pending")), true);

  const playerOptions = await page.evaluate(() => window.__ytPlayers[0].options);
  assert.equal(playerOptions.videoId, "ChqnN3cKzXQ");
  assert.equal(playerOptions.host, "https://www.youtube-nocookie.com");
  assert.equal(playerOptions.playerVars.controls, 0);
  const expectedFrames = [
    ["G-1", 60.14, 65.19, 60.53], ["G-2", 65.19, 70.24, 65.58],
    ["H-1", 70.24, 75.29, 70.63], ["H-2", 75.29, 80.34, 75.68],
    ["I-1", 80.34, 85.39, 80.73], ["I-2", 85.39, 90.44, 85.78],
    ["J-1", 90.44, 95.49, 90.83], ["J-2", 95.49, 100.54, 95.88],
    ["K-1", 100.54, 105.59, 100.93], ["K-2", 105.59, 110.64, 105.98]
  ];
  assert.deepEqual(await page.evaluate(() => window.__ytPlayers[0].seekCalls), [60.14]);

  for (let index = 0; index < expectedFrames.length; index += 1) {
    const [id, start, end, repeatStart] = expectedFrames[index];
    await page.evaluate((time) => { window.__ytPlayers[0].currentTime = time; }, end);
    await page.waitForFunction((length) => window.__ytPlayers[0].seekCalls.length === length, index + 2);
    assert.deepEqual(await page.evaluate(() => window.__ytPlayers[0].seekCalls[index + 1]), repeatStart);
    assert.equal(await page.evaluate(() => window.__ytPlayers[0].pauseCalls), 0);
    assert.equal(await page.evaluate(() => window.__ytPlayers[0].playCalls), 1);

    // The second pass reaches the frame end, then continues into the next
    // first pass without any pause, play, or seek command.
    await page.evaluate((time) => { window.__ytPlayers[0].currentTime = time; }, end);
    if (index < expectedFrames.length - 1) {
      await page.waitForFunction((nextId) => document.querySelector("#phonics-youtube-status").textContent.includes(nextId), expectedFrames[index + 1][0]);
      assert.deepEqual(await page.evaluate(() => window.__ytPlayers[0].seekCalls), [60.14, ...expectedFrames.slice(0, index + 1).map(([, , , value]) => value)]);
    }
    assert.equal(start <= end, true, `${id} has an ordered frame`);
  }

  await page.waitForFunction(() => !document.querySelector("#phonics-youtube-end").classList.contains("is-pending"));
  assert.equal(await completionButton.isVisible(), true);
  assert.equal(await completionButton.isDisabled(), false);
  assert.equal(await completionButton.textContent(), "動画を見たよ");
  assert.match(await page.locator("#phonics-youtube-status").textContent(), /パート2（G〜K）が終わりました/);

  await completionButton.click();
  await page.locator("#mode-select-screen.active").waitFor();
  await page.waitForFunction(() => window.__ytPlayers.length === 2);
  assert.deepEqual(pageErrors, []);
});

test("phonics YouTube PoC is explicitly playback-only", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(app, /videoId: "ChqnN3cKzXQ"/);
  assert.match(app, /lessonId: "phonics-part-2-g-k"/);
  assert.match(app, /firstFrameSeconds: 4\.59/);
  assert.match(app, /followingFrameSeconds: 5\.05/);
  assert.match(app, /jumpStartOffsetSeconds: 0\.39/);
  assert.match(app, /\["G", "G", "H", "H", "I", "I", "J", "J", "K", "K"\]/);
  assert.match(app, /host: "https:\/\/www\.youtube-nocookie\.com"/);
  assert.match(app, /playsinline: 1/);
  assert.match(app, /controls: 0/);
  assert.match(app, /player\.seekTo\?\.\(frame\.jumpStart, true\)/);
  assert.match(app, /onAutoplayBlocked/);
  assert.match(app, /\$\("mode-select-phonics"\)\.disabled = true/);
  assert.match(app, /\$\("mode-select-phonics"\)\.disabled = false/);
  assert.match(app, /autoplay; encrypted-media; picture-in-picture/);
  assert.match(app, /function leavePhonicsYoutube\(\)[\s\S]*preparePhonicsYoutubePlayback\(\)/);
  assert.match(app, /pausePhonicsYoutubeForLifecycle/);
  assert.match(app, /id:"phonics", label:"フォニックス", detail:"パート2　G〜K", energyDisabled:true/);
  assert.match(app, /parent-energy-unavailable/);
  assert.match(app, /energy\.className = "mode-select-energy energy-disabled"/);
  assert.match(html, /data-mode="phonics"/);
  assert.match(html, /<b>フォニックス<\/b><small>パート2　G〜K<\/small>/);
  assert.match(html, /id="mode-select-phonics"[\s\S]*mode-select-remaining[\s\S]*mode-select-energy/);
  assert.doesNotMatch(html, /ためしてみる/);
  assert.match(html, /class="quit-button" id="phonics-youtube-back"[^>]*>やめる<\/button>/);
  assert.match(html, /class="phonics-youtube-end is-pending"[^>]*>動画を見たよ<\/button>/);
  assert.doesNotMatch(html, /phonics-youtube-header/);
  assert.match(css, /\.phonics-youtube-stage[\s\S]*width:min\(810px,calc\(100vw - 28px\)\)[\s\S]*position:relative/);
  assert.match(css, /\.phonics-youtube-background[\s\S]*width:100%;[\s\S]*height:100%;[\s\S]*object-fit:cover/);
  assert.match(css, /\.phonics-youtube-player-frame \{ width:100%; aspect-ratio:16 \/ 9; margin:0 auto; background:#000; \}/);
  assert.match(css, /\.phonics-youtube-player-frame > div, \.phonics-youtube-player-frame iframe \{ width:100%; height:100%; border:0; \}/);
  assert.match(html, /class="quit-button phonics-youtube-quit"/);
  assert.doesNotMatch(html, /id="phonics-youtube-stage"/);
  assert.doesNotMatch(css, /\.phonics-youtube-screen \.quit-button/);
  assert.match(app, /energy\.classList\.toggle\("disabled", Boolean\(mode\.energyDisabled\)\)/);
  assert.match(css, /\.phonics-youtube-status \{ display:none; \}/);
  assert.match(css, /\.phonics-youtube-end\.is-pending/);
  assert.match(css, /\.parent-energy-unavailable/);
  assert.match(css, /\.mode-select-energy\.energy-disabled/);
  const pocSection = app.slice(app.indexOf("const phonicsYoutube ="), app.indexOf("let collectionScaleRequest"));
  assert.doesNotMatch(pocSection, /setVolume\?\.\(40\)/);
  assert.doesNotMatch(pocSection, /profileStore|setReward|scaledEnergyGain|completeDailyMission/);
});
