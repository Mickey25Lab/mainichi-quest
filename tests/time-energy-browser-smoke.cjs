const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "../dist");
const browserExecutable = process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : undefined;
let server, baseUrl;

test.before(async () => {
  server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root) || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) {
      response.writeHead(404); response.end("not found"); return;
    }
    const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml", ".mp3":"audio/mpeg", ".wav":"audio/wav" };
    response.setHeader("content-type", types[path.extname(filename)] || "application/octet-stream");
    fs.createReadStream(filename).pipe(response);
  });
  await new Promise((resolve) => server.listen(0,"127.0.0.1",resolve));
  baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise(resolve => server.close(resolve)));

async function setupQa(page) {
  await page.goto(baseUrl);
  await page.locator("#profile-setup-overlay").waitFor({state:"visible"});
  await page.locator("#profile-setup-name").fill("タイムQA");
  await page.locator("#profile-setup-form button[type=submit]").click();
  await page.locator("#profile-setup-overlay").waitFor({state:"hidden"});
  await page.locator("#admin-settings-button").click();
  for (const digit of "3710") await page.locator('[data-admin-pin-digit="'+digit+'"]').click();
  await page.locator("#admin-panel-overlay").waitFor({state:"visible"});
  assert.equal(await page.getByRole("button",{name:/QA：タイムボーナス/}).isVisible(),false);
  await Promise.all([page.waitForEvent("load"), page.locator("#admin-qa-toggle").click()]);
  await page.locator("#profile-setup-overlay").waitFor({state:"hidden"});
  await page.locator("#admin-settings-button").click();
  for (const digit of "3710") await page.locator('[data-admin-pin-digit="'+digit+'"]').click();
  await page.locator("#admin-panel-overlay").waitFor({state:"visible"});
}
function readTimeEnergy(page) {
  return page.evaluate(() => window.MQProfileStorage.createProfileStorage(localStorage).getTimeEnergy());
}

test("QA pink time energy selects one garage vehicle and survives reload", {timeout:90000}, async (t) => {
  const browser = await chromium.launch({headless:true,...(browserExecutable?{executablePath:browserExecutable}:{})});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport:{width:1400,height:1050}});
  await setupQa(page);
  await page.getByRole("button",{name:/QA：タイムボーナス/}).click();
  await page.locator("#collection-grid .collection-card:not([disabled])").first().waitFor();
  assert.ok((await page.locator("#collection-header-title").innerText()).includes("タイムボーナス +8"));
  assert.equal(await page.locator(".collection-stage > .collection-time-panel:not(.collection-capsule-time)").isVisible(), true);
  const initial = await readTimeEnergy(page);
  assert.equal(initial.balance,8);
  assert.equal(initial.allocation.amount,8);
  const remaining = Number(await page.locator("#collection-seconds").textContent());
  assert.ok(remaining > 0 && remaining <= 30);
  await page.locator("#collection-grid .collection-card:not([disabled])").first().click();
  await page.locator("#phonics-grow-confirm").waitFor({state:"visible"});
  await page.locator("#phonics-grow-accept").click();
  await page.waitForFunction(() => {
    const state = window.MQProfileStorage.createProfileStorage(localStorage).getTimeEnergy();
    return state.balance === 0 && state.allocation === null;
  });
  const done = await readTimeEnergy(page);
  assert.equal(done.completed.filter(e => e.id === initial.allocation.id).length,1);
  await page.reload();
  assert.equal((await readTimeEnergy(page)).balance,0);
  assert.equal((await readTimeEnergy(page)).completed.filter(e => e.id === initial.allocation.id).length,1);
});

