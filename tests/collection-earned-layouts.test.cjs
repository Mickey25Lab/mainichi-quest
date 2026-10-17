const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "dist/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "dist/styles.css"), "utf8");

test("super robots fill front-left, front-right, rear-left, rear-right with finalized geometry", () => {
  assert.match(app, /const superRobotCollectionSlots = Object\.freeze\(\[[\s\S]*x:250, contactY:690, size:595[\s\S]*x:870, contactY:690, size:595[\s\S]*x:545, contactY:545, size:351[\s\S]*x:1180, contactY:545, size:351/);
  assert.match(app, /x:870[^\n]+flip:true/);
  assert.match(app, /x:1180[^\n]+flip:true/);
  assert.match(css, /\.collection-scene-art\.is-flipped\s*\{[^}]*transform:scaleX\(-1\)/s);
});

test("equipment fills lower row before upper row and uses standalone equipment artwork", () => {
  assert.match(app, /const equipmentCollectionSlots = Object\.freeze\(\[[\s\S]*x:350, contactY:700[\s\S]*x:1050, contactY:700[\s\S]*x:350, contactY:330[\s\S]*x:1050, contactY:330/);
  assert.equal((app.match(/shadowOffsetY:0/g) || []).length, 4);
  assert.match(app, /function equipmentArtworkPath[\s\S]*\/05_equipment\/\$\{stem\}_equipment\.webp/);
  assert.doesNotMatch(app, /function equipmentArtworkPath[\s\S]{0,200}04_super_robot_equipped/);
});

test("master medals fill each row left-to-right from the bottom row upward", () => {
  assert.match(app, /const medalCollectionSlots = Object\.freeze\(\[805,615,420,230\]\.flatMap/);
  assert.match(app, /\[230,465,700,935,1170\]\.map/);
  assert.match(app, /size:140, anchorY:\.5/);
});

test("new collection categories use their acquisition events and stage prerequisites", () => {
  assert.match(app, /"super-robot":"super_robot", equipment:"super_robot_equipped", medal:"master_medal"/);
  assert.match(app, /kind === "super-robot"\) return progress\.discovered && progress\.stage >= 4/);
  assert.match(app, /kind === "equipment"\) return progress\.discovered && progress\.stage >= 5/);
  assert.match(app, /kind === "medal"\) return progress\.discovered && progress\.masterMedal/);
});

test("four-up categories paginate after four acquisitions and share swipe navigation", () => {
  assert.match(app, /\{ robot:10, "super-robot":4, equipment:4 \}/);
  assert.match(app, /Math\.ceil\(collectionSceneOrder\(category\)\.length \/ collectionCategoryPageSize\(category\)\)/);
  assert.match(app, /renderFourUpCollectionScene\(category, superRobotCollectionSlots\)/);
  assert.match(app, /renderFourUpCollectionScene\(category, equipmentCollectionSlots\)/);
  assert.match(app, /setCollectionCategoryPage\(deltaX > 0 \? state\.collectionCategoryPage \+ 1 : state\.collectionCategoryPage - 1\)/);
  assert.match(html, /id="collection-page-indicator"[^>]*><\/div>/);
});
