const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const app = fs.readFileSync(path.join(__dirname, "../dist/app.js"), "utf8");
const section = app.slice(app.indexOf("  const viewportNormalLogLimit ="), app.indexOf("  function recordViewportDiagnostic("));

function compact(entries) {
  const context = { viewportDiagnostics: entries };
  vm.runInNewContext(section + "\ncompactViewportDiagnostics();", context);
  return context.viewportDiagnostics;
}
function entry(offsetMs, event = "geometry-baseline") {
  return { ts: new Date(Date.UTC(2026, 10, 15) + offsetMs).toISOString(), event,
    snapshot: { innerWidth: 1024, innerHeight: 748, screenOrientationType: "landscape-primary" } };
}

test("the only diagnostic actions are LOG and SS, and SS records a manual timestamp", () => {
  const setup = app.slice(app.indexOf("function setupViewportDiagnostics()"), app.indexOf("async function updateVersionLabelWithPreviewMetadata()"));
  assert.match(setup, /button\.textContent = "LOG"/);
  assert.match(setup, /ssButton\.textContent = "SS"/);
  assert.match(setup, /recordViewportDiagnostic\("screenshot-marker", \{ source: "manual-ss-button" \}\)/);
  assert.match(setup, /viewportSsWindowAfterMs\)/);
  assert.match(setup, /recordViewportDiagnostic\("screenshot-window-end"\)/);
  assert.doesNotMatch(setup, /MQ-001 LOG|全ログコピー|通常コピー/);
});

test("LOG copies immediately within the click gesture, without delayed clipboard access", () => {
  const setup = app.slice(app.indexOf("function setupViewportDiagnostics()"), app.indexOf("async function updateVersionLabelWithPreviewMetadata()"));
  const click = setup.slice(setup.indexOf('button.addEventListener("click"'), setup.indexOf('document.body.appendChild(button)'));
  assert.match(click, /navigator\.clipboard\.writeText\(text\)/);
  assert.doesNotMatch(click, /await new Promise|setTimeout\(resolve|waitMs/);
});

test("regular log is capped at sixty and SS windows preserve surrounding events", () => {
  const entries = Array.from({length: 160}, (_, i) => entry(i * 1000));
  entries[60] = entry(60000, "screenshot-marker");
  entries[65] = entry(65000, "window.resize");
  const result = compact(entries);
  assert.ok(result.length <= 150);
  assert.ok(result.some((item) => item.event === "screenshot-marker"));
  assert.ok(result.some((item) => item.event === "window.resize"));
  assert.ok(result.some((item) => item.ts === entry(35000).ts));
  assert.ok(result.some((item) => item.ts === entry(70000).ts));
  assert.ok(result.some((item) => item.ts === entry(159000).ts));
});

test("repeated baseline activity cannot grow the stored log unbounded", () => {
  const entries = Array.from({length: 1000}, (_, i) => entry(i * 1000));
  const result = compact(entries);
  assert.equal(result.length, 60);
  assert.equal(result[0].ts, entry(940000).ts);
  assert.equal(result.at(-1).ts, entry(999000).ts);
});

test("no changes to PWA recovery, viewport meta or profile data in diagnostic section", () => {
  const chunk = app.slice(app.indexOf("const viewportNormalLogLimit"), app.indexOf("async function updateVersionLabelWithPreviewMetadata()"));
  assert.doesNotMatch(chunk, /location\.reload|meta\.setAttribute|profileStore|beginRound\(/);
});
