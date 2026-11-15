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
      this.classList = { toggle() {}, add() {} };
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
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, "window.__fontTestLetter = wordLetter;})();"), { document, window, SpeechSynthesisUtterance: window.SpeechSynthesisUtterance });
  return {
    get: id => document.getElementById(id),
    start: args => window.MQPhonicsWords.start(args),
    spoken,
    fontLetter: window.__fontTestLetter,
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
  const lowercase = pair.children[0].children.map(c => c.textContent).join("");
  const uppercase = pair.children[1].children.map(c => c.textContent).join("");
  assert.equal(lowercase.toUpperCase(), uppercase);
  assert.ok(pair.children[0].children.every(c => c.className.includes("phonics-words-glyph")));
  assert.equal(h.get("phonics-words-picture").hidden, true);
  h.get("phonics-words-action").click();
  assert.equal(h.spoken[0].pitch, 1.2);
});

test("Part 1 uses 13 distinct nouns, never MEN, while still asking 10 questions", () => {
  const begin = source.indexOf("const basicVocabulary = [");
  const end = source.indexOf("];", begin);
  assert.ok(begin >= 0 && end > begin, "basic word list exists");
  const words = [...source.slice(begin, end).matchAll(/\{word:"([A-Z]+)"/g)].map(m => m[1]);
  assert.equal(words.length, 13);
  assert.equal(new Set(words).size, 13);
  assert.ok(words.includes("MAN"));
  assert.ok(!words.includes("MEN"));
  const h = harness();
  for (let run = 0; run < 25; run++) {
    h.start({ mode:"dolch-basic", onComplete() {}, onQuit() {} });
    assert.equal(h.get("phonics-words-progress-count").textContent, "1 / 10");
    const displayed = h.get("phonics-words-letters").children[0].children[1].children.map(c => c.textContent).join("");
    assert.notEqual(displayed, "MEN");
  }
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
  assert.equal(h.spoken[1].pitch, 1.2, "all repetitions keep fixed pitch");
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
  assert.match(source, /#phonics-words-screen #phonics-words-replay:disabled,#phonics-words-screen #phonics-words-action:disabled\{opacity:\.52;filter:saturate\(\.45\)/);
  assert.match(source, /fonts\?\.load\('800 36px/);
  assert.match(source, /fonts\?\.load\('600 17px/);
});

test("all English word TTS uses fixed pitch 1.2 and has no selector", () => {
  const dolch = harness();
  dolch.start({ mode:"dolch-basic", onComplete() {}, onQuit() {} });
  dolch.get("phonics-words-action").click();
  assert.equal(dolch.spoken[0].pitch, 1.2);
  const intro = harness();
  intro.start({ mode:"phonics-words", onComplete() {}, onQuit() {} });
  const letters = intro.get("phonics-words-letters").children.length;
  for (let i=0; i<letters; ++i) intro.get("phonics-words-action").click();
  assert.equal(intro.spoken.length, 1, "original five-word mode still queues its silent primer");
  assert.match(source, /utterance\.pitch = 1\.2;/);
  assert.match(source, /voice\.pitch = 1\.2;/);
  assert.doesNotMatch(source, /phonics-words-pitch-control|pitchOptions|changePitch/);
});

test("all 52 alphabet letters use Andika except uppercase Q and lowercase t/y in Jost", () => {
  const h = harness();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const exceptions = new Set(["Q", "t", "y"]);
  let jost = 0, andika = 0;
  for (const letter of letters) {
    const actual = h.fontLetter(letter, "phonics-words-glyph");
    if (exceptions.has(letter)) {
      assert.match(actual.className, /is-jost$/, letter);
      jost++;
    } else {
      assert.doesNotMatch(actual.className, /is-jost/, letter);
      andika++;
    }
  }
  assert.equal(jost, 3);
  assert.equal(andika, 49);
  assert.match(source, /family=Andika:wght@700&family=Jost:wght@700/);
  assert.match(source, /\.phonics-words-letter\.is-jost,\.phonics-words-glyph\.is-jost\{font-family:"Jost"/);
});

test("legacy phonics letters and Dolch small-uppercase/large-lowercase use shared font mapping", () => {
  const intro = harness();
  intro.start({ mode:"phonics-words", onComplete() {}, onQuit() {} });
  const introLetters = intro.get("phonics-words-letters").children;
  assert.ok(introLetters.every(x => x.className.startsWith("phonics-words-letter")));
  const dolch = harness();
  dolch.start({ mode:"dolch-basic", onComplete() {}, onQuit() {} });
  const [primary, secondary] = dolch.get("phonics-words-letters").children[0].children;
  assert.ok([...primary.children,...secondary.children].every(x => x.className.startsWith("phonics-words-glyph")));
});

test("TOP uses summit meaning with ruby only on 上 and mountain-flag illustration", () => {
  const topLine = source.split("\n").find(line => line.includes('{word:"TOP"'));
  assert.ok(topLine, "TOP remains in Part 1");
  assert.match(topLine, /label:"てっぺん いちばん上"/);
  assert.ok(topLine.includes('meaning:"てっぺん<br>いちばん<ruby>上<rt>うえ</rt></ruby>"'));
  assert.doesNotMatch(topLine, /こま/);
  const svg = fs.readFileSync(path.resolve(__dirname, "../dist/assets/ui/phonics-words/top.svg"), "utf8");
  assert.match(svg, /<svg[\s>]/);
  assert.match(svg, /<title[^>]*>山のてっぺん<\/title>/);
  assert.match(svg, /山の頂上に赤い旗/);
  assert.match(svg, /<path[^>]*fill="#e56d4a"/);
  assert.doesNotMatch(svg, /<circle\b/, "sun and orange summit marker should both be removed");
});

test("mode selection and parent settings share the same definitions, with no duplicate 14-word label", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../dist/index.html"), "utf8");
  const app = fs.readFileSync(path.resolve(__dirname, "../dist/app.js"), "utf8");
  assert.match(app, /id:"dolch-basic", label:"えいごのことばをよもう", detail:"パート１　きほんの名詞　13 words"/);
  assert.match(app, /const modeById = new Map\(parentModeDefinitions\.map\(mode => \[mode\.id, mode\]\)\)/);
  assert.match(app, /detail\.textContent = definition\.detail/);
  assert.match(app, /title\.textContent = definition\.label/);
  const choiceNames = [...html.matchAll(/<span class="mode-select-name">([^<]*)<\/span>/g)];
  assert.equal(choiceNames.length, 18, "every child mode title should be sourced from parentModeDefinitions");
  assert.ok(choiceNames.every(m => m[1] === ""), "no hardcoded child mode title is permitted");
  assert.doesNotMatch(html, /14 words/);
});
