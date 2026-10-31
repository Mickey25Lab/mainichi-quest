// 家庭内MVP：フォニックスでよんでみよう。保存データはこのモジュールでは変更しない。
(() => {
  "use strict";
  const vocabulary = [
    [{word:"CAT",picture:"🐱",label:"ねこ"},{word:"DOG",picture:"🐶",label:"いぬ"},{word:"SUN",picture:"☀️",label:"たいよう"},{word:"BOX",picture:"📦",label:"はこ"},{word:"LEG",picture:"🦵",label:"あし"}],
    [{word:"HAND",picture:"✋",label:"て"},{word:"MILK",picture:"🥛",label:"ぎゅうにゅう"},{word:"WIND",picture:"🌬️",label:"かぜ"},{word:"FROG",picture:"🐸",label:"かえる"}],
    [{word:"PLANT",picture:"🪴",label:"しょくぶつ"}]
  ];
  const shuffle = items => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i],copy[j]] = [copy[j],copy[i]];
    }
    return copy;
  };
  let session = null, pictureTimer = 0, speechTimer = 0;
  const get = id => document.getElementById(id);
  function clearPictureTimer() {
    if (pictureTimer) clearTimeout(pictureTimer);
    pictureTimer = 0;
  }
  function stopAudio() {
    if (speechTimer) clearTimeout(speechTimer);
    speechTimer = 0;
    try { window.speechSynthesis?.cancel(); } catch (_) {}
  }
  function render() {
    if (!session) return;
    const current = session.words[session.index], word = current.word;
    const combined = session.step >= word.length;
    const wrap = get("phonics-words-letters");
    wrap.classList.toggle("is-combined", combined);
    wrap.replaceChildren();
    Array.from(word).forEach((character, index) => {
      const tile = document.createElement("span");
      tile.className = "phonics-words-letter" + (!combined && index === session.step ? " is-selected" : "");
      tile.textContent = character;
      wrap.append(tile);
    });
    get("phonics-words-progress-count").textContent = (session.index + 1) + " / 10";
    get("phonics-words-picture").hidden = true;
    get("phonics-words-picture").replaceChildren();
    get("phonics-words-action").textContent = session.heard ? "いえたよ" : session.step >= word.length - 1 ? "きいてみる" : "つぎへ";
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
    if (session.step < wordLength - 1) {
      session.step++;
      render();
      return;
    }
    if (!session.heard) {
      session.heard = true;
      session.step = wordLength;
      render();
      get("phonics-words-action").textContent = "いえたよ";
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
      }, 500);
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
    session.step = 0;
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
  function start({onComplete,onQuit}) {
    clearPictureTimer();
    stopAudio();
    session = { words:vocabulary.flatMap(shuffle), index:0, step:0, heard:false,onComplete,onQuit };
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
    <header class="topbar"><div class="progress-badge" id="phonics-words-progress" aria-live="polite"><span id="phonics-words-progress-count">1 / 10</span></div></header>
    <button id="phonics-words-action" class="phonics-youtube-end" type="button">つぎへ</button>
  </div>`;
  get("app").append(screen);
  get("phonics-words-action").addEventListener("click", next);
  get("phonics-words-back").addEventListener("click",quit);
  window.MQPhonicsWords = Object.freeze({start,quit});
})();