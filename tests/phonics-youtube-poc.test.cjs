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
  await page.locator("#mode-select-phonics-part-2").click();
  await page.locator("#phonics-intro-screen.active").waitFor();
  const introStart = page.locator("#phonics-intro-start");
  assert.equal(await introStart.isDisabled(), true);
  assert.match(await page.locator("#phonics-intro-line").textContent(), /G、H、I、J、Kを発音するよ/);
  await page.waitForTimeout(3100);
  await page.waitForFunction(() => !document.querySelector("#phonics-intro-start").disabled);
  await introStart.click();
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

  const remainingBefore = await page.locator("#mode-select-phonics-part-2 .mode-select-remaining-number").textContent();
  await completionButton.click();
  await page.locator("#mode-select-screen.active").waitFor();
  await page.waitForFunction(() => window.__ytPlayers.length === 2);
  const remainingAfter = await page.locator("#mode-select-phonics-part-2 .mode-select-remaining").textContent();
  assert.equal(Number(remainingBefore), 1);
  assert.match(remainingAfter, /できた！/);
  assert.deepEqual(pageErrors, []);
});

test("all five phonics parts use the shared playback-only timing model", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(app, /const appVersion = "0\.3\.3"/);
  assert.match(app, /videoId: "ChqnN3cKzXQ"/);
  assert.match(app, /a1FrameSeconds: 4\.59/);
  assert.match(app, /followingFrameSeconds: 5\.05/);
  assert.match(app, /jumpStartOffsetSeconds: 0\.39/);
  assert.match(app, /id:"part-1"[\s\S]*letters:"A〜F"/);
  assert.match(app, /id:"part-2"[\s\S]*letters:"G〜K"/);
  assert.match(app, /id:"part-3"[\s\S]*letters:"L〜P"/);
  assert.match(app, /id:"part-4"[\s\S]*letters:"Q〜U"/);
  assert.match(app, /id:"part-5"[\s\S]*letters:"V〜Z"/);
  assert.match(app, /sourceStart:-0\.4, start:0, jumpEnd:4\.84, jumpStart:0, end:4\.84/);
  assert.match(app, /host: "https:\/\/www\.youtube-nocookie\.com"/);
  assert.match(app, /playsinline: 1/);
  assert.match(app, /controls: 0/);
  assert.match(app, /player\.seekTo\?\.\(frame\.jumpStart, true\)/);
  assert.match(app, /onAutoplayBlocked/);
  assert.match(app, /\[data-phonics-lesson\]/);
  assert.match(app, /autoplay; encrypted-media; picture-in-picture/);
  assert.match(app, /function leavePhonicsYoutube\(\)[\s\S]*preparePhonicsYoutubePlayback\(\)/);
  assert.match(app, /pausePhonicsYoutubeForLifecycle/);
  assert.match(app, /parent-energy-unavailable/);
  assert.match(app, /energy\.className = "mode-select-energy energy-disabled"/);
  assert.match(html, /data-mode="phonics-part-1"[\s\S]*パート1　A〜F/);
  assert.match(html, /data-mode="phonics-part-2"[\s\S]*パート2　G〜K/);
  assert.match(html, /data-mode="phonics-part-3"[\s\S]*パート3　L〜P/);
  assert.match(html, /data-mode="phonics-part-4"[\s\S]*パート4　Q〜U/);
  assert.match(html, /data-mode="phonics-part-5"[\s\S]*パート5　V〜Z/);
  assert.match(html, /id="mode-select-phonics-part-2"[\s\S]*mode-select-remaining[\s\S]*mode-select-energy/);
  assert.match(html, /id="phonics-intro-screen"/);
  assert.match(html, /3分の<ruby>動画<rt>どうが<\/rt><\/ruby>を見ながら、<\/span><br>[\s\S]*いっしょに<ruby>声<rt>こえ<\/rt><\/ruby>に出そう/);
  assert.match(html, /id="phonics-intro-letters"/);
  assert.match(app, /function renderPhonicsIntroLetters\(\)[\s\S]*phonics-intro-letter[\s\S]*phonics-intro-comma/);
  assert.match(css, /\.phonics-intro-letters \{[\s\S]*font:1000 58px/);
  assert.match(css, /\.phonics-intro-gesture \{[\s\S]*margin:54px 0 0;[\s\S]*white-space:nowrap/);
  assert.doesNotMatch(html, />説明を読んでね</);
  assert.doesNotMatch(app, /status\.textContent = "説明を読んでね"/);
  assert.match(html, /<ruby>手<rt>て<\/rt><\/ruby>と<ruby>口<rt>くち<\/rt><\/ruby>のうごきも、まねしてみよう！/);
  assert.match(html, /phonics_intro_gesture_child\.webp/);
  assert.match(html, /id="phonics-intro-start"[^>]*>やってみる！<\/button>/);
  assert.match(app, /showPhonicsIntro\(button\.dataset\.phonicsLesson, button\.dataset\.mode\)/);
  assert.match(app, /introMinimumElapsed = true[\s\S]*updatePhonicsIntroReadyState\(\)/);
  assert.match(app, /function startPhonicsFromIntroGesture\(\)[\s\S]*beginPhonicsYoutubePlayback\(\)/);
  assert.match(app, /playBackgroundPath\(Math\.floor\(Math\.random\(\) \* vehicles\.length\)\)/);
  assert.match(app, /function normalizedMissionTarget\(settings, modeId\) \{[\s\S]*return parentModeSetting\(settings, modeId\)\.target;[\s\S]*\}/);
  assert.match(app, /const legacyPhonicsSetting = modeId\.startsWith\("phonics-part-"\)[\s\S]*const settingsKey = legacyPhonicsSetting \? "phonics" : modeId/);
  assert.match(app, /id:"phonics-part-1", label:"フォニックス", detail:"パート1　A〜F", energyDisabled:true/);
  assert.match(app, /id:"phonics-part-5", label:"フォニックス", detail:"パート5　V〜Z", energyDisabled:true/);
  assert.doesNotMatch(html, /ためしてみる/);
  assert.match(html, /class="quit-button" id="phonics-youtube-back"[^>]*>やめる<\/button>/);
  assert.match(html, /class="phonics-youtube-end is-pending"[^>]*>動画を見たよ<\/button>/);
  assert.doesNotMatch(html, /phonics-youtube-header/);
  assert.match(css, /\.phonics-youtube-stage[\s\S]*width:1448px;[\s\S]*height:1086px;[\s\S]*scale\(var\(--stage-scale,1\)\)/);
  assert.match(css, /\.phonics-youtube-stage[\s\S]*width:1448px;[\s\S]*height:1086px;[\s\S]*scale\(var\(--stage-scale,1\)\)/);
  assert.match(css, /\.phonics-youtube-background[\s\S]*width:100%;[\s\S]*height:100%;[\s\S]*object-fit:contain/);
  assert.match(css, /\.phonics-youtube-player-frame[\s\S]*width:1160px;[\s\S]*overflow:hidden;[\s\S]*transform:translate\(-50%,-50%\)/);
  assert.match(html, /class="phonics-youtube-player-scale"[\s\S]*id="phonics-youtube-player"/);
  assert.match(css, /\.phonics-youtube-player-frame[\s\S]*width:1160px;[\s\S]*height:652\.5px;[\s\S]*overflow:hidden/);
  assert.match(css, /\.phonics-youtube-player-scale \{[\s\S]*width:1450px;[\s\S]*height:815\.625px;[\s\S]*transform:scale\(\.8\);[\s\S]*transform-origin:top left/);
  assert.match(css, /\.phonics-youtube-player-scale > div,[\s\S]*iframe[\s\S]*width:100%;[\s\S]*height:100%;/);
  assert.match(css, /\.play-screen \.progress-badge,[\s\S]*\.play-screen \.quit-button,[\s\S]*\.phonics-youtube-screen \.quit-button[\s\S]*width:166px/);
  assert.match(css, /\.phonics-youtube-end \{[\s\S]*width:360px;[\s\S]*height:var\(--play-corner-control-height\);[\s\S]*border-radius:var\(--play-corner-radius\);[\s\S]*font-size:34px/);
  assert.match(css, /\.play-screen \.quit-button,[\s\S]*\.phonics-youtube-screen \.quit-button/);
  assert.match(app, /energy\.classList\.toggle\("disabled", Boolean\(mode\.energyDisabled\)\)/);
  assert.match(css, /\.phonics-youtube-status \{ display:none; \}/);
  assert.match(css, /\.phonics-youtube-end\.is-pending/);
  assert.match(css, /\.parent-energy-unavailable/);
  assert.match(css, /\.mode-select-energy\.energy-disabled/);
  const pocSection = app.slice(app.indexOf("const phonicsYoutube ="), app.indexOf("let collectionScaleRequest"));
  const prepareSection = app.slice(app.indexOf("function preparePhonicsYoutubePlayback"), app.indexOf("function beginPhonicsYoutubePlayback"));
  assert.doesNotMatch(prepareSection, /data-phonics-lesson/);
  assert.doesNotMatch(pocSection, /setVolume\?\.\(40\)/);
  assert.doesNotMatch(pocSection, /setReward|scaledEnergyGain/);
  assert.match(pocSection, /activeModeId: null/);
  assert.match(pocSection, /phonicsYoutube\.activeModeId = modeId/);
  assert.match(pocSection, /function completePhonicsYoutubeAndLeave\(\)[\s\S]*completeDailyMissionRound\(phonicsYoutube\.activeModeId\)[\s\S]*leavePhonicsYoutube\(\)/);
  assert.match(app, /phonics-youtube-end"\)\.addEventListener\("click", completePhonicsYoutubeAndLeave\)/);
});
