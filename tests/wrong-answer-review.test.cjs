const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
