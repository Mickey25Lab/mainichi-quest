const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname,"../dist/pronunciation-trial.html"),"utf8");
test("13 trial words are sequential and isolated from saved progress",()=>{
  assert.match(html,/const words=\["BED","BOX","CAT","DOG","LEG","MAN","MEN","PIG","SUN","TOP","HAND","MILK","NEST"\]/);
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
