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
  const match = app.match(/function makeTwoDigitMultiplicationQuestions\(unguided = false, zeroMode = false\) \{[\s\S]*?\r?\n  \}\r?\n\r?\n  function setGameMode/);
  assert.ok(match, "two-digit multiplication generator must be present");
  const source = match[0].replace(/\r?\n\r?\n  function setGameMode$/, "");
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

function assertGeneratedQuestionSet(questions, { maxDigit }) {
  assert.equal(questions.length, 5);
  assert.equal(new Set(questions.map((question) => `${question.multiplicand}*${question.multiplier}`)).size, 5);
  questions.forEach((question) => {
    const multiplierTens = Math.floor(question.multiplier / 10);
    const multiplierOnes = question.multiplier % 10;
    assert.ok(question.multiplicand >= 10 && question.multiplicand <= maxDigit * 10 + maxDigit);
    assert.ok(multiplierTens >= 1 && multiplierTens <= maxDigit);
    assert.ok(multiplierOnes >= 1 && multiplierOnes <= maxDigit);
    assert.notEqual(multiplierTens, multiplierOnes);
    assert.equal(question.partial1, question.multiplicand * multiplierOnes);
    assert.equal(question.partial2, question.multiplicand * multiplierTens);
    assert.equal(question.product, question.multiplicand * question.multiplier);
  });
}

test("guided and unguided 2x2 question sets keep their own ranges and calculation steps", () => {
  const makeQuestions = loadTwoDigitQuestionGenerator();
  for (let run = 0; run < 40; run += 1) {
    assertGeneratedQuestionSet(makeQuestions(), { maxDigit: 5 });
    assertGeneratedQuestionSet(makeQuestions(true), { maxDigit: 6 });
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

test("zero mode places a zero in lower multiplier only in questions 2 and 4", () => {
  const makeQuestions = loadTwoDigitQuestionGenerator();
  for (let run = 0; run < 100; run += 1) {
    const questions = makeQuestions(false, true);
    assert.equal(questions.length, 5);
    assert.equal(new Set(questions.map((question) => question.id)).size, 5);
    questions.forEach((question, index) => {
      assert.ok(question.multiplicand >= 10 && question.multiplicand <= 99);
      assert.ok(question.multiplier >= 10 && question.multiplier <= 99);
      assert.equal(question.multiplier % 10 === 0, index === 0 || index === 3);
      assert.equal(question.partial1, question.multiplicand * (question.multiplier % 10));
      assert.equal(question.partial2, question.multiplicand * Math.floor(question.multiplier / 10));
      assert.equal(question.product, question.multiplicand * question.multiplier);
    });
  }
});
test("zero mode has a separate label and immediate correction for zero-only step", () => {
  assert.match(html, /2けた×2けた その3（2段目に0あり）/);
  assert.match(app, /state\.mode === "multiplication2x2-zero"/);
  assert.match(app, /String\(number\) !== "0"/);
  assert.match(app, /playTwoDigitRowCorrectEffect\(\{ holder: slot \}\)/);
  assert.match(app, /model\.specialZero && model\.inputStep > 0/);
});

test("zero multiplier uses a single row and grades the rest only after all digits are entered", () => {
  assert.match(app, /value: specialZero \? totalText : partial1Text/);
  assert.match(app, /specialZero \? \[totalText\.length - 1, \.\.\.twoDigitRowOrder\(question\.multiplicand, question\.partial2\)\]/);
  assert.match(app, /if \(specialZero && rowIndex > 0\) return/);
  assert.match(app, /if \(!model\.specialZero && step\.rowIndex/);
  assert.match(app, /model\.specialZero \? model\.rows\[0\]/);
  assert.match(app, /step\.cellIndex === row\.value\.length - 1 && String\(number\) !== "0"/);
  assert.match(css, /is-zero-single-row #multiplication-2x2-partial-2/);
  assert.match(css, /is-zero-single-row #multiplication-2x2-total/);
  assert.match(css, /is-zero-single-row \.multiplication-2x2-bar-sum/);
});

test("zero mode keeps the ordinary final multiplication left-to-right digit block", () => {
  const calculationInputOrder = (value, count) => {
    const n = String(value).length;
    const lower = Math.min(count, n - 1);
    return [...Array(lower)].map((_, i) => n - i - 1).concat([...Array(n - lower)].map((_, i) => i));
  };
  const order = [3, ...calculationInputOrder(245, 1)];
  assert.deepEqual(order, [3, 2, 0, 1]); // 49×50: initial 0, then 5, then 2→4 (45 is written 4 then 5, final 20 starts with 2)
});
