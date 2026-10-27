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
  assert.match(await page.locator("#collection-header-title").innerText(), /タイムボーナス \\+8\\nのりものをえらぼう！/);
  assert.equal(await page.locator(".collection-stage > .collection-time-panel").isVisible(), true);
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
