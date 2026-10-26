import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// The last release of the former GitHub Pages version series.
// Count only first-parent mainline commits after this fixed anchor.
// Unlike a mutable latest-tag lookup, this gives a stable version to each main commit.
const baselineTag = "mq-prod-v0.3.61";
const baselineVersion = [0, 3, 61];
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const commit = (process.env.CF_PAGES_COMMIT_SHA || git("rev-parse", "HEAD")).trim();
const branch = (process.env.CF_PAGES_BRANCH || git("branch", "--show-current")).trim();
if (!/^[a-f0-9]{40}$/.test(commit)) throw Error("A full Git commit SHA is required");
if (!branch) throw Error("Cannot determine deployment branch");
const environment = branch === "main" ? "production" : "preview";
// Cloudflare Git clones can be shallow. Fetch main history and the pinned release
// anchor so the version is calculated from real ancestry rather than guesswork.
try { git("rev-parse", "--is-shallow-repository") === "true" && git("fetch", "--unshallow", "origin"); } catch { /* full-history clone */ }
git("fetch", "--no-tags", "origin", "main");
git("fetch", "--no-tags", "origin", "tag", baselineTag);
const anchor = git("rev-parse", baselineTag);
const main = git("rev-parse", "refs/remotes/origin/main");
const releaseCommit = environment === "production" ? commit : main;
git("merge-base", "--is-ancestor", anchor, releaseCommit);
if (environment === "production") {
  // Do not accidentally version another branch as a production release.
  git("merge-base", "--is-ancestor", releaseCommit, main);
}
const offset = Number(git("rev-list", "--first-parent", "--count", `${anchor}..${releaseCommit}`));
if (!Number.isSafeInteger(offset) || offset < 0) throw Error("Invalid release ancestry count");
const version = [baselineVersion[0], baselineVersion[1], baselineVersion[2] + offset].join(".");
const meta = { schemaVersion: 1, environment, version, commit, branch, releaseCommit,
  versionSource: "first-parent-main-since-mq-prod-v0.3.61" };
writeFileSync("dist/release-meta.json", JSON.stringify(meta, null, 2) + "\n");
console.log("Cloudflare release metadata:", JSON.stringify(meta));
