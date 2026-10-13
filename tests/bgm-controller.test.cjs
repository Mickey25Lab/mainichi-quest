const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "dist/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "dist/styles.css"), "utf8");

test("screen groups select the intended BGM through one controller", () => {
  const mappings = [
    ['"start-screen": "heroic"'],
    ['"mode-select-screen": "heroic"'],
    ['"result-screen": "heroic"'],
    ['"play-screen": "game"'],
    ['"collection-screen": "collection"'],
    ['"collection-detail-screen": "collection"']
  ];
  mappings.flat().forEach((mapping) => assert.match(app, new RegExp(mapping.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
  const showScreen = app.slice(app.indexOf("function showScreen"), app.indexOf("function showRewardOverPlay"));
  assert.match(showScreen, /setDesiredBgmGroup\(bgmConfig\.screenGroups\[id\]/);
  assert.doesNotMatch(showScreen, /\.play\(|\.pause\(/);
});

test("same-group transitions keep the active source and track changes crossfade it", () => {
  const starter = app.slice(app.indexOf("function startDecodedBackgroundMusic"), app.indexOf("function updateBgmToggleButton"));
  const transition = app.slice(app.indexOf("function transitionBackgroundMusic"), app.indexOf("function setBackgroundMusicDucked"));
  const selector = app.slice(app.indexOf("function setDesiredBgmGroup"), app.indexOf("function syncBackgroundMusicForActiveScreen"));
  assert.match(starter, /state\.bgmSource && state\.bgmGroup === group\) return/);
  assert.match(app, /transitionDurationSeconds: 0\.5/);
  assert.match(starter, /setValueAtTime\(0\.0001/);
  assert.match(starter, /linearRampToValueAtTime\(backgroundMusicVolume\(group\)/);
  assert.match(transition, /linearRampToValueAtTime\(0\.0001/);
  assert.match(transition, /bgmConfig\.transitionDurationSeconds \* 1000/);
  assert.match(selector, /state\.bgmGroup !== normalized\) \{ transitionBackgroundMusic\(normalized\); return; \}/);
  assert.doesNotMatch(selector, /stopBackgroundMusic/);
  assert.match(app, /source\.loop = true/);
});

test("one saved preference drives both speaker buttons", () => {
  assert.match(app, /storageKey: "warizan-robot:bgm-enabled-v1"/);
  assert.equal((html.match(/data-bgm-toggle/g) || []).length, 2);
  assert.match(app, /querySelectorAll\("\[data-bgm-toggle\]"\)/);
  assert.match(app, /localStorage\.setItem\(bgmConfig\.storageKey/);
});

test("startup audio unlock retries on user gestures instead of reusing a blocked resume", () => {
  const resume = app.slice(app.indexOf("function resumeAudioContext"), app.indexOf("function suspendAudioForBackground"));
  const context = app.slice(app.indexOf("function audioContext"), app.indexOf("function loadBgmEnabledPreference"));
  assert.doesNotMatch(resume, /if \(audioResumePromise\) return/);
  assert.doesNotMatch(context, /resumeAudioContext\(\)/);
  assert.match(app, /window\.addEventListener\("pointerdown", \(\) => primeBackgroundMusicFromGesture\(\), \{ capture: true, passive: true \}\)/);
  assert.match(app, /window\.addEventListener\("touchstart", \(\) => primeBackgroundMusicFromGesture\(\), \{ capture: true, passive: true \}\)/);
  assert.doesNotMatch(app, /primeBackgroundMusicFromGesture\(\).*once: true/);
});

test("top speaker is scoped and developer credit is removed", () => {
  assert.match(html, /id="top-bgm-toggle-button"/);
  assert.match(css, /\.start-screen \.top-bgm-toggle-button/);
  assert.doesNotMatch(html, /開発者: Papa, Chuppy and Minato/);
  assert.doesNotMatch(css, /(^|\n)button\s*\{/);
});

test("all configured BGM assets exist", () => {
  ["bgm_pynchon.mp3", "heroic_loop.wav", "collection_sci_fi_loop.mp3"].forEach((name) => {
    const file = path.join(root, "dist/assets/audio", name);
    assert.equal(fs.existsSync(file), true, `${name} is missing`);
    assert.ok(fs.statSync(file).size > 0, `${name} is empty`);
  });
});
