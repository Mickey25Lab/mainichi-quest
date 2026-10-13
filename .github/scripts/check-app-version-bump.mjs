import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const APP_VERSION_PATTERN = /^\s*const\s+appVersion\s*=\s*["'](\d+)\.(\d+)\.(\d+)["']\s*;/gm;

export function isUserFacingPath(filePath) {
  return filePath === "dist/app.js"
    || filePath === "dist/styles.css"
    || filePath === "dist/index.html"
    || filePath === "dist/manifest.webmanifest"
    || filePath.startsWith("dist/assets/");
}

export function extractAppVersion(appJs, label = "dist/app.js") {
  const matches = [...String(appJs ?? "").matchAll(APP_VERSION_PATTERN)];
  if (matches.length !== 1) {
    throw new Error(`${label}: const appVersion = "x.y.z" must appear exactly once`);
  }
  const parts = matches[0].slice(1, 4).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part) || part < 0)) {
    throw new Error(`${label}: appVersion is invalid`);
  }
  return { raw: parts.join("."), major: parts[0], minor: parts[1], patch: parts[2] };
}

export function checkVersionBump({ changedFiles, baseAppJs, headAppJs }) {
  const userFacingFiles = changedFiles.filter(isUserFacingPath);
  if (userFacingFiles.length === 0) {
    return { required: false, message: "No production files changed; appVersion bump is not required." };
  }

  const base = extractAppVersion(baseAppJs, "base dist/app.js");
  const head = extractAppVersion(headAppJs, "head dist/app.js");
  const expected = `${base.major}.${base.minor}.${base.patch + 1}`;
  if (head.major !== base.major || head.minor !== base.minor || head.patch !== base.patch + 1) {
    throw new Error(
      `Production files changed, so appVersion must be bumped exactly one patch: ${base.raw} -> ${expected}. Found ${head.raw}.\n`
      + `Changed production files:\n${userFacingFiles.map((file) => `- ${file}`).join("\n")}`
    );
  }
  return {
    required: true,
    baseVersion: base.raw,
    headVersion: head.raw,
    userFacingFiles,
    message: `appVersion patch bump verified: ${base.raw} -> ${head.raw}`
  };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function validateSha(value, label) {
  if (!/^[0-9a-f]{40}$/i.test(value || "")) throw new Error(`${label} must be a full Git commit SHA`);
  return value;
}

export function runForCommits(baseSha, headSha) {
  const base = validateSha(baseSha, "base SHA");
  const head = validateSha(headSha, "head SHA");
  const changedFiles = git(["diff", "--name-only", "--no-renames", `${base}...${head}`, "--"])
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
  const userFacingFiles = changedFiles.filter(isUserFacingPath);
  if (userFacingFiles.length === 0) return checkVersionBump({ changedFiles, baseAppJs: "", headAppJs: "" });
  const baseAppJs = git(["show", `${base}:dist/app.js`]);
  const headAppJs = git(["show", `${head}:dist/app.js`]);
  return checkVersionBump({ changedFiles, baseAppJs, headAppJs });
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  try {
    const result = runForCommits(process.argv[2], process.argv[3]);
    console.log(result.message);
    if (result.userFacingFiles) console.log(result.userFacingFiles.map((file) => `- ${file}`).join("\n"));
  } catch (error) {
    console.error(`App version check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
