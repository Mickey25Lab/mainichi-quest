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
      primary.textContent = word.toLowerCase();
      const secondary = document.createElement("span");
      secondary.className = "phonics-words-secondary";
      secondary.textContent = word;
      wordPair.append(primary, secondary);
      wrap.append(wordPair);
    } else {
    Array.from(word).forEach((character, index) => {
      const tile = document.createElement("span");
      tile.className = "phonics-words-letter" + (!session.wholeWord && !combined && index === session.step ? " is-selected" : "");
      tile.textContent = character;
      wrap.append(tile);
    });
    }
    get("phonics-words-progress-count").textContent = (session.index + 1) + " / " + session.words.length;
    if (!retainMeaning) {
      get("phonics-words-picture").hidden = true;
      get("phonics-words-picture").replaceChildren();
    }
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
    try { await icon.decode(); } catch (_) {}
    if (!session || session.words[session.index] !== current || !session.heard || playbackSerial !== serial) return;
    const region = get("phonics-words-picture");
    const meaning = document.createElement("div");
    meaning.className = "phonics-words-meaning";
    meaning.innerHTML = current.meaning;
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
    get("phonics-words-picture").hidden = true;
    get("phonics-words-picture").replaceChildren();
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
      utterance.pitch = 1;
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
    if (!session) return;
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
    if (!session || !session.wholeWord || !session.heard) return;
    const current = session.words[session.index];
    // In the new mode a replay repeats the same three-utterance sequence.
    speakThreeTimes(current, { retainMeaning: true });
  }
  function start({onComplete,onQuit,mode="phonics-words"}) {
    clearPictureTimer();
    stopAudio();
    const wholeWord = mode === "dolch-basic";
    const words = wholeWord ? shuffle(basicVocabulary).slice(0,10) : vocabulary.flatMap(shuffle);
    session = { words, index:0, step:wholeWord ? words[0].word.length : 0, wholeWord, heard:false,onComplete,onQuit };
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
    .phonics-words-letter{display:flex;align-items:center;justify-content:center;width:112px;height:160px;box-sizing:border-box;border-radius:18px;font:900 106px/1 "Noto Sans JP",sans-serif;color:#132b50}
    .phonics-words-letter.is-selected,#phonics-words-letters.is-combined{background:#adf0ff}
    #phonics-words-letters.is-combined .phonics-words-letter{border-radius:0}
    #phonics-words-picture{position:absolute;right:35px;top:170px;bottom:145px;width:250px;display:flex;align-items:center;justify-content:center}
    #phonics-words-picture[hidden]{display:none!important}
    .phonics-words-pictogram{display:block;width:100%;max-height:100%;object-fit:contain}
    #phonics-words-action{bottom:34px;z-index:7}
    #phonics-words-screen .phonics-words-stage:has(.is-whole-word) #phonics-words-action{bottom:34px}
    #phonics-words-replay{position:absolute;right:110px;bottom:34px;z-index:7;box-sizing:border-box;width:280px;height:var(--play-corner-control-height);padding:0;border:3px solid #8cb9d5;border-radius:var(--play-corner-radius);color:#23547b;background:#dbf1ff;box-shadow:0 6px 0 #8baec5,0 12px 22px rgba(3,52,109,.12);font:900 28px/1 "Noto Sans JP",sans-serif;white-space:nowrap;cursor:pointer}
    #phonics-words-replay:active{transform:translateY(3px);box-shadow:0 3px 0 #8baec5,0 7px 14px rgba(3,52,109,.12)}
    #phonics-words-replay:disabled,#phonics-words-action:disabled{opacity:.7;cursor:default}
    #phonics-words-letters.is-whole-word{background:transparent!important}
    .phonics-words-word-pair{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-width:450px}
    .phonics-words-primary{font:900 128px/1.1 "Noto Sans JP",sans-serif;color:#132b50;letter-spacing:3px}
    .phonics-words-secondary{font:800 55px/1.1 "Noto Sans JP",sans-serif;color:#60758f;letter-spacing:3px}
    #phonics-words-replay[hidden]{display:none!important}
    #phonics-words-picture:has(.phonics-words-meaning){flex-direction:column;gap:22px}
    .phonics-words-meaning{font-size:36px;font-weight:800;color:#132b50;text-align:center;line-height:1.6;white-space:nowrap}
    .phonics-words-meaning rt{font-size:17px;font-weight:600}
    #phonics-words-letters.is-combined.is-whole-word{background:transparent}
    #phonics-words-letters.is-combined.is-whole-word .phonics-words-letter{background:transparent}
    
    #phonics-words-back{z-index:7}
  `;
  document.head.append(css);
  const screen = document.createElement("section");
  screen.id = "phonics-words-screen";
  screen.className = "screen phonics-intro-screen phonics-words-screen";
  screen.setAttribute("aria-label", "フォニックスでよめることば");
  screen.innerHTML = `<div class="phonics-words-stage">
    <img id="phonics-words-background" class="phonics-words-background" alt="">
    <div class="phonics-intro-card"><div class="phonics-words-main"><div id="phonics-words-letters"></div></div><div id="phonics-words-picture" hidden></div></div>
    <button id="phonics-words-back" class="quit-button" type="button">やめる</button>
    <header class="topbar"><div class="progress-badge" id="phonics-words-progress" aria-live="polite"><span id="phonics-words-progress-count">1 / 5</span></div></header>
    <button id="phonics-words-action" class="phonics-youtube-end" type="button">つぎへ</button>
    <button id="phonics-words-replay" type="button" hidden>もういちどきく</button>
  </div>`;
  get("app").append(screen);
  get("phonics-words-action").addEventListener("click", next);
  get("phonics-words-back").addEventListener("click",quit);
  get("phonics-words-replay").addEventListener("click",replay);
  window.MQPhonicsWords = Object.freeze({start,quit});
})();