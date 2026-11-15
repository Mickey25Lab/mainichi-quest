const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname,"../dist/pronunciation-trial.html"),"utf8");
test("13 trial words are sequential and isolated from saved progress",()=>{
  assert.match(html,/const words=\["BED","BOX","CAT","DOG","LEG","MAN","PIG","SUN","TOP","HAND","MILK","NEST","WIND"\]/);
  assert.match(html,/index\+\+/);
  assert.doesNotMatch(html,/localStorage|rewardProgress|fetch\(/);
});
test("recognition starts on tap, ends automatically and preserves transcript",()=>{
  assert.match(html,/window\.SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(html,/rec\.lang="en-US"/);
  assert.match(html,/rec\.start\(\)/);
  assert.match(html,/rec\.onend=/);
  assert.doesNotMatch(html,/id="finish"|addEventListener\("click",stop\)|よみおわったよ/);
  assert.match(html,/rec\.onresult=/);
});
test("three parent judgments and 13 row screenshot summary",()=>{
  for(const label of ["合っている","間違っている","曖昧・ノイズあり"])assert.ok(html.includes('data-judge="'+label+'"'));
  for(const [symbol,style] of [["○","good"],["×","bad"],["△","unsure"]])assert.ok(html.includes('class="judge-symbol '+style+'" aria-hidden="true">'+symbol));
  assert.match(html,/rows\.push\(/);
  assert.match(html,/if\(index===words\.length\)complete\(\)/);
  assert.match(html,/for\(const row of rows\)/);
});

test("parent buttons never break text and result table has case-insensitive fourth column",()=>{
  assert.match(html,/\.trial-judge-buttons button\{[^}]*white-space:nowrap/);
  assert.match(html,/<th>iPadの認識結果<\/th><th>文字正誤<\/th><th>おうちのひとの判定<\/th>/);
  assert.match(html,/function matchesWord\(word,recognized\)/);
  assert.match(html,/word\.toUpperCase\(\)===recognized\.trim\(\)\.toUpperCase\(\)/);
  assert.match(html,/matched\?"○":"×"/);
  assert.match(html,/row\.word,row\.recognized,matched\?"○":"×",row\.judgement/);
});

test("MEN is excluded and WIND is included in all thirteen prompts",()=>{
  const match=html.match(/const words=(\[[^;]+\]);/);
  assert.ok(match);
  const words=JSON.parse(match[1]);
  assert.equal(words.length,13);
  assert.equal(new Set(words).size,13);
  assert.ok(!words.includes("MEN"));
  assert.ok(words.includes("WIND"));
});
test("result restart clears prior responses and returns to first question in place",()=>{
  assert.match(html,/id="restart"[^>]*>もう一度<\/button>/);
  assert.match(html,/function restart\(\)\{/);
  assert.match(html,/rows\.length=0;index=0;/);
  assert.match(html,/\$\("results"\)\.hidden=true;/);
  assert.match(html,/\$\("question"\)\.hidden=false;\$\("controls"\)\.hidden=false;/);
  assert.match(html,/\$\("result-body"\)\.replaceChildren\(\)/);
  assert.match(html,/\$\("restart"\)\.addEventListener\("click",restart\)/);
});
