const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.resolve(__dirname,"../dist/app.js"),"utf8");
const html = fs.readFileSync(path.resolve(__dirname,"../dist/index.html"),"utf8");
const lesson = fs.readFileSync(path.resolve(__dirname,"../dist/scripts/phonics-words.js"),"utf8");
const source = fs.readFileSync(path.resolve(__dirname,"../dist/scripts/dolch-test.js"),"utf8");
const css = fs.readFileSync(path.resolve(__dirname,"../dist/scripts/dolch-test.css"),"utf8");

test("new Dolch test is independent, and existing 10-question lesson remains unchanged",()=>{
  assert.match(app,/id:"dolch-basic-test", label:"えいごのことばテスト", detail:"パート１　きほんの名詞　13 words"/);
  assert.match(app,/startDolchTestMode/);
  assert.match(app,/beginDailyMissionAttempt\(modeId\)/);
  assert.match(app,/completeDailyMissionRound\(modeId\);openPhonicsRewardSelection\(\)/);
  assert.match(html,/data-mode="dolch-basic-test"/);
  assert.match(html,/scripts\/dolch-test\.js/);
  assert.match(html,/scripts\/dolch-test\.css/);
  assert.match(lesson,/shuffle\(basicVocabulary\)\.slice\(0,10\)/);
  assert.match(lesson,/getBasicVocabulary: \(\) => basicVocabulary\.map/);
});

test("13 nouns use existing lesson vocabulary without duplicating the source",()=>{
  const items = [...lesson.slice(lesson.indexOf("const basicVocabulary = ["),lesson.indexOf("];",lesson.indexOf("const basicVocabulary = ["))).matchAll(/\{word:"([A-Z]+)"/g)].map(m=>m[1]);
  assert.equal(items.length,13);
  assert.ok(!items.includes("MEN"));
  assert.match(source,/getBasicVocabulary\(\)/);
  assert.match(source,/vocab\.length!==13/);
  assert.match(source,/spellingOrder:shuffle\(vocab\),meaningOrder:shuffle\(vocab\)/);
  assert.match(source,/s\.done\.has\(item\.word\)/);
});

test("test uses first-attempt grading, separate errors per word/step, and 3 speech repetitions",()=>{
  assert.match(source,/if\(ok\)\{if\(s\.mistakes\[word\]\[phase\]===0\)s\.score\[phase\]\+\+/);
  assert.match(source,/else s\.mistakes\[s\.words\[s\.index\]\.word\]\[phase\]\+\+/);
  assert.match(source,/if\(\+\+count<3\)speechDelay=setTimeout\(utter,800\)/);
  assert.match(source,/u\.rate=\.85;u\.pitch=1\.2;u\.volume=1/);
  assert.match(source,/if\(ok\).*stopSpeech\(\)/);
  assert.match(source,/setTimeout\(\(\)=>\{stepTimer=0;[\s\S]*\},500\)/);
  assert.match(source,/mq\.dolch-test\.v1\./);
  assert.match(source,/encodeURIComponent\(s\.profileId\)/);
  assert.match(source,/history|spellingFirstTry/);
  assert.match(source,/dt-card-mark/);
  assert.match(source,/if\(ok&&phase==="spelling"\)speakThree\(\)/);
  assert.match(source,/dolch-test-replay/);
  assert.doesNotMatch(source,/dolch-test-listen/,"no manual start action");
  assert.match(source,/speakThree\(\{first:true\}\);\s*\}/,"playback starts at session start");
  assert.match(source,/else speakThree\(\{first:true\}\)/,"next spelling word auto-plays");
  assert.match(css,/#ec343d/);
  assert.match(css,/#197de2/);
  assert.match(source,/stopSpeech\(\);s\.speaking=false;/,"wrong answers cancel speech too");
  assert.match(source,/if\(!ok\)speakThree\(\)/,"wrong answers restart spoken word");
  assert.match(css,/\.dt-stage \.dt-word\{background:#197de2;border:none/);
  assert.match(css,/\.dt-stage>\.dt-white \.dt-summary\{[^}]*background:transparent/);
});

test("4-4-4-1 layout has equal cards, centered final row and Japanese no wrap",()=>{
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/grid-template-rows:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/\.dt-card\.dt-last\{grid-column:2 \/ span 2/);
  assert.match(css,/\.dt-jp\{[^}]*white-space:nowrap/);
  assert.match(source,/dt-focus-upper/);
  assert.match(source,/if\(s\.viewKey===viewKey\)/,"cards persist through speech state updates");
  assert.match(source,/mark\.remove\(\)/,"marks are removed without rerendering image");
  assert.match(source,/function meaningMarkup\(markup\)/,"custom kanji/ruby rendering");
  assert.match(source,/dt-ruby-base/);
  assert.match(css,/\.dt-ruby-base\{display:inline-block;color:#132b50;visibility:visible/);
  assert.match(source,/aligned\.replace\(\/<ruby>/);
  assert.match(source,/dt-focus-lower/);
  assert.match(css,/\.dt-card\[data-word="TOP"\] \.dt-jp\{display:block;font-size:27px/);
  assert.match(css,/\.dt-card img\{flex:none;width:75px/);
  assert.match(css,/\.dt-stage \.dt-word\{[^}]*width:calc\(\(1180px - 24px - 27px\) \/ 4\)/);
  assert.match(css,/#dolch-test-replay\{[^}]*width:280px/);
  assert.match(source,/class="elapsed-time" id="dolch-test-time"/);
  assert.match(css,/#dolch-test-screen \.topbar\{position:absolute;z-index:7;top:14px;left:42px;right:42px;height:60\.8px\}/);
  assert.match(css,/#dolch-test-screen \.progress-badge\{left:0;width:166px;height:60\.8px\}/);
  assert.match(css,/#dolch-test-screen \.elapsed-time\{right:0;height:60\.8px\}/);
});
