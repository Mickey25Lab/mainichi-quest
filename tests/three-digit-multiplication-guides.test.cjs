const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "dist/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "dist/styles.css"), "utf8");

test("guided 3x2 uses five unique questions and the guided 2x2 digit restrictions", () => {
  const extracted = app.match(/function makeThreeDigitGuidedMultiplicationQuestions\(\) \{[\s\S]*?\n  \}\n\n  function setGameMode/);
  assert.ok(extracted);
  const generator = vm.runInNewContext("(" + extracted[0].replace(/\n\n  function setGameMode$/, "") + ")", { Math, Set });
  for (let run = 0; run < 100; run++) {
    const questions = generator();
    assert.equal(questions.length, 5);
    assert.equal(new Set(questions.map(q => q.id)).size, 5);
    for (const q of questions) {
      assert.equal(String(q.multiplicand).length, 3);
      assert.match(String(q.multiplicand), /^[1-5][0-5][0-5]$/);
      assert.match(String(q.multiplier), /^[1-5][1-5]$/);
      assert.notEqual(Math.floor(q.multiplier / 10), q.multiplier % 10);
      assert.equal(q.partial1, q.multiplicand * (q.multiplier % 10));
      assert.equal(q.partial2, q.multiplicand * Math.floor(q.multiplier / 10));
      assert.equal(q.product, q.multiplicand * q.multiplier);
    }
  }
});

test("guided 3x2 is wired into the shared worksheet and parent mode settings", () => {
  assert.match(app, /state\.mode === "multiplication3x2" \? makeThreeDigitGuidedMultiplicationQuestions\(\)/);
  assert.match(app, /modeId === "multiplication3x2"/);
  assert.match(app, /startThreeDigitGuidedMultiplicationApp/);
  assert.match(html, /id="mode-select-multiplication-3x2"/);
  assert.match(css, /\.multiplication-2x2-panel\.is-three-digit/);
  assert.match(css, /grid-template-columns:repeat\(5, var\(--multiplication-2x2-column\)\)/);
  assert.match(css, /\.multiplication-2x2-operation-guide\[data-stage="tens"\]::before/);
});
