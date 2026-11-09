const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync(require("node:path").join(__dirname, "../dist/app.js"), "utf8");

test("idle BGM cutoff uses the same five-minute duration as question timeout", () => {
  assert.match(source, /const questionTimeoutMs = 5 \* 60 \* 1000;/);
  assert.match(source, /const idleBgmTimeoutMs = 5 \* 60 \* 1000;/);
});
test("question timeout silences before returning to start screen", () => {
  const section = source.split("function handleQuestionTimeout() {")[1].split("function endToStart(")[0];
  assert.ok(section.indexOf("silenceBackgroundMusicForIdle()") < section.indexOf('showFixedScreenWhenReady("start-screen")'));
});
test("only top and mode-select inactivity is eligible", () => {
  assert.match(source, /id === "start-screen" \|\| id === "mode-select-screen"/);
  assert.match(source, /window\.setInterval\(checkIdleBgmTimeout, 1000\)/);
});
test("idle suppression is checked at audio start and cleared by gesture", () => {
  assert.match(source, /idleBgmSilenced \|\| activeBgmGroup\(\) !== group/);
  assert.match(source, /document\.addEventListener\("pointerdown", \(\) => \{\s*recordIdleBgmInteraction\(\)/);
  assert.match(source, /if \(state\.bgmEnabled && isIdleBgmScreen\(\)\) primeBackgroundMusicFromGesture/);
});
