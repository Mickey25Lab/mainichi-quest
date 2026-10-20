import test from "node:test";
import assert from "node:assert/strict";
import { checkVersionBump, extractAppVersion, isUserFacingPath } from "./check-app-version-bump.mjs";
const appJs = (v) => `(() => { const appVersion = "${v}"; })();`;
function check(paths, old="0.3.38", current=old){return checkVersionBump({changedFiles:paths,baseAppJs:appJs(old),headAppJs:appJs(current)});}
test("production PR requires unchanged version",()=>{assert.equal(check(["dist/index.html"]).headVersion,"0.3.38");assert.equal(check(["dist/styles.css"]).headVersion,"0.3.38");assert.equal(check(["dist/app.js"]).headVersion,"0.3.38");});
test("nonproduction PR also must not change version",()=>{assert.equal(check(["docs/a.md"]).headVersion,"0.3.38");});
test("manual patch/minor/major changes all rejected in PR",()=>{for(const v of ["0.3.39","0.4.0","1.0.0","0.3.37"]) assert.throws(()=>check(["dist/index.html"],"0.3.38",v),/Do not bump appVersion/);});
test("invalid version rejected",()=>{assert.throws(()=>checkVersionBump({changedFiles:[],baseAppJs:appJs("0.3.38"),headAppJs:'const appVersion = "next";'}),/exactly once/);});
test("only user-facing paths trigger main bump",()=>{assert.ok(isUserFacingPath("dist/assets/a.webp"));assert.ok(isUserFacingPath("dist/index.html"));assert.ok(!isUserFacingPath("README.md"));});
test("semantic parsing",()=>{assert.equal(extractAppVersion(appJs("0.3.38")).patch,38);});
