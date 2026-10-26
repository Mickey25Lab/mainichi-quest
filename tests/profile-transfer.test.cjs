const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const script = fs.readFileSync(path.join(__dirname, "../dist/scripts/profile-transfer.js"), "utf8");
const ORIGINS = ["https://mickey25lab.github.io", "https://mainichi-quest-63c.pages.dev"];
const KEY = "warizan-robot:profiles-v1";
const ACTIVE = "warizan-robot:active-profile-id-v1";
const profile = {
  profileId:"minato-original-id",displayName:"ミナト",progress:{rewardProgressPhase1:[{energy:76}],recentVehicles:[1]},
  collection:{stages:[4]},bestRecords:{bestTimeMs:12345},pointLedger:{total:432,observedProgress:[]},
  energyCapsuleCount:8,enabledModes:{phonics:true}
};
const original = {
  [KEY]:JSON.stringify({schemaVersion:1,profiles:[profile]}),
  [ACTIVE]:profile.profileId,
  "warizan-robot:profile-migration-v1":JSON.stringify({migrationCompleted:true})
};
let browser;
test.before(async()=>{browser=await chromium.launch({headless:true});});
test.after(async()=>{await browser.close();});
async function pageAt(origin, initial={}) {
  const context=await browser.newContext({acceptDownloads:true});
  await context.route("**/*",route=>route.fulfill({status:200,contentType:"text/html",body:
    '<html><body><div id="admin-panel-overlay"><section class="profile-card"></section></div>'+
    '<div id="profile-setup-overlay"><form></form></div></body></html>'}));
  const page=await context.newPage();
  await page.goto(origin+"/");
  await page.evaluate(entries=>{for(const [key,value] of Object.entries(entries))localStorage.setItem(key,value);},initial);
  await page.addScriptTag({content:script});
  return {page,context};
}
async function exportData(page) {
  await page.locator("#mq-transfer-open").click();
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"① データを書き出す"}).click();
  const download=await downloadPromise;
  const payload=JSON.parse(fs.readFileSync(await download.path(),"utf8"));
  return {payload,download};
}
async function importData(page,payload,approve=true) {
  await page.evaluate(approve=>{
    window.confirm=()=>approve;
    window.prompt=()=>approve?"移行":"キャンセル";
  },approve);
  const fileInput=page.locator('input[type="file"]');
  await page.locator('#mq-transfer-dialog [role="status"]').evaluate(el=>el.textContent="");
  await fileInput.setInputFiles({name:"transfer.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(payload))});
  await page.waitForFunction(()=>document.querySelector('#mq-transfer-dialog [role="status"]').textContent.length>0);
  return await page.locator('#mq-transfer-dialog [role="status"]').textContent();
}
test("round-trip: all saved keys, profile IDs and progress retained; source unchanged",async t=>{
  const src=await pageAt(ORIGINS[0],original);t.after(()=>src.context.close());
  const {payload,download}=await exportData(src.page);
  assert.match(download.suggestedFilename(),/^maique-transfer-/);
  assert.deepEqual(payload.entries,original);
  const srcAfter=await src.page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])));
  assert.deepEqual(srcAfter,original);
  const dest=await pageAt(ORIGINS[1]);t.after(()=>dest.context.close());
  await dest.page.locator("#profile-setup-overlay button").click();
  const status=await importData(dest.page,payload);
  assert.match(status,/保存完了/);
  const target=await dest.page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])));
  assert.deepEqual(target,original);
  await dest.page.reload();
  assert.equal(await dest.page.evaluate(key=>localStorage.getItem(key),KEY),original[KEY]);
});
test("existing destination profile cannot be overwritten",async t=>{
  const src=await pageAt(ORIGINS[0],original);t.after(()=>src.context.close());
  const {payload}=await exportData(src.page);
  const prior={[KEY]:JSON.stringify({schemaVersion:1,profiles:[{...profile,profileId:"sumire",displayName:"スミレ"}]}),[ACTIVE]:"sumire"};
  const dst=await pageAt(ORIGINS[1],prior);t.after(()=>dst.context.close());
  await dst.page.locator("#mq-transfer-open").click();
  assert.match(await importData(dst.page,payload),/上書き禁止/);
  assert.deepEqual(await dst.page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]))),prior);
});
test("invalid payload, same origin, unknown key and rejected confirmation make no changes",async t=>{
  const dst=await pageAt(ORIGINS[1]);t.after(()=>dst.context.close());
  await dst.page.locator("#mq-transfer-open").click();
  const base={format:"maique-profile-transfer-v1",sourceOrigin:ORIGINS[0],entries:original};
  for(const invalid of [{...base,sourceOrigin:ORIGINS[1]},{...base,entries:{...original,other:"bad"}},{...base,entries:{...original,[ACTIVE]:"other"}},{...base,entries:{...original,[KEY]:"not-json"}}]) {
    assert.match(await importData(dst.page,invalid),/中止/);
    assert.equal(await dst.page.evaluate(()=>localStorage.length),0);
  }
  assert.match(await importData(dst.page,base,false),/キャンセル/);
  assert.equal(await dst.page.evaluate(()=>localStorage.length),0);
});
test("write failure rolls back only values created by import",async t=>{
  const dst=await pageAt(ORIGINS[1]);t.after(()=>dst.context.close());
  await dst.page.locator("#mq-transfer-open").click();
  await dst.page.evaluate(()=>{
    const originalSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==="warizan-robot:profile-migration-v1")throw new Error("simulated quota");
      return originalSet.call(this,key,value);
    };
    window.confirm=()=>true;window.prompt=()=>"移行";
  });
  const payload={format:"maique-profile-transfer-v1",sourceOrigin:ORIGINS[0],entries:original};
  assert.match(await importData(dst.page,payload),/書き込み分を取り消しました/);
  assert.equal(await dst.page.evaluate(()=>localStorage.length),0);
});
