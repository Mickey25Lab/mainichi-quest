import { writeFile } from "node:fs/promises";

const branch = process.env.CF_PAGES_BRANCH || "";
const commit = process.env.CF_PAGES_COMMIT_SHA || "";
const productionBranch = "main";
let prNumber = null;

if (branch && branch !== productionBranch) {
  try {
    const url = new URL("https://api.github.com/repos/Mickey25Lab/mainichi-quest/pulls");
    url.searchParams.set("state", "open");
    url.searchParams.set("head", `Mickey25Lab:${branch}`);
    const response = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "mainichi-quest-cloudflare-pages"
      }
    });
    if (response.ok) {
      const pulls = await response.json();
      if (Array.isArray(pulls) && pulls.length > 0) prNumber = pulls[0].number;
    }
  } catch (_) {
    // Preview metadata is optional; never fail the deployment for this.
  }
}

const metadata = {
  environment: branch && branch !== productionBranch ? "preview" : "production",
  branch: branch || null,
  commit: commit || null,
  shortCommit: commit ? commit.slice(0, 7) : null,
  prNumber
};

await writeFile("dist/preview-meta.json", JSON.stringify(metadata));
console.log("Generated dist/preview-meta.json", metadata);
// Cloudflare build configuration verified for B-line preview identity.
