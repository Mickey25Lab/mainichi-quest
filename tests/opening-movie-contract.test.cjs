const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.resolve(__dirname, "../dist/app.js"), "utf8");

test("opening movie reads only the latest three history records in chronological order", () => {
  assert.match(app, /getAcquisitionHistory\(\)\.slice\(-3\)\.map\(openingMovieEntryForHistory\)/);
});

test("opening movie maps all acquisition types to existing artwork helpers and copy", () => {
  [
    ["vehicle_discovered", "vehicleArtworkPath"], ["friendship_complete", "vehicleArtworkPath"],
    ["robot", "robotArtworkPath"], ["super_robot", "superRobotArtworkPath"],
    ["super_robot_equipped", "equippedSuperRobotArtworkPath"], ["master_medal", "masterMedalArtworkPath"]
  ].forEach(([type, artwork]) => assert.match(app, new RegExp(`${type}: \\{ message: .*${artwork}`)));
});

test("opening movie starts only from the top-button path and cleans up its timer", () => {
  const start = app.slice(app.indexOf("function startOpeningMovieForActiveProfile"), app.indexOf("function showRewardOverPlay"));
  assert.match(start, /getOpeningMovieLastPlayedJst\(\) === japanDateKey\(\)/);
  assert.match(start, /setOpeningMovieLastPlayedJst\(japanDateKey\(\)\)/);
  assert.match(app, /function stopOpeningMoviePlayback\([\s\S]*clearTimeout/);
  assert.match(app, /\$\("opening-movie-skip"\)\.addEventListener\("click", finishOpeningMovie\)/);
  assert.match(app, /\$\("start-button"\)\.addEventListener\("click", openModeSelectOrPlayOpeningMovie\)/);
  const initialize = app.slice(app.indexOf("function initializeGameForActiveProfile"), app.indexOf("function beginProfileExperience"));
  assert.doesNotMatch(initialize, /startOpeningMovieForActiveProfile/);
});

test("opening movie BGM uses the configured 90-second cue with one shared fade-out", () => {
  assert.match(app, /filePath: "\.\/assets\/audio\/opening-movie-bgm\.mp3"/);
  assert.match(app, /startOffsetSec: 90/);
  assert.match(app, /fadeDurationMs: 500/);
  assert.match(app, /source\.start\(0, openingMovieBgmConfig\.startOffsetSec\)/);
  assert.match(app, /function finishOpeningMovie\(\)[\s\S]*stopOpeningMovieBgm\(\{ fade: true/);
  assert.match(app, /function stopOpeningMoviePlayback\(\{ stopBgm = true \} = \{\}\)/);
});
