const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../dist/scripts/phonics-words.js"), "utf8");

function harness() {
  const elements = new Map();
  const pendingTimers = new Map();
  let timerId = 0;
  const spoken = [];
  const fontLoads = [];
  const fontResolvers = [];
  class Element {
    constructor() {
      this.hidden = false;
      this.disabled = false;
      this.textContent = "";
      this.innerHTML = "";
      this.children = [];
      this.handlers = {};
      this.classList = { toggle() {} };
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = [...children]; }
    addEventListener(name, callback) { this.handlers[name] = callback; }
    setAttribute(name, value) { this[name] = value; }
    click() { this.handlers.click?.(); }
    decode() { return Promise.resolve(); }
  }
  const document = {
    fonts: {
      load(spec, text) {
        fontLoads.push({ spec, text });
        return new Promise(resolve => fontResolvers.push(resolve));
      },
      get ready() { return Promise.resolve(); }
    },
    head: { append() {} },
    createElement() { return new Element(); },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    }
  };
  const synthesizer = {
    speak(utterance) { spoken.push(utterance); },
    cancel() {},
    getVoices() { return []; }
  };
  const window = {
    speechSynthesis: synthesizer,
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    setTimeout(callback, delay) {
      const id = ++timerId;
      pendingTimers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { pendingTimers.delete(id); }
  };
  vm.runInNewContext(source, { document, window, SpeechSynthesisUtterance: window.SpeechSynthesisUtterance });
  return {
    get: id => document.getElementById(id),
    start: args => window.MQPhonicsWords.start(args),
    spoken,
    fontLoads,
    releaseFonts() { fontResolvers.splice(0).forEach(resolve => resolve([])); },
    runPause() {
      const [id, timer] = [...pendingTimers][0] || [];
      assert.ok(timer, "next utterance has a scheduled pause");
      assert.equal(timer.delay, 800);
      pendingTimers.delete(id);
      timer.callback();
    }
  };
}

test("Dolch mode initializes with 10 cards and the correct first action", () => {
  const h = harness();
  h.start({ mode:"dolch-basic", onComplete() {}, onQuit() {} });
  assert.equal(h.get("phonics-words-progress-count").textContent, "1 / 10");
  assert.equal(h.get("phonics-words-action").textContent, "きいてみる");
  assert.equal(h.get("phonics-words-letters").children.length, 1);
  const pair = h.get("phonics-words-letters").children[0];
  assert.equal(pair.children[0].textContent.toUpperCase(), pair.children[1].textContent);
  assert.equal(h.get("phonics-words-picture").hidden, true);
});

test("Dolch mode speaks exactly three times and keeps meaning visible on replay", async () => {
  const h = harness();
  h.start({ mode:"dolch-basic", onComplete() {}, onQuit() {} });
  h.get("phonics-words-action").click();
  assert.equal(h.spoken.length, 1, "first word starts synchronously with the tap");
  assert.equal(h.get("phonics-words-picture").hidden, true);
  h.spoken[0].onend();
  h.runPause();
  assert.equal(h.spoken.length, 2);
  h.spoken[1].onend();
  h.runPause();
  assert.equal(h.spoken.length, 3);
  assert.equal(h.get("phonics-words-picture").hidden, true);
  h.spoken[2].onend();
  await Promise.resolve();
  assert.equal(h.fontLoads.length, 2, "both main glyphs and ruby must preload");
  assert.equal(h.get("phonics-words-picture").hidden, true, "do not show Japanese before fonts finish");
  assert.equal(h.get("phonics-words-action").disabled, true);
  assert.equal(h.get("phonics-words-replay").disabled, true);
  // Neither button may advance or enqueue an utterance during TTS playback.
  h.get("phonics-words-action").click();
  h.get("phonics-words-replay").click();
  assert.equal(h.spoken.length, 3);
  h.releaseFonts();
  // The async font readiness + image decode chain crosses multiple microtask turns.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.get("phonics-words-picture").hidden, false);
  assert.equal(h.get("phonics-words-picture").children.length, 2);
  h.get("phonics-words-replay").click();
  assert.equal(h.spoken.length, 4);
  assert.equal(h.get("phonics-words-action").disabled, true);
  assert.equal(h.get("phonics-words-replay").disabled, true);
  h.get("phonics-words-action").click();
  h.get("phonics-words-replay").click();
  assert.equal(h.spoken.length, 4, "buttons must be inert during replay");
  assert.equal(h.get("phonics-words-picture").hidden, false, "replay must keep illustration and ruby visible");
  assert.equal(h.get("phonics-words-picture").children.length, 2);
  h.spoken[3].onend(); h.runPause();
  h.spoken[4].onend(); h.runPause();
  h.spoken[5].onend();
  assert.equal(h.get("phonics-words-picture").hidden, false);
  assert.equal(h.get("phonics-words-action").disabled, false);
  assert.equal(h.get("phonics-words-replay").disabled, false);
});

test("existing five-word mode still begins with per-letter next button", () => {
  const h = harness();
  h.start({ mode:"phonics-words", onComplete() {}, onQuit() {} });
  assert.equal(h.get("phonics-words-progress-count").textContent, "1 / 5");
  assert.equal(h.get("phonics-words-action").textContent, "つぎへ");
  assert.equal(h.get("phonics-words-replay").hidden, true);
});

test("disabled actions never animate, and Japanese ruby waits for font glyphs", () => {
  assert.match(source, /#phonics-words-replay:active:not\(:disabled\)/);
  assert.match(source, /#phonics-words-screen #phonics-words-action:active:disabled/);
  assert.match(source, /pointer-events:none;-webkit-tap-highlight-color:transparent/);
  assert.match(source, /fonts\?\.load\('800 36px/);
  assert.match(source, /fonts\?\.load\('600 17px/);
});
