// Interaction-driven UI geometry regression. No hidden-screen class toggles.
const { chromium } = require("playwright");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../dist");
const out = path.resolve(__dirname, "../audit-results/ui-scale");
const sizes = [[1400, 1050], [1024, 768], [768, 1024], [1280, 720]];
const measurements = [];

function rectangle(r) {
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}
function checkStage(name, viewport, rect) {
  assert.ok(rect.width > 0 && rect.height > 0, name + ": empty stage");
  assert.ok(Math.abs(rect.width / rect.height - 4 / 3) < 0.012, name + ": lost 4:3 stage");
  assert.ok(rect.x >= -1 && rect.y >= -1, name + ": stage outside viewport (start)");
  assert.ok(rect.x + rect.width <= viewport[0] + 1, name + ": stage outside viewport (right)");
  assert.ok(rect.y + rect.height <= viewport[1] + 1, name + ": stage outside viewport (bottom)");
}
function checkControl(name, rect) {
  assert.ok(rect.width >= 20 && rect.height >= 20, name + ": unexpectedly small touch target");
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((req, res) => {
    let name;
    try { name = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/+/, "") || "index.html"; }
    catch { res.writeHead(400); res.end(); return; }
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg" };
    res.setHeader("content-type", types[path.extname(file)] || "application/octet-stream");
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const viewport of sizes) {
      const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] } });
      const page = await context.newPage();
      const url = "http://127.0.0.1:" + server.address().port + "/";
      await page.goto(url, { waitUntil: "domcontentloaded" });
      if (await page.locator("#profile-setup-overlay").isVisible()) {
        await page.locator("#profile-setup-name").fill("UI監査");
        await page.locator("#profile-setup-form button[type=submit]").click();
        await page.locator("#profile-setup-overlay").waitFor({ state: "hidden", timeout: 10000 });
      }
      await page.locator("#start-screen.active").waitFor({ timeout: 15000 });
      const top = rectangle(await page.locator("#start-screen .start-layer").boundingBox());
      checkStage("top", viewport, top);
      const launch = rectangle(await page.locator("#top-collection-button").boundingBox());
      checkControl("collection launch", launch);
      measurements.push({ viewport, screen: "top", stage: top, control: launch, source: "real navigation" });
      await page.locator("#top-collection-button").click();
      await page.locator("#collection-screen.active").waitFor({ timeout: 15000 });
      const collection = rectangle(await page.locator("#collection-screen .collection-stage").boundingBox());
      checkStage("collection", viewport, collection);
      const exit = rectangle(await page.locator("#collection-exit").boundingBox());
      checkControl("collection exit", exit);
      measurements.push({ viewport, screen: "collection", stage: collection, control: exit, source: "real navigation" });
      await context.close();
    }
  } finally {
    fs.writeFileSync(path.join(out, "interaction-geometry.json"), JSON.stringify({ measurements }, null, 2) + "\n");
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log("PASS: top and collection real-navigation geometry in four viewports");
})().catch(error => { console.error(error); process.exitCode = 1; });
