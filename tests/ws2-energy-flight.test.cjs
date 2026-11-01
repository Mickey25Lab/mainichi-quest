const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("dist/app.js","utf8");
const css = fs.readFileSync("dist/styles.css","utf8");

test("WS2 PR6 uses actual reward qualification and never credits pink on animation arrival", () => {
  assert.match(app, /if \(timeBonus && roundTransaction\) \{ roundTransaction\.timeEnergyAmount \+= timeBonus\.amount; pinkGain = timeBonus\.amount; \}/);
  assert.match(app, /if \(progression\.pinkGain\) playEnergyOrbFlight\("pink"\)/);
  const flight = app.slice(app.indexOf("function playEnergyOrbFlight("), app.indexOf("function ensureTimeEnergyHourglass("));
  assert.doesNotMatch(flight, /creditTimeEnergy|commitTimeEnergy|applyEnergyGain|saveCollectionProgress/);
});

test("WS2 PR6 blue and pink flights have separate destinations and support reduced motion", () => {
  assert.match(app, /kind === "pink" \? ensureTimeEnergyHourglass\(\) : \$\("answer-character"\)/);
  assert.match(app, /playEnergyOrbFlight\("blue"/);
  assert.match(css, /\.ws2-energy-orb--pink/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("WS2 PR6 does not block next question on flight completion", () => {
  const flight = app.slice(app.indexOf("function playEnergyOrbFlight("), app.indexOf("function ensureTimeEnergyHourglass("));
  assert.doesNotMatch(flight, /await |finishInitialQuestion\(|advance\(/);
  assert.match(flight, /runId !== state\.runId/);
});
