const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "dist/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "dist/styles.css"), "utf8");

test("top reload button sits beside admin settings and reloads the PWA", () => {
  const reloadButton = html.indexOf('id="top-reload-button"');
  const settingsButton = html.indexOf('id="admin-settings-button"');
  assert.ok(reloadButton >= 0);
  assert.ok(settingsButton > reloadButton);
  assert.match(html, /id="top-reload-button"[^>]+aria-label="アプリを再読み込み"/);
  assert.match(css, /\.top-reload-button\s*\{[^}]*right:48px/s);
  assert.match(app, /navigator\.serviceWorker\?\.getRegistration\?\.\(\)/);
  assert.match(app, /await registration\?\.update\?\.\(\)/);
  assert.match(app, /window\.location\.reload\(\)/);
  assert.match(app, /\$\("top-reload-button"\)\.addEventListener\("click", reloadApplication\)/);
});