test("expired QA deadline scans one persistently locked candidate after reload", {timeout:90000}, async (t) => {
  const browser = await chromium.launch({headless:true,...(browserExecutable?{executablePath:browserExecutable}:{})});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport:{width:1400,height:1050}});
  await setupQa(page);
  await page.getByRole("button",{name:/QA：タイムボーナス/}).click();
  await page.locator("#collection-grid .collection-card:not([disabled])").first().waitFor();
  const original = await readTimeEnergy(page);
  await page.evaluate(() => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    const qa = store.getActiveQaState();
    qa.timeEnergy.allocation.deadline = Date.now() - 1000;
    store.setActiveQaState(qa);
  });
  await page.reload();
  await page.waitForFunction(() => {
    const saved = window.MQProfileStorage.createProfileStorage(localStorage).getTimeEnergy();
    return saved.balance === 0 && saved.allocation === null;
  },null,{timeout:35000});
  const done = await readTimeEnergy(page);
  assert.equal(done.completed.filter(e => e.id === original.allocation.id).length,1);
  assert.ok(Number.isInteger(done.completed.find(e => e.id === original.allocation.id).vehicleIndex));
});

test("time-energy storage and allocation APIs are available in the loaded browser", {timeout:90000}, async (t) => {
  const browser = await chromium.launch({headless:true,...(browserExecutable?{executablePath:browserExecutable}:{})});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport:{width:1400,height:1050}});
  await setupQa(page);
  // Interface smoke only. This is not an actual learning-round-to-allocation E2E test.
  const wiring = await page.evaluate(() => {
    const store = window.MQProfileStorage.createProfileStorage(localStorage);
    return {balance:store.getTimeEnergy().balance, hasCredit:typeof store.creditTimeEnergy === "function",
      hasAllocation:typeof store.beginTimeEnergyAllocation === "function"};
  });
  assert.equal(wiring.balance,0);
  assert.equal(wiring.hasCredit,true);
  assert.equal(wiring.hasAllocation,true);
});

test("real ten-answer division round credits earned pink energy only at result screen", {timeout:180000}, async t => {
  const browser=await chromium.launch({headless:true,...(browserExecutable?{executablePath:browserExecutable}:{})});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1400,height:1050}});
  await page.goto(baseUrl);
  await page.locator("#profile-setup-overlay").waitFor({state:"visible"});
  await page.locator("#profile-setup-name").fill("時間獲得実プレイ");
  await page.locator("#profile-setup-form button[type=submit]").click();
  await page.locator("#profile-setup-overlay").waitFor({state:"hidden"});
  // Pre-unlock friendly stage for all vehicles to isolate time eligibility.
  await page.evaluate(()=>{
    const store=window.MQProfileStorage.createProfileStorage(localStorage);
    store.setRewardProgress(Array.from({length:20},()=>({
      discovered:true,friendship:5,friendly:true,stage:2,energy:0,masterMedal:false
    })));
  });
  await page.reload();
  await page.locator("#start-button").click();
  await page.locator("#mode-select-normal").click();
  await page.locator("#play-screen.active").waitFor();
  const balance=()=>page.evaluate(()=>window.MQProfileStorage.createProfileStorage(localStorage).getTimeEnergy().balance);
  assert.equal(await balance(),0);
  const clickDigits=async value=>{
    for(const digit of String(value)) await page.locator('.number-key[data-number="'+digit+'"]').click();
  };
  for(let i=1;i<=10;i++){
    await page.waitForFunction(n=>document.querySelector("#progress-count")?.textContent?.trim()===n+" / 10",i);
    const problem=await page.locator("#problem-card").innerText();
    const match=problem.match(/(\d+)\s*÷\s*(\d+)/);
    assert.ok(match,"division question must be visible: "+problem);
    const dividend=Number(match[1]),divisor=Number(match[2]);
    await clickDigits(Math.floor(dividend/divisor));
    if(dividend%divisor===0) await page.locator("#no-remainder-key").click();
    else {
      await page.locator("#remainder-key").click();
      await clickDigits(dividend%divisor);
    }
    if(i<10) {
      await page.waitForFunction(n=>document.querySelector("#progress-count")?.textContent?.trim()===(n+1)+" / 10",i,{timeout:25000});
      assert.equal(await balance(),0,"time energy must remain provisional during the round");
    }
  }
  await page.locator("#result-screen.active").waitFor({timeout:30000});
  const earned=await balance();
  assert.ok(earned>0,"at least one qualifying timed answer should earn pink energy");
  await page.reload();
  assert.equal(await balance(),earned,"completed round credit survives reload");
});
