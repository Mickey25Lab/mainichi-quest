// 家庭内MVP：フォニックスでよめることば。保存データはこのモジュールでは変更しない。
(() => {
  "use strict";
  const vocabulary = [
    [{word:"CAT",picture:"🐱",label:"ねこ"},{word:"DOG",picture:"🐶",label:"いぬ"},{word:"BED",picture:"🛏️",label:"ベッド"},{word:"BOX",picture:"📦",label:"はこ"},{word:"LEG",picture:"🦵",label:"あし"}],
    [{word:"HAND",picture:"✋",label:"て"},{word:"MILK",picture:"🥛",label:"ぎゅうにゅう"},{word:"WIND",picture:"🌬️",label:"かぜ"}],
    [{word:"PLANT",picture:"🪴",label:"しょくぶつ"},{word:"PICNIC",picture:"🧺",label:"ピクニック"}]
  ];
  const shuffle = items => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i],copy[j]] = [copy[j],copy[i]];
    }
    return copy;
  };
  let session = null, pictureTimer = 0;
  const get = id => document.getElementById(id);
  function clearPictureTimer() {
    if (pictureTimer) clearTimeout(pictureTimer);
    pictureTimer = 0;
  }
  function stopAudio() {
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
    get("phonics-words-progress").textContent = (session.index + 1) + " / 10";
    get("phonics-words-picture").hidden = true;
    get("phonics-words-picture").replaceChildren();
    get("phonics-words-action").textContent = !combined ? "つぎへ" : session.heard ? "いえたよ" : "きいてみる";
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
  function speakWord(word) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") return;
    stopAudio();
    const voice = new SpeechSynthesisUtterance(word.toLowerCase());
    voice.lang = "en-US";
    voice.rate = .85;
    voice.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const us = voices.find(v => v.lang.toLowerCase().replace("_","-") === "en-us");
    if (us) voice.voice = us;
    window.speechSynthesis.speak(voice);
  }
  function next() {
    if (!session) return;
    const current = session.words[session.index];
    const wordLength = current.word.length;
    if (session.step < wordLength) {
      session.step++;
      render();
      return;
    }
    if (!session.heard) {
      session.heard = true;
      get("phonics-words-action").textContent = "いえたよ";
      pictureAfterOneSecond(current);
      speakWord(current.word);
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
    #phonics-words-screen{position:absolute;inset:0;background:linear-gradient(160deg,#dff7ff,#f9fdff);z-index:2;overflow:hidden}
    #phonics-words-screen:not(.active){display:none!important}
    .phonics-words-layout{position:absolute;inset:0;display:flex;align-items:center;flex-direction:column;gap:2vh;padding:2.5vh 3vw;box-sizing:border-box;color:#10204c;font-family:system-ui,-apple-system,sans-serif}
    .phonics-words-header{display:flex;width:100%;align-items:center;justify-content:space-between;gap:1vw}
    .phonics-words-title{font-size:clamp(17px,3vw,36px);font-weight:800;text-align:center}
    .phonics-words-back{border:1px solid #a6cadb;background:white;border-radius:18px;padding:12px 20px;font-size:clamp(14px,2vw,23px);font-weight:700;color:#10204c}
    #phonics-words-progress{font-size:clamp(15px,2.6vw,27px);font-weight:800;min-width:3em;text-align:right}
    .phonics-words-board{flex:1;min-height:0;width:100%;background:white;border-radius:30px;display:flex;align-items:center;justify-content:center;position:relative}
    .phonics-words-main{width:68%;display:flex;justify-content:center;align-items:center;min-width:0}
    #phonics-words-letters{display:inline-flex;align-items:stretch;gap:clamp(3px,.5vw,10px);max-width:100%;border-radius:18px}
    .phonics-words-letter{display:flex;justify-content:center;align-items:center;width:clamp(37px,8vw,110px);height:clamp(80px,18vh,160px);font-size:clamp(35px,7vw,96px);font-weight:850;border-radius:16px;background:transparent;color:#122453;box-sizing:border-box}
    .phonics-words-letter.is-selected{background:#adf0ff}
    #phonics-words-letters.is-combined{background:#adf0ff}
    #phonics-words-letters.is-combined .phonics-words-letter{border-radius:0}
    #phonics-words-picture{width:29%;display:flex;align-items:center;justify-content:center;flex-direction:column;position:absolute;right:1.5%;top:10%;bottom:10%}
    #phonics-words-picture[hidden]{display:none!important}
    .phonics-words-pictogram{display:block;width:min(100%,190px);height:auto;max-height:75%;object-fit:contain}
    #phonics-words-action{font-weight:800;font-size:clamp(22px,3vw,33px);color:white;background:#2588ef;border:3px solid #1e69bf;border-radius:22px;width:min(60vw,410px);height:clamp(76px,14vh,105px);flex-shrink:0;touch-action:manipulation}
    @media(max-width:700px){.phonics-words-letter{width:clamp(35px,8.2vw,68px)}.phonics-words-main{width:75%;justify-content:flex-start;padding-left:1vw}.phonics-words-pictogram{max-width:100px}}
  `;
  document.head.append(css);
  const screen = document.createElement("section");
  screen.id = "phonics-words-screen";
  screen.className = "screen";
  screen.setAttribute("aria-label", "フォニックスでよめることば");
  screen.innerHTML = `<div class="phonics-words-layout">
    <div class="phonics-words-header"><button id="phonics-words-back" class="phonics-words-back" type="button">もどる</button><div class="phonics-words-title">フォニックスでよめることば</div><span id="phonics-words-progress"></span></div>
    <div class="phonics-words-board"><div class="phonics-words-main"><div id="phonics-words-letters"></div></div><div id="phonics-words-picture" hidden></div></div>
    <button id="phonics-words-action" type="button">つぎへ</button></div>`;
  get("app").append(screen);
  get("phonics-words-action").addEventListener("click", next);
  get("phonics-words-back").addEventListener("click",quit);
  window.MQPhonicsWords = Object.freeze({start,quit});
})();