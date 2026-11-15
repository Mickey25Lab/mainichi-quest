(() => {
"use strict";
const $=id=>document.getElementById(id);
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
let state=null, timer=0, stepTimer=0, speechDelay=0, speechToken=0;
function stopSpeech(){speechToken++;clearTimeout(speechDelay);speechDelay=0;try{window.speechSynthesis.cancel();}catch(_){}}
function stop(){stopSpeech();clearInterval(timer);clearTimeout(stepTimer);timer=stepTimer=0;}
function glyphs(word){const node=document.createElement("span");for(const ch of word){const span=document.createElement("span");span.className="dt-glyph"+(["Q","t","y"].includes(ch)?" dt-jost":"");span.textContent=ch;node.append(span);}return node;}
function clock(){if(!state)return;let t=Math.floor((Date.now()-state.started)/1000);$("dolch-test-time").textContent=(t>=60?Math.floor(t/60)+"分"+t%60+"秒":t+"秒");}
function render(){
 if(!state)return;
 const s=state,meaning=s.phase==="meaning",result=s.phase==="result",grid=$("dolch-test-board");
 $("dolch-test-progress").textContent=(result?13:s.index+1)+" / 13";
 $("dolch-test-word").hidden=!meaning;
 $("dolch-test-board").hidden=result;
 $("dolch-test-listen").hidden=meaning||result;
 $("dolch-test-listen").disabled=s.heard;
 $("dolch-test-replay").hidden=result;
 $("dolch-test-replay").disabled=s.speaking||(!meaning&&!s.heard)||s.locked;
 if(meaning){const focus=$("dolch-test-word");focus.replaceChildren();const up=glyphs(s.words[s.index].word),low=glyphs(s.words[s.index].word.toLowerCase());up.className="dt-focus-upper";low.className="dt-focus-lower";focus.append(up,low);}
 grid.replaceChildren();
 const deck=meaning?s.meaningOrder:s.spellingOrder;
 deck.forEach((item,i)=>{
  const b=document.createElement("button");b.type="button";b.className="dt-card"+(i===12?" dt-last":"")+(s.done.has(item.word)?" dt-used":"");
  b.dataset.word=item.word;
  b.disabled=s.locked||s.done.has(item.word)||(!meaning&&!s.heard);
  if(meaning){const label=document.createElement("span");label.className="dt-jp";label.innerHTML=item.meaning;const image=document.createElement("img");image.alt="";image.src="./assets/ui/phonics-words/"+item.word.toLowerCase()+".svg";b.append(label,image);}
  else{const lower=glyphs(item.word.toLowerCase()),upper=glyphs(item.word);lower.className="dt-lower";upper.className="dt-upper";b.append(lower,upper);}
  b.addEventListener("click",()=>choose(item.word));grid.append(b);
 });
}
function speakThree({first=false}={}){
 const s=state;if(!s||s.phase==="result"||s.locked||s.speaking||(!first&&s.phase==="spelling"&&!s.heard))return;
 if(first){if(s.heard||s.phase!=="spelling")return;s.heard=true;}
 s.speaking=true;render();
 if(!window.speechSynthesis||typeof SpeechSynthesisUtterance!=="function"){s.speaking=false;render();return;}
 stopSpeech();const token=speechToken,current=s.words[s.index];let count=0;
 const utter=()=>{
  if(state!==s||token!==speechToken||s.words[s.index]!==current)return;
  const u=new SpeechSynthesisUtterance(current.word.toLowerCase());u.lang="en-US";u.rate=.85;u.pitch=1.2;u.volume=1;
  const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().replace("_","-")==="en-us");if(voice)u.voice=voice;
  u.onend=()=>{if(state!==s||token!==speechToken)return;if(++count<3)speechDelay=setTimeout(utter,800);else{s.speaking=false;render();}};
  u.onerror=()=>{if(state!==s||token!==speechToken)return;s.speaking=false;render();};
  window.speechSynthesis.speak(u);
 };utter();
}
function listen(){speakThree({first:true});}
function replay(){speakThree();}
function beep(ok){
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  const ctx=beep.ctx||(beep.ctx=new C());
  const notes=ok?[[620,0,.12],[880,.07,.15]]:[[170,0,.4]];
  for(const [hz,delay,len] of notes){const o=ctx.createOscillator(),g=ctx.createGain();o.type=ok?"sine":"sawtooth";o.frequency.value=hz;
   g.gain.setValueAtTime(.0001,ctx.currentTime+delay);g.gain.exponentialRampToValueAtTime(.15,ctx.currentTime+delay+.015);
   g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+delay+len);o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+len+.02);
  }
 }catch(_){}
}
function readHistory(id){try{const v=JSON.parse(localStorage.getItem("mq.dolch-test.v1."+encodeURIComponent(id)));if(v&&v.version===1&&Array.isArray(v.runs))return v;}catch(_){}return{version:1,runs:[],words:{}};}
function persist(){
 const s=state,h=readHistory(s.profileId),run={at:new Date().toISOString(),english:s.score.spelling,meaning:s.score.meaning,seconds:Math.floor((Date.now()-s.started)/1000),mistakes:s.mistakes};
 h.runs.push(run);for(const word of s.words){const k=word.word,v=h.words[k]||{sessions:0,spellingWrong:0,meaningWrong:0,spellingFirstTry:0,meaningFirstTry:0};v.sessions++;v.spellingWrong+=s.mistakes[k].spelling;v.meaningWrong+=s.mistakes[k].meaning;if(!s.mistakes[k].spelling)v.spellingFirstTry++;if(!s.mistakes[k].meaning)v.meaningFirstTry++;h.words[k]=v;}
 try{localStorage.setItem("mq.dolch-test.v1."+encodeURIComponent(s.profileId),JSON.stringify(h));}catch(e){console.warn("Could not save Dolch test results",e);}
}
function finish(){
 stop();persist();state.phase="result";render();$("dolch-test-summary").hidden=false;
 $("dolch-test-score-spelling").textContent=state.score.spelling+" / 13";
 $("dolch-test-score-meaning").textContent=state.score.meaning+" / 13";
}
function choose(word){
 const s=state;if(!s||s.locked||s.phase==="result"||(s.phase==="spelling"&&!s.heard)||s.done.has(word))return;
 const phase=s.phase,ok=word===s.words[s.index].word;
 if(ok){if(s.mistakes[word][phase]===0)s.score[phase]++;stopSpeech();s.speaking=false;}
 else s.mistakes[s.words[s.index].word][phase]++;
 s.locked=true;render();beep(ok);
 const selected=[...$("dolch-test-board").children].find(button=>button.dataset.word===word);
 const mark=document.createElement("span");mark.className="dt-card-mark "+(ok?"dt-ok":"dt-no");mark.setAttribute("aria-hidden","true");if(selected)selected.append(mark);
 stepTimer=setTimeout(()=>{stepTimer=0;if(state!==s)return;if(ok){if(phase==="spelling")s.phase="meaning";else{s.done.add(word);if(s.index===12){finish();return;}s.index++;s.phase="spelling";s.heard=false;}}s.locked=false;render();if(ok&&phase==="spelling")speakThree();},500);
}
function quit(){if(!state)return;const callback=state.onQuit;stop();state=null;callback();}
function start({profileId,onComplete,onQuit}){
 stop();const vocab=window.MQPhonicsWords.getBasicVocabulary();
 if(vocab.length!==13||new Set(vocab.map(v=>v.word)).size!==13)throw Error("13 unique nouns required");
 const words=shuffle(vocab),mistakes={};words.forEach(v=>mistakes[v.word]={spelling:0,meaning:0});
 state={words,spellingOrder:shuffle(vocab),meaningOrder:shuffle(vocab),index:0,phase:"spelling",heard:false,speaking:false,locked:false,done:new Set(),mistakes,score:{spelling:0,meaning:0},profileId:String(profileId),started:Date.now(),onComplete,onQuit};
 $("dolch-test-summary").hidden=true;render();clock();timer=setInterval(clock,1000);
}
const screen=document.createElement("section");screen.id="dolch-test-screen";screen.className="screen phonics-intro-screen";screen.setAttribute("aria-label","えいごのことばテスト");
screen.innerHTML='<div class="dt-stage"><img class="dt-background" id="dolch-test-background" alt=""><div class="phonics-intro-card dt-white"><div id="dolch-test-board" class="dt-grid"></div></div><button class="quit-button" id="dolch-test-quit" type="button">やめる</button><header class="topbar"><div class="progress-badge"><span id="dolch-test-progress">1 / 13</span></div><div class="elapsed-time" id="dolch-test-time">0秒</div></header><div id="dolch-test-word" class="dt-word" hidden></div><button class="phonics-youtube-end" id="dolch-test-listen" type="button">きいてみる</button><button id="dolch-test-replay" type="button" hidden>もういちどきく</button><div id="dolch-test-summary" class="dt-summary" hidden><h2>テストけっか</h2><p>えいご　<span id="dolch-test-score-spelling"></span></p><p>いみ　<span id="dolch-test-score-meaning"></span></p><button id="dolch-test-finish" type="button">のりものをそだてる</button></div></div>';
document.getElementById("app").append(screen);
$("dolch-test-listen").addEventListener("click",listen);$("dolch-test-replay").addEventListener("click",replay);$("dolch-test-quit").addEventListener("click",quit);
$("dolch-test-finish").addEventListener("click",()=>{if(!state||state.phase!=="result")return;const callback=state.onComplete;stop();state=null;callback();});
window.MQDolchTest=Object.freeze({start,quit});
})();