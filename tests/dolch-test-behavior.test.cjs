const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname,"../dist/scripts/dolch-test.js"),"utf8");
const lesson = fs.readFileSync(path.resolve(__dirname,"../dist/scripts/phonics-words.js"),"utf8");
const block = lesson.slice(lesson.indexOf("const basicVocabulary = ["),lesson.indexOf("];",lesson.indexOf("const basicVocabulary = [")));
const nouns = [...block.matchAll(/\{word:"([A-Z]+)",label:"([^"]+)",meaning:"([^"]+)"/g)].map(m=>({word:m[1],label:m[2],meaning:m[3]}));

function harness(){
 const els = new Map(),pending = new Map(),spoken = [],storage = new Map(), canceled = {count:0};
 let timerId=0,done=0,quit=0;
 class Element {
  constructor(){this.children=[];this.handlers={};this.dataset={};this.hidden=false;this.disabled=false;this.className="";this.textContent="";this.innerHTML="";}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
  replaceChildren(...nodes){this.children=[...nodes];}
  addEventListener(type,fn){this.handlers[type]=fn;}
  setAttribute(){}
  click(){if(!this.disabled)this.handlers.click?.();}
 }
 const document={
  createElement(){return new Element();},
  getElementById(id){if(!els.has(id))els.set(id,new Element());return els.get(id);}
 };
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const window={
  MQPhonicsWords:{getBasicVocabulary:()=>nouns.map(v=>({...v}))},
  speechSynthesis:{getVoices:()=>[],speak:u=>spoken.push(u),cancel:()=>{canceled.count++;}},
  AudioContext:undefined
 };
 class SpeechSynthesisUtterance{constructor(text){this.text=text;}}
 const sandbox={
  document,window,localStorage,SpeechSynthesisUtterance,
  setTimeout(fn,ms){const id=++timerId;pending.set(id,{fn,ms});return id;},
  clearTimeout(id){pending.delete(id);},
  setInterval(){return ++timerId;},clearInterval(){},
  Date,console
 };
 vm.runInNewContext(source,sandbox);
 const get=id=>document.getElementById(id);
 const answer=word=>{const item=get("dolch-test-board").children.find(x=>x.dataset.word===word);assert.ok(item,"card exists");item.click();};
 function advance(){
  const pair=[...pending].find(([,v])=>v.ms===500);
  assert.ok(pair,"feedback 500ms timer scheduled");
  pending.delete(pair[0]);pair[1].fn();
 }
 return {get,spoken,storage,canceled,answer,advance,
  start(id="one"){window.MQDolchTest.start({profileId:id,onComplete:()=>done++,onQuit:()=>quit++});},
  get done(){return done;},get quit(){return quit;},
  finishThree(){
    for(let i=0;i<3;i++){
      spoken[spoken.length-1].onend();
      if(i<2){
        const pair=[...pending].find(([,v])=>v.ms===800);
        assert.ok(pair,"speech pauses for 800ms between repeats");
        pending.delete(pair[0]);pair[1].fn();
      }
    }
  },
  quitTest(){window.MQDolchTest.quit();}
 };
}

test("test renders thirteen distinct cards; audio unlocks them; spelling and meaning have independent scores",()=>{
 const h=harness();h.start();
 assert.equal(h.get("dolch-test-progress").textContent,"1 / 13");
 assert.equal(h.get("dolch-test-board").children.length,13);
 assert.equal(h.get("dolch-test-board").children.filter(b=>b.disabled).length,0,"answer cards active as soon as mode starts");
 assert.equal(h.get("dolch-test-replay").hidden,false,"replay visible while audio plays");
 assert.equal(h.get("dolch-test-replay").disabled,true,"replay inactive while playing");
 assert.equal(h.spoken.length,1);
 assert.equal(h.spoken[0].pitch,1.2);
 const first=h.spoken[0].text.toUpperCase();
 assert.equal(h.get("dolch-test-board").children.filter(b=>b.disabled).length,0);
 const wrong=nouns.find(v=>v.word!==first).word;
 h.answer(wrong);
 assert.equal(h.canceled.count>0,true,"wrong answer cancels existing audio");
 assert.ok(h.get("dolch-test-board").children.find(b=>b.dataset.word===wrong).children.at(-1).className.includes("dt-card-mark dt-no"),"wrong mark is on the selected card");
 h.advance();
 assert.equal(h.spoken.length,2,"wrong answer automatically replays three times");
 assert.equal(h.get("dolch-test-progress").textContent,"1 / 13");
 h.answer(first);
 assert.ok(h.get("dolch-test-board").children.find(b=>b.dataset.word===first).children.at(-1).className.includes("dt-card-mark dt-ok"),"correct mark is on selected card");
 h.advance();
 assert.equal(h.get("dolch-test-word").hidden,false);
 assert.equal(h.canceled.count>0,true,"speech is stopped on correct spelling");
 assert.equal(h.spoken.length,3,"meaning stage automatically speaks the word again");
 assert.equal(h.spoken[2].text.toUpperCase(),first);
 assert.equal(h.get("dolch-test-board").children.find(b=>b.dataset.word===first).children.at(-1).className.includes("dt-card-mark"),false,"previous mark cleared on phase change");
 const meaningCard=h.get("dolch-test-board").children.find(b=>b.dataset.word===first);
 const meaningImage=meaningCard.children.find(c=>c.src);
 h.spoken[h.spoken.length-1].onend();
 assert.equal(h.get("dolch-test-board").children.find(b=>b.dataset.word===first),meaningCard,"speech ending preserves meaning card node");
 assert.equal(meaningCard.children.find(c=>c.src),meaningImage,"speech ending preserves decoded image node");
 h.answer(first);h.advance();
 assert.equal(h.get("dolch-test-progress").textContent,"2 / 13");
 assert.equal(h.spoken.length,4,"next question starts speech automatically without a listen button");
 assert.equal(h.get("dolch-test-board").children.find(b=>b.dataset.word===first).disabled,true);
 for(let i=1;i<13;i++){
  assert.equal(h.get("dolch-test-replay").hidden,false);
  const word=h.spoken[h.spoken.length-1].text.toUpperCase();
  h.answer(word);h.advance();
  h.answer(word);h.advance();
 }
 assert.equal(h.get("dolch-test-summary").hidden,false);
 assert.equal(h.get("dolch-test-score-spelling").textContent,"12 / 13");
 assert.equal(h.get("dolch-test-score-meaning").textContent,"13 / 13");
 const record=JSON.parse(h.storage.get("mq.dolch-test.v1.one"));
 assert.equal(record.runs.length,1);
 assert.equal(record.words[first].spellingWrong,1);
 assert.equal(record.words[first].meaningWrong,0);
 h.get("dolch-test-finish").click();
 assert.equal(h.done,1);
});

test("quitting does not store an incomplete test or invoke reward completion",()=>{
 const h=harness();h.start("child-two");
 h.get("dolch-test-quit").click();
 assert.equal(h.quit,1);
 assert.equal(h.done,0);
 assert.equal(h.storage.size,0);
});
