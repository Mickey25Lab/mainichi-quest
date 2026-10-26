import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Cloudflare Pages invokes this entry point after generating preview-meta.json.
// Keep preview builds immutable; production release versioning is handled
// by the existing GitHub Pages release workflow.
const branch = process.env.CF_PAGES_BRANCH || "";
if (!branch) throw new Error("CF_PAGES_BRANCH missing: refusing to infer a release environment");

const source = readFileSync("dist/app.js", "utf8");
const match = source.match(/const appVersion = "(\d+\.\d+\.\d+)";/);
if (!match) throw new Error("appVersion missing in dist/app.js");

const commit = process.env.CF_PAGES_COMMIT_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding:"utf8" }).trim();
const preview = branch !== "main";
const metadata = {
  version: match[1],
  build: process.env.CF_PAGES_DEPLOYMENT_ID || commit.slice(0,7),
  commit,
  branch,
  environment: preview ? "preview" : "production",
  releaseTag: null,
  isNewRelease: false
};
writeFileSync("dist/release-meta.json", JSON.stringify(metadata, null, 2) + "\n");
console.log("Prepared Cloudflare release metadata", metadata);
