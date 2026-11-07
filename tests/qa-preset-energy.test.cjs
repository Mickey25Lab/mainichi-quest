const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.resolve(__dirname, "../dist/app.js"), "utf8");
const start = app.indexOf("function seedPreviewQaProgressPreset()");
const end = app.indexOf("function loadRecentVehicles()", start);
const preset = app.slice(start, end);

test("QA default progression uses revised stage thresholds", () => {
  assert.ok(start >= 0 && end > start, "QA preset function exists");
  assert.match(preset, /stage: 4, energy: 79, masterMedal: false/);
  assert.match(preset, /stage: 5, energy: 179, masterMedal: false/);
  assert.match(preset, /stage: 5, energy: 100, masterMedal: true/);
  assert.match(app, /2: 30, 3: 50, 4: 100, 5: 200, 6: 500/);
});

test("QA preset only applies once and preserves backup/restore semantics", () => {
  assert.match(preset, /if \(!qaProgressModeEnabled\(\)\) return null/);
  assert.match(preset, /if \(!qaState\.backupInitialized\)/);
  assert.match(preset, /qaState\.progressBackup = profileStore\.getProgressSnapshot\(\)/);
  assert.match(preset, /if \(qaState\.presetApplied\) return null/);
  assert.match(preset, /qaState\.presetApplied = true/);
});
