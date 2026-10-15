const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "dist/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "dist/styles.css"), "utf8");

function loadTwoDigitQuestionGenerator() {
  const match = app.match(/function makeTwoDigitMultiplicationQuestions\(\) \{[\s\S]*?\n  \}\n\n  function setGameMode/);
  assert.ok(match, "two-digit multiplication generator must be present");
  const source = match[0].replace(/\n\n  function setGameMode$/, "");
  return vm.runInNewContext(`(${source})`, { Math, Set });
}

test("guided 2x2 questions never use a repeated tens/ones multiplier digit", () => {
  const makeQuestions = loadTwoDigitQuestionGenerator();
  for (let run = 0; run < 40; run += 1) {
    const questions = makeQuestions();
    assert.equal(questions.length, 5);
    assert.equal(new Set(questions.map((question) => `${question.multiplicand}*${question.multiplier}`)).size, 5);
    questions.forEach((question) => {
      assert.notEqual(Math.floor(question.multiplier / 10), question.multiplier % 10);
    });
  }
});

test("the cyan operand guide is a rounded connected background in the 2x2 panel", () => {
  assert.match(html, /id="multiplication-2x2-operation-guide"/);
  assert.match(html, /id="multiplication-2x2-sum-operator"/);
  assert.match(app, /guideStage: 1/);
  assert.match(app, /operationGuide\.dataset\.stage = model\.guideStage === 1 \? "ones" : "tens"/);
  assert.match(app, /model\.guideStage = 2/);
  assert.match(app, /model\.sumOperatorVisible = true/);
  assert.match(css, /\.multiplication-2x2-operation-guide/);
  assert.match(css, /data-stage="ones"/);
  assert.match(css, /data-stage="tens"/);
  assert.match(css, /--operation-guide-radius:14px/);
  assert.doesNotMatch(css, /is-operation-guide/);
  assert.match(css, /\.multiplication-2x2-sum-operator/);
});

test("the obsolete upper gray multiplication cross is not rendered", () => {
  assert.doesNotMatch(app, /is-crossed/);
  assert.doesNotMatch(css, /is-crossed/);
  assert.match(css, /\.multiplication-2x2-shift-guide/);
});
