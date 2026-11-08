// 家庭内MVP：フォニックスでよんでみよう。保存データはこのモジュールでは変更しない。
(() => {
  "use strict";
  const vocabulary = [
    [{word:"CAT",picture:"🐱",label:"ねこ"},{word:"DOG",picture:"🐶",label:"いぬ"},{word:"SUN",picture:"☀️",label:"たいよう"},{word:"BOX",picture:"📦",label:"はこ"},{word:"PIG",picture:"🐷",label:"ぶた"}]
  ];
  // Part 1: Dolch basic A+B; each round samples 10 of the 14 nouns without repeats.
  // Ruby markup is static lesson data, never generated from user input.
  const basicVocabulary = [
    {word:"BED",label:"ベッド",meaning:"ベッド"},
    {word:"BOX",label:"箱",meaning:"<ruby>箱<rt>はこ</rt></ruby>"},
    {word:"CAT",label:"猫",meaning:"<ruby>猫<rt>ねこ</rt></ruby>"},
    {word:"DOG",label:"犬",meaning:"<ruby>犬<rt>いぬ</rt></ruby>"},
    {word:"LEG",label:"足",meaning:"<ruby>足<rt>あし</rt></ruby>"},
    {word:"MAN",label:"男の人",meaning:"<ruby>男<rt>おとこ</rt></ruby>の<ruby>人<rt>ひと</rt></ruby>"},
    {word:"MEN",label:"男の人たち",meaning:"<ruby>男<rt>おとこ</rt></ruby>の<ruby>人<rt>ひと</rt></ruby>たち"},
    {word:"PIG",label:"ブタ",meaning:"ブタ"},
    {word:"SUN",label:"太陽",meaning:"<ruby>太陽<rt>たいよう</rt></ruby>"},
    {word:"TOP",label:"こま",meaning:"こま"},
    {word:"HAND",label:"手",meaning:"<ruby>手<rt>て</rt></ruby>"},
    {word:"MILK",label:"牛乳",meaning:"<ruby>牛乳<rt>ぎゅうにゅう</rt></ruby>"},
    {word:"NEST",label:"鳥の巣",meaning:"<ruby>鳥<rt>とり</rt></ruby>の<ruby>巣<rt>す</rt></ruby>"},
    {word:"WIND",label:"風",meaning:"<ruby>風<rt>かぜ</rt></ruby>"}
  ];
  const shuffle = items => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i],copy[j]] = [copy[j],copy[i]];
    }
    return copy;
  };
  let session = null, pictureTimer = 0, speechTimer = 0, playbackSerial = 0;
  const get = id => document.getElementById(id);
  // Shared font map for both word-reading modes: 49 Andika glyphs + Q/t/y in Jost.
  function wordLetter(char, className) {
    const letter = document.createElement("span");
    letter.className = className + (char === "Q" || char === "t" || char === "y" ? " is-jost" : "");
    letter.textContent = char;
    return letter;
  }
  function appendSpelledWord(target, text, className) {
    target.replaceChildren(...Array.from(text, char => wordLetter(char, className)));
  }
  function clearPictureTimer() {
    if (pictureTimer) clearTimeout(pictureTimer);
    pictureTimer = 0;
  }
  function stopAudio() {
    playbackSerial++;
    if (speechTimer) clearTimeout(speechTimer);
    speechTimer = 0;
    try { window.speechSynthesis?.cancel(); } catch (_) {}
  }
  function render() {
    if (!session) return;
    const current = session.words[session.index], word = current.word;
    const combined = session.wholeWord || session.step >= word.length;
    const wrap = get("phonics-words-letters");
    wrap.classList.toggle("is-combined", combined);
    wrap.classList.toggle("is-whole-word", session.wholeWord);
    wrap.replaceChildren();
    if (session.wholeWord) {
      const wordPair = document.createElement("div");
      wordPair.className = "phonics-words-word-pair";
      const primary = document.createElement("span");
      primary.className = "phonics-words-primary";
      appendSpelledWord(primary, word.toLowerCase(), "phonics-words-glyph");
      const secondary = document.createElement("span");
      secondary.className = "phonics-words-secondary";
      appendSpelledWord(secondary, word, "phonics-words-glyph");
      wordPair.append(primary, secondary);
      wrap.append(wordPair);
    } else {
    Array.from(word).forEach((character, index) => {
      const tile = wordLetter(character, "phonics-words-letter");
      if (!combined && index === session.step) tile.classList.add("is-selected");
      wrap.append(tile);
    });
    }
    get("phonics-words-progress-count").textContent = (session.index + 1) + " / " + session.words.length;
    const pitchControl = get("phonics-words-pitch-control");
    pitchControl.hidden = !session.wholeWord;
    get("phonics-words-pitch").value = String(session.pitch);
    get("phonics-words-picture").hidden = true;
    get("phonics-words-picture").replaceChildren();
    get("phonics-words-replay").hidden = !session.wholeWord || !session.heard;
    get("phonics-words-replay").disabled = Boolean(session.playing);
    get("phonics-words-action").disabled = Boolean(session.playing);
    get("phonics-words-action").textContent = session.heard ? "いえたよ" : session.wholeWord || session.step >= word.length - 1 ? "きいてみる" : "つぎへ";
  }
  // Reveal the complete illustration + ruby as a single DOM update only after
  // the final spoken word and after the image has decoded.
  async function revealMeaning(current, serial) {
    const icon = document.createElement("img");
    icon.className = "phonics-words-pictogram";
    icon.alt = current.label;
    icon.decoding = "async";
    icon.src = "./assets/ui/phonics-words/" + current.word.toLowerCase() + ".svg";
    const meaning = document.createElement("div");
    meaning.className = "phonics-words-meaning";
    meaning.innerHTML = current.meaning;
    // Japanese glyphs/ruby can use different font subsets on iPad Safari.
    // Wait for both glyph sizes and the image before making the pair visible.
    const fonts = document.fonts;
    try {
      await Promise.all([
        icon.decode(),
        fonts?.load('800 36px "Noto Sans JP"', current.label) || Promise.resolve(),
        fonts?.load('600 17px "Noto Sans JP"', current.meaning.replace(/<[^>]*>/g, "")) || Promise.resolve()
      ]);
      if (fonts?.ready) await fonts.ready;
    } catch (_) { /* Use the available fallback font/image if loading fails. */ }
    if (!session || session.words[session.index] !== current || !session.heard || playbackSerial !== serial) return;
    const region = get("phonics-words-picture");
    region.replaceChildren(icon, meaning);
    region.hidden = false;
    session.playing = false;
    get("phonics-words-replay").disabled = false;
    get("phonics-words-action").disabled = false;
  }
  // Three distinct utterances, with a gap measured from each onend event.
  // The first speak() stays in the button's user-gesture handler for iPad.
  function speakThreeTimes(current, { retainMeaning = false } = {}) {
    stopAudio();
    const serial = playbackSerial;
    session.playing = true;
    get("phonics-words-action").disabled = true;
    get("phonics-words-replay").disabled = true;
    if (!retainMeaning) {
      get("phonics-words-picture").hidden = true;
      get("phonics-words-picture").replaceChildren();
    }
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") {
      // No false claim of completion if speech is unsupported.
      session.playing = false;
      get("phonics-words-replay").disabled = false;
      get("phonics-words-action").disabled = false;
      return;
    }
    let spoken = 0;
    const speakNext = () => {
      if (!session || session.words[session.index] !== current || playbackSerial !== serial) return;
      const utterance = new SpeechSynthesisUtterance(current.word.toLowerCase());
      utterance.lang = "en-US";
      utterance.rate = .85;
      utterance.pitch = session.pitch;
      utterance.volume = 1;
      const us = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().replace("_","-") === "en-us");
      if (us) utterance.voice = us;
      utterance.onend = () => {
        if (!session || session.words[session.index] !== current || playbackSerial !== serial) return;
        spoken++;
        if (spoken === 3) {
          if (retainMeaning) {
            session.playing = false;
            get("phonics-words-replay").disabled = false;
            get("phonics-words-action").disabled = false;
          } else void revealMeaning(current, serial);
          return;
        }
        speechTimer = window.setTimeout(() => {
          speechTimer = 0;
          speakNext();
        }, 800);
      };
      utterance.onerror = () => {
        if (!session || playbackSerial !== serial) return;
        session.playing = false;
        get("phonics-words-replay").disabled = false;
        get("phonics-words-action").disabled = false;
      };
      window.speechSynthesis.speak(utterance);
    };
    speakNext();
  }
  function pictureAfterOneSecond(current) {
    pictureTimer = window.setTimeout(() => {
      pictureTimer = 0;
      if (!session || session.words[session.index] !== current || !session.heard) return;
      const region = get("phonics-words-picture");
      const icon = document.createElement("img");
      icon.className = "phonics-words-pictogram";
      icon.alt = current.label;
      icon.decoding = "async";
      icon.src = "./assets/ui/phonics-words/" + current.word.toLowerCase() + ".svg";
      region.replaceChildren(icon);
      region.hidden = false;
    },1000);
  }
  function speakWord(word, current) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") return;
    const voice = new SpeechSynthesisUtterance(word.toLowerCase());
    voice.lang = "en-US";
    voice.rate = .85;
    voice.pitch = 1;
    voice.volume = 1; // Web Speech API maximum (cannot amplify above 100%).
    const voices = window.speechSynthesis.getVoices();
    const us = voices.find(v => v.lang.toLowerCase().replace("_","-") === "en-us");
    if (us) voice.voice = us;
    voice.onstart = () => {
      if (session && session.words[session.index] === current && session.heard) pictureAfterOneSecond(current);
    };
    window.speechSynthesis.speak(voice);
  }
  function next() {
    if (!session || session.playing) return;
    const current = session.words[session.index];
    const wordLength = current.word.length;
    if (!session.wholeWord && session.step < wordLength - 1) {
      session.step++;
      render();
      return;
    }
    if (!session.heard) {
      session.heard = true;
      session.step = wordLength;
      render();
      get("phonics-words-action").textContent = "いえたよ";
      if (session.wholeWord) {
        speakThreeTimes(current);
        return;
      }
      // iPad WebKit requires the first speech request in the tap handler.
      // A silent primer unlocks later delayed speech without speaking the word early.
      if (window.speechSynthesis && typeof window.SpeechSynthesisUtterance === "function") {
        try {
          const primer = new SpeechSynthesisUtterance("");
          primer.lang = "en-US";
          primer.volume = 0;
          window.speechSynthesis.speak(primer);
        } catch (_) {}
      }
      speechTimer = window.setTimeout(() => {
        speechTimer = 0;
        if (!session || session.words[session.index] !== current || !session.heard) return;
        speakWord(current.word, current);
      }, 100); // Start promptly; iPad speech synthesis may add its own startup latency.
      return;
    }
    clearPictureTimer();
    stopAudio();
    if (session.index + 1 === session.words.length) {
      const complete = session.onComplete;
      session = null;
      complete();
      return;
    }
    session.index++;
    session.step = session.wholeWord ? session.words[session.index].word.length : 0;
    session.heard = false;
    render();
  }
  function quit() {
    if (!session) return;
    const callback = session.onQuit;
    session = null;
    clearPictureTimer();
    stopAudio();
    callback();
  }
  function replay() {
    if (!session || session.playing || !session.wholeWord || !session.heard) return;
    const current = session.words[session.index];
    // In the new mode a replay repeats the same three-utterance sequence.
    speakThreeTimes(current, { retainMeaning: true });
  }
  const pitchOptions = [0.6,0.8,1.0,1.2,1.4,1.6,1.8,2.0];
  function changePitch() {
    if (!session || !session.wholeWord) return;
    const selected = Number(get("phonics-words-pitch").value);
    if (pitchOptions.includes(selected)) session.pitch = selected;
  }
  function start({onComplete,onQuit,mode="phonics-words"}) {
    clearPictureTimer();
    stopAudio();
    const wholeWord = mode === "dolch-basic";
    const words = wholeWord ? shuffle(basicVocabulary).slice(0,10) : vocabulary.flatMap(shuffle);
    session = { words, index:0, step:wholeWord ? words[0].word.length : 0, wholeWord, pitch:1.0, heard:false,onComplete,onQuit };
    render();
  }
  const css = document.createElement("style");
  css.textContent = `
    #phonics-words-screen{position:absolute;inset:0;z-index:2;overflow:hidden}
    #phonics-words-screen:not(.active){display:none!important}
    .phonics-words-stage{position:absolute;left:50%;top:50%;width:1400px;height:1050px;transform:translate(-50%,-50%) scale(var(--stage-scale,1));transform-origin:center;overflow:hidden;font-family:"Noto Sans JP",sans-serif}
    .phonics-words-background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.68)}
    .phonics-words-stage::after{content:"";position:absolute;inset:0;background:rgba(3,20,45,.18);pointer-events:none}
    .phonics-words-stage .phonics-intro-card{display:flex;align-items:center;justify-content:center;min-height:760px;height:760px;box-sizing:border-box}
    .phonics-words-main{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0}
    #phonics-words-letters{display:inline-flex;align-items:stretch;gap:8px;max-width:100%;border-radius:18px}
    .phonics-words-letter{display:flex;align-items:center;justify-content:center;width:112px;height:160px;box-sizing:border-box;border-radius:18px;font:700 106px/1 "Andika",sans-serif;color:#132b50}
    .phonics-words-letter.is-jost,.phonics-words-glyph.is-jost{font-family:"Jost",sans-serif}
    .phonics-words-letter.is-selected,#phonics-words-letters.is-combined{background:#adf0ff}
    #phonics-words-letters.is-combined .phonics-words-letter{border-radius:0}
    #phonics-words-picture{position:absolute;right:35px;top:170px;bottom:145px;width:250px;display:flex;align-items:center;justify-content:center}
    #phonics-words-picture[hidden]{display:none!important}
    .phonics-words-pictogram{display:block;width:100%;max-height:100%;object-fit:contain}
    #phonics-words-action{bottom:34px;z-index:7}
    #phonics-words-screen .phonics-words-stage:has(.is-whole-word) #phonics-words-action{bottom:34px}
    #phonics-words-replay{position:absolute;right:110px;bottom:34px;z-index:7;box-sizing:border-box;width:280px;height:var(--play-corner-control-height);padding:0;border:3px solid #8cb9d5;border-radius:var(--play-corner-radius);color:#23547b;background:#dbf1ff;box-shadow:0 6px 0 #8baec5,0 12px 22px rgba(3,52,109,.12);font:900 28px/1 "Noto Sans JP",sans-serif;white-space:nowrap;cursor:pointer}
    #phonics-words-replay:active:not(:disabled){transform:translateY(3px);box-shadow:0 3px 0 #8baec5,0 7px 14px rgba(3,52,109,.12)}
    #phonics-words-screen #phonics-words-action:active:disabled{transform:translateX(-50%);box-shadow:0 6px 0 #4f79a2,0 12px 22px rgba(3,52,109,.18)}
    #phonics-words-screen #phonics-words-replay:active:disabled{transform:none;box-shadow:0 6px 0 #8baec5,0 12px 22px rgba(3,52,109,.12)}
    #phonics-words-screen #phonics-words-replay:disabled,#phonics-words-screen #phonics-words-action:disabled{opacity:.52;filter:saturate(.45);cursor:default;pointer-events:none;-webkit-tap-highlight-color:transparent}
    #phonics-words-letters.is-whole-word{background:transparent!important}
    .phonics-words-word-pair{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-width:450px}
    .phonics-words-primary{font:700 128px/1.1 "Andika",sans-serif;color:#132b50;letter-spacing:3px;white-space:nowrap}
    .phonics-words-secondary{font:700 55px/1.1 "Andika",sans-serif;color:#60758f;letter-spacing:3px;white-space:nowrap}
    .phonics-words-glyph{display:inline-block;font-family:"Andika",sans-serif}
    #phonics-words-replay[hidden]{display:none!important}
    #phonics-words-picture:has(.phonics-words-meaning){flex-direction:column;gap:22px}
    .phonics-words-meaning{font-size:36px;font-weight:800;color:#132b50;text-align:center;line-height:1.6;white-space:nowrap}
    .phonics-words-meaning rt{font-size:17px;font-weight:600}
    #phonics-words-letters.is-combined.is-whole-word{background:transparent}
    #phonics-words-letters.is-combined.is-whole-word .phonics-words-letter{background:transparent}
    
    /* Dolch-only pitch experiment: separated from the shared top-left progress badge. */
    #phonics-words-pitch-control{position:absolute;right:42px;top:18px;z-index:9;display:flex;align-items:center;gap:12px;padding:9px 14px;border-radius:19px;background:rgba(255,255,255,.94);border:2px solid #a9c9dc;box-shadow:0 3px 10px rgba(3,52,109,.13);color:#254464;font:800 22px/1.3 "Noto Sans JP",sans-serif}
    #phonics-words-pitch-control[hidden]{display:none!important}
    #phonics-words-pitch{width:122px;min-height:48px;padding:4px 9px;border:2px solid #97bcd5;border-radius:12px;background:#fff;color:#123d67;font:800 25px/1.2 "Noto Sans JP",sans-serif;cursor:pointer}
    #phonics-words-pitch:focus-visible{outline:4px solid #559bd1;outline-offset:2px}
    #phonics-words-back{z-index:7}
  `;
  document.head.append(css);
  // Noto Sans JP remains the common UI/Japanese-label font; only alphabet glyphs use these.
  const alphabetFontStylesheet = document.createElement("link");
  alphabetFontStylesheet.rel = "stylesheet";
  alphabetFontStylesheet.href = "https://fonts.googleapis.com/css2?family=Andika:wght@700&family=Jost:wght@700&display=swap";
  document.head.append(alphabetFontStylesheet);
  const screen = document.createElement("section");
  screen.id = "phonics-words-screen";
  screen.className = "screen phonics-intro-screen phonics-words-screen";
  screen.setAttribute("aria-label", "フォニックスでよめることば");
  screen.innerHTML = `<div class="phonics-words-stage">
    <img id="phonics-words-background" class="phonics-words-background" alt="">
    <div class="phonics-intro-card"><div class="phonics-words-main"><div id="phonics-words-letters"></div></div><div id="phonics-words-picture" hidden></div></div>
    <button id="phonics-words-back" class="quit-button" type="button">やめる</button>
    <header class="topbar"><div class="progress-badge" id="phonics-words-progress" aria-live="polite"><span id="phonics-words-progress-count">1 / 5</span></div></header>
    <label id="phonics-words-pitch-control" hidden for="phonics-words-pitch"><span>声の高さ</span><select id="phonics-words-pitch" aria-label="声の高さをえらぶ"><option value="0.6">0.6</option><option value="0.8">0.8</option><option value="1">1.0</option><option value="1.2">1.2</option><option value="1.4">1.4</option><option value="1.6">1.6</option><option value="1.8">1.8</option><option value="2">2.0</option></select></label>
    <button id="phonics-words-action" class="phonics-youtube-end" type="button">つぎへ</button>
    <button id="phonics-words-replay" type="button" hidden>もういちどきく</button>
  </div>`;
  get("app").append(screen);
  get("phonics-words-action").addEventListener("click", next);
  get("phonics-words-back").addEventListener("click",quit);
  get("phonics-words-replay").addEventListener("click",replay);
  get("phonics-words-pitch").addEventListener("change",changePitch);
  window.MQPhonicsWords = Object.freeze({start,quit});
})();