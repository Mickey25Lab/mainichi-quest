const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../dist/app.js"), "utf8");

test("failed BGM fetch/decode clears the cached promise for future retries", () => {
  const start = app.indexOf("function ensureBackgroundMusic(");
  const end = app.indexOf("function ensureBgmGain(", start);
  assert.ok(start >= 0 && end > start);
  const implementation = app.slice(start, end);
  assert.match(implementation, /if \(state\.bgmBufferPromises\[group\]\) return state\.bgmBufferPromises\[group\]/);
  assert.match(implementation, /\.catch\(\(error\) => \{\s*\/\/[^\n]*\n[^\n]*\n\s*state\.bgmBufferPromises\[group\] = null/);
  assert.match(implementation, /console\.error\(`BGM failed to load:/);
  assert.match(implementation, /return null/);
});

test("top and mode selection share heroic BGM, game remains separate", () => {
  assert.match(app, /"start-screen": "heroic"/);
  assert.match(app, /"mode-select-screen": "heroic"/);
  assert.match(app, /"play-screen": "game"/);
  assert.match(app, /const appVersion = "0\.2\.30"/);
});
