const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const app = fs.readFileSync(path.resolve(__dirname, "../dist/app.js"), "utf8");
const start = app.indexOf("function openNormalCollectionAfterPhonicsReward()");
const end = app.indexOf("function showPhonicsCollectionHandoff()", start);
assert.ok(start >= 0 && end > start, "reward handoff function exists");
const code = app.slice(start, end);

test("reward handoff re-enables all 20 collection cards for normal browsing", () => {
  const cards = Array.from({ length: 20 }, (_, index) => ({
    dataset: { vehicle: String(index), stage: "2" },
    disabled: true,
    attributes: new Map([["aria-disabled", "true"]]),
    removeAttribute(name) { this.attributes.delete(name); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    querySelector() { return null; },
    classList: { add() {} }
  }));
  const cls = { remove() {} };
  const elements = {
    "collection-grid": { querySelectorAll(selector) { assert.equal(selector, ".collection-card"); return cards; } },
    "collection-screen": { classList: cls },
    "reward-screen": { classList: cls },
    "collection-item-count": { textContent: "" }
  };
  const state = {
    collectionClosing: true,
    collectionMode: "phonics-reward-select",
    phonicsLastRewardVehicleIndex: -1,
    collectionTimerId: null
  };
  const context = {
    state,
    $: id => { assert.ok(elements[id], id); return elements[id]; },
    document: { getElementById: () => null },
    window: { setInterval: () => 1 },
    stopCollectionTimer() {},
    setBackgroundMusicDucked() {},
    setCollectionPresentationMode(mode) { state.collectionMode = mode; },
    resetCapsuleDialog() {},
    availableEnergyCapsuleCount: () => 0,
    prepareCollectionCategoryTabs() {},
    setCollectionCategory() {},
    vehicleProgress: () => ({ discovered: true, friendly: true, energy: 0, stage: 2, masterMedal: false }),
    sizeCollectionStage() {},
    showScreen() {},
    updateCollectionClock() {}
  };
  vm.runInNewContext(code + "\nopenNormalCollectionAfterPhonicsReward();", context);
  assert.equal(state.collectionMode, "browse");
  for (const card of cards) {
    assert.equal(card.disabled, false, "normal browsing must enable each card");
    assert.equal(card.getAttribute("aria-disabled"), null, "accessibility state is restored");
  }
});
