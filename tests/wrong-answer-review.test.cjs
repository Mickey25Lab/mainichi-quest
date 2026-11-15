const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const app = fs.readFileSync(path.join(__dirname, "../dist/app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../dist/styles.css"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../dist/index.html"), "utf8");

test("incorrect arithmetic stays visible for 10 seconds and can be skipped", () => {
  assert.match(app, /const wrongAnswerReviewDurationMs = 10000;/);
  assert.match(app, /startWrongAnswerReview\(next\);/);
  assert.match(app, /window\.setTimeout\(\(\) => \{ renderCountdown\(\); finish\(\); \}, wrongAnswerReviewDurationMs\)/);
  assert.match(app, /wrong-answer-next"\)\.addEventListener\("click", \(\) => wrongAnswerReview\?\.finish\?\.\(\)\)/);
  assert.match(app, /wrongFeedbackDurationMs\);/);
  assert.match(app, /wrong-mark-hidden/);
  assert.match(html, /id="wrong-answer-countdown"/);
  assert.match(html, /id="wrong-answer-next"[^>]*>つぎへ<\/button>/);
});

test("review controls preserve fixed canvas alignment and corrections are not clipped", () => {
  assert.match(css, /left:741px; \/\* same left edge as the keypad \*\//);
  assert.match(css, /width:var\(--play-corner-control-width\)/);
  assert.match(css, /height:var\(--play-corner-control-height\)/);
  assert.match(css, /question-answer-card\.wrong \{ z-index:20; \}/);
  assert.match(app, /addMultiplicationCorrectionOverlay\(slot, row\.value\[i\]\)/);
  assert.match(app, /if \(state\.multiplication2x2\.specialZero && rowIndex > 0\) return;/);
  assert.match(app, /inlineCorrection\.getBoundingClientRect\(\)/);
  assert.match(app, /inlineCorrection\.remove\(\)/);
  assert.match(css, /keypad\[aria-busy="true"\] \.wrong-answer-next:not\(\[hidden\]\)/);
  assert.match(css, /pointer-events:auto;/);
});

test("zero-ones multiplier never generates ×10", () => {
  assert.match(app, /const ones = \(index === 0 \|\| index === 3\) \? 0 : 1 \+ Math\.floor\(Math\.random\(\) \* 9\);/);
  assert.match(app, /const tens = ones === 0 \? 2 \+ Math\.floor\(Math\.random\(\) \* 4\) : 1 \+ Math\.floor\(Math\.random\(\) \* 9\);/);
});

test("vehicle transition notice appears during correction review, not after next tap", () => {
  assert.match(app, /review\.markTimeout = window\.setTimeout\([\s\S]*?incorrect-next-vehicle-notice"\)\.hidden = false;[\s\S]*?prepareIncorrectNextVehicleDuringReview\(\);/);
  assert.match(app, /function prepareIncorrectNextVehicleDuringReview\(\)/);
  assert.match(app, /pendingIncorrectNextVehicleVisuals = \{ runId, ready \};/);
  assert.match(app, /if \(preloaded\) \{\s*preloaded\.ready\.then\(\(\) => \{/);
  assert.match(app, /runAnswerTransition\(advance\)/);
});

test("guided addition sign is bold and has no jewel glow", () => {
  const first = css.indexOf(".multiplication-2x2-sum-operator {");
  assert.ok(first >= 0);
  const rule = css.slice(first, css.indexOf("}", first));
  assert.ok(rule.includes("font-size:0;"));
  assert.ok(rule.includes("color:#48d9ff;"));
  assert.ok(css.includes(".multiplication-2x2-sum-operator::before { width:48px; height:9px; }"));
  assert.ok(css.includes(".multiplication-2x2-sum-operator::after { width:9px; height:48px; }"));
  assert.ok(rule.includes("text-shadow:none;"));
  assert.ok(rule.includes("filter:none;"));
});

test("addition-error bubble chooses rightmost matching column, never covers digits", () => {
  const start = app.indexOf("  function findMultiplicationInsteadOfAdditionIndex(model) {");
  const end = app.indexOf("  function showMultiplicationAdditionHint(model) {", start);
  assert.ok(start >= 0 && end > start);
  const findIndex = vm.runInNewContext("(" + app.slice(start, end).trim() + ")");
  const model = (upper, lower, expected, entered, specialZero = false) => ({
    specialZero,
    rows: [
      {cells: upper.split(""), value: upper},
      {cells: lower.split(""), value: lower},
      {cells: entered.split(""), value: expected}
    ]
  });
  // The tens column has 2+4=6, but the child entered 2×4=8.
  assert.equal(findIndex(model("24", "34", "364", "384")), 1);
  // Both tens and hundreds columns look multiplied: show only the rightmost.
  assert.equal(findIndex(model("222", "44", "662", "882")), 1);
  assert.equal(findIndex(model("24", "34", "364", "364")), -1);
  assert.equal(findIndex(model("24", "34", "364", "374")), -1);
  assert.equal(findIndex(model("24", "34", "364", "384", true)), -1);
  assert.ok(app.includes('bubble.textContent = "かけざんしちゃってない？";'));
  assert.ok(app.includes("const width = (keypadRect.width / scale) * 0.8;"));
  assert.ok(app.includes("const top = (slotRect.bottom - stageRect.top) / scale + 130;"));
  assert.ok(css.includes(".play-screen .multiplication-addition-hint::before"));
  assert.ok(css.includes(".play-screen .multiplication-addition-hint {"));
});
