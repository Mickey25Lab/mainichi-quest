import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extractAppVersion, isUserFacingPath } from "./check-app-version-bump.mjs";
const [before, after] = process.argv.slice(2);
if (!/^[a-f\d]{40}$/i.test(before ?? "") || !/^[a-f\d]{40}$/i.test(after ?? "")) {
  throw new Error("Expected before and after git commit SHAs");
}
const files = execFileSync("git", ["diff","--name-only","--no-renames",before,after,"--"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean);
if (!files.some(isUserFacingPath)) {
  console.log("No user-facing files changed; skipping patch bump.");
  process.exit(0);
}
const path = "dist/app.js";
const original = readFileSync(path,"utf8");
const current = extractAppVersion(original);
const next = `${current.major}.${current.minor}.${current.patch+1}`;
const updated = original.replace(/(const\s+appVersion\s*=\s*["'])\d+\.\d+\.\d+(["']\s*;)/, (_whole, start, end) => `${start}${next}${end}`);
if (updated === original) throw new Error("Failed to replace appVersion");
writeFileSync(path,updated);
console.log(`Automatic main patch: ${current.raw} → ${next}`);
