const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const levels=require("../dist/scripts/level-system.js");const {createProfileStorage}=require("../dist/scripts/profile-storage.js");
function storage(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
test("thresholds, profiles and exact display units",()=>{assert.deepEqual(levels.thresholds,[0,100,400,900,1600,2900,4200,5800,7500,9300]);assert.equal(levels.requiredPoints(11),11300);assert.equal(levels.requiredPoints(50),89300);assert.equal(levels.levelAt(2772),5);assert.equal(levels.levelAt(1528),4);assert.equal(levels.levelAt(99),1);assert.equal(levels.levelAt(100),2);assert.equal(levels.formatPoints(2772),"2772");assert.equal(levels.formatPoints(12700),"1万2700");assert.equal(levels.formatPoints(10000),"1万");assert.equal(levels.titles.length,50);assert.match(levels.titleHtml(5),/旅人<rt>たびびと<\/rt>/);});
test("level acknowledgment persists per profile and is cleared on reset",()=>{const p=createProfileStorage(storage());p.createProfile("A");assert.equal(p.getLevelAcknowledged(),null);p.setLevelAcknowledged(5);assert.equal(p.getLevelAcknowledged(),5);p.createProfile("B");assert.equal(p.getLevelAcknowledged(),null);p.setLevelAcknowledged(4);let first=p.listProfiles().find(x=>x.displayName==="A");p.setActiveProfile(first.profileId);assert.equal(p.getLevelAcknowledged(),5);p.resetActiveProfileData();assert.equal(p.getLevelAcknowledged(),null);});
test("startup celebration uses existing fanfare and waits until next launch",()=>{const app=fs.readFileSync("dist/app.js","utf8"),html=fs.readFileSync("dist/index.html","utf8");assert.match(app,/mique-startup-finished/);assert.match(app,/playFanfareSound\(\)/);assert.match(app,/getLevelAcknowledged/);assert.match(app,/setLevelAcknowledged/);assert.match(html,/id="level-up-overlay"/);assert.match(html,/id="top-level-panel"/);});

test("all 50 titles use ruby for every kanji and never display reading parentheses",()=>{
  for(let level=1;level<=50;level++){
    const html=levels.titleHtml(level);
    assert.doesNotMatch(html,/[（）]/,`level ${level}: parenthesized reading`);
    assert.equal(html.replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/g,"$1"),levels.title(level),`level ${level}: visible title must match`);
    assert.doesNotMatch(html.replace(/<ruby>.*?<\/ruby>/g,""),/[一-龯々ヶ]/,`level ${level}: unannotated kanji`);
  }
  assert.match(levels.titleHtml(1),/<ruby>見習い<rt>みならい<\/rt><\/ruby>/);
  assert.match(levels.titleHtml(3),/<ruby>友だち<rt>ともだち<\/rt><\/ruby>/);
  assert.match(levels.titleHtml(22),/<ruby>使い<rt>つかい<\/rt><\/ruby>/);
});

test("only level 6 starts at 2900 points; all other thresholds stay fixed",()=>{assert.equal(levels.requiredPoints(5),1600);assert.equal(levels.requiredPoints(6),2900);assert.equal(levels.requiredPoints(7),4200);assert.equal(levels.levelAt(2899),5);assert.equal(levels.levelAt(2900),6);});
test("returning to TOP prepares and opens level-up after initial loader",()=>{const app=fs.readFileSync("dist/app.js","utf8");assert.match(app,/if \(id === "start-screen" && gameInitialized\) \{\s*prepareLevelCelebration\(\)/);assert.match(app,/startup-loader"\)\?\.hidden\) openPendingLevelCelebration\(\)/);});


test("capsules: one per new level, no duplicates, separate profiles, and reset",()=>{
  const store=createProfileStorage(storage());
  store.createProfile("A");
  // Existing installations first baseline their already-acknowledged level.
  store.setLevelAcknowledged(4);
  assert.equal(store.awardEnergyCapsulesThroughLevel(5),1);
  assert.equal(store.awardEnergyCapsulesThroughLevel(5),0);
  assert.equal(store.awardEnergyCapsulesThroughLevel(7),2);
  assert.equal(store.getEnergyCapsuleCount(),3);
  assert.equal(store.consumeEnergyCapsule(),true);
  assert.equal(store.getEnergyCapsuleCount(),2);
  const a=store.getActiveProfileId();
  store.createProfile("B");
  assert.equal(store.getEnergyCapsuleCount(),0);
  assert.equal(store.awardEnergyCapsulesThroughLevel(10),0);
  assert.equal(store.getEnergyCapsuleCount(),0);
  store.setActiveProfile(a);
  assert.equal(store.getEnergyCapsuleCount(),2);
  store.resetActiveProfileData();
  assert.equal(store.getEnergyCapsuleCount(),0);
  assert.equal(store.awardEnergyCapsulesThroughLevel(1),0);
});
test("capsules: pending levels count and no inventory underflow",()=>{
  const store=createProfileStorage(storage());
  store.createProfile("A");
  store.setLevelAcknowledged(2);
  assert.equal(store.awardEnergyCapsulesThroughLevel(4),2);
  assert.equal(store.awardEnergyCapsulesThroughLevel(4),0);
  assert.equal(store.consumeEnergyCapsule(),true);
  assert.equal(store.consumeEnergyCapsule(),true);
  assert.equal(store.consumeEnergyCapsule(),false);
  assert.equal(store.getEnergyCapsuleCount(),0);
});
test("capsule UI is connected without introducing image dependencies",()=>{
  const app=fs.readFileSync("dist/app.js","utf8"),html=fs.readFileSync("dist/index.html","utf8");
  assert.match(app,/function startCapsuleSelection/);
  assert.match(app,/capsuleChoiceDeadline = Date.now\(\) \+ 30000/);
  assert.match(app,/profileStore\.awardEnergyCapsulesThroughLevel\(current\)/);
  assert.match(app,/profileStore\.consumeEnergyCapsule\(\)/);
  assert.match(html,/id="collection-item-button"/);
  assert.match(html,/好きなのりものにエネルギーを20チャージ！/);
});
