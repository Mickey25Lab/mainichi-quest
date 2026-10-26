import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const getGit = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const commit = (process.env.CF_PAGES_COMMIT_SHA || getGit("rev-parse", "HEAD")).trim();
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("A full Git commit SHA is required");
const branch = (process.env.CF_PAGES_BRANCH || getGit("branch", "--show-current")).trim();
if (!branch) throw new Error("Cannot determine deployment branch");
const environment = branch === "main" ? "production" : "preview";
const meta = {
  schemaVersion: 1,
  environment,
  version: commit.slice(0, 12),
  commit,
  branch,
  // Git commit identifies deployed source; no mutable tag or counter is generated.
};
writeFileSync("dist/release-meta.json", JSON.stringify(meta, null, 2) + "\n");
console.log("Cloudflare release metadata:", JSON.stringify(meta));
