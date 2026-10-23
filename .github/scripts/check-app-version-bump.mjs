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
  // PRs must not edit the shared version: concurrent PRs would conflict.
  // Read the version even for docs-only PRs so accidental bumps fail.
  const base = extractAppVersion(baseAppJs, "base dist/app.js");
  const head = extractAppVersion(headAppJs, "head dist/app.js");
  if (base.raw !== head.raw) {
    throw new Error(`Do not bump appVersion in a PR (${base.raw} -> ${head.raw}). main deployment handles this automatically.`);
  }
  return { required: false, baseVersion: base.raw, headVersion: head.raw,
    userFacingFiles, message: userFacingFiles.length
      ? `PR version unchanged (${head.raw}); automatic patch bump on main.`
      : `Non-production PR; version unchanged (${head.raw}).` };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function validateSha(value, label) {
  if (!/^[0-9a-f]{40}$/i.test(value || "")) throw new Error(`${label} must be a full Git commit SHA`);
  return value;
}

export function runForCommits(baseSha, headSha, allowBotPatch = false) {
  const base = validateSha(baseSha, "base SHA");
  const head = validateSha(headSha, "head SHA");
  const changedFiles = git(["diff", "--name-only", "--no-renames", `${base}...${head}`, "--"])
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
  const userFacingFiles = changedFiles.filter(isUserFacingPath);
  const baseAppJs = git(["show", `${base}:dist/app.js`]);
  const headAppJs = git(["show", `${head}:dist/app.js`]);
  if (allowBotPatch) {
    // Only the protected, bot-created release proposal can change this field.
    if (changedFiles.length !== 1 || changedFiles[0] !== "dist/app.js") {
      throw new Error("Automated patch PR must only change dist/app.js");
    }
    const before = extractAppVersion(baseAppJs);
    const afterVersion = extractAppVersion(headAppJs);
    if (before.major !== afterVersion.major || before.minor !== afterVersion.minor ||
        afterVersion.patch !== before.patch + 1) {
      throw new Error("Automated patch PR must increment patch by exactly one");
    }
    const expected = baseAppJs.replace(
      /(const\s+appVersion\s*=\s*["'])\d+\.\d+\.\d+(["']\s*;)/,
      (_all, begin, end) => begin + afterVersion.raw + end
    );
    if (expected !== headAppJs) {
      throw new Error("Automated patch PR modified more than the version declaration");
    }
    return { message: "Verified bot-only, one-line patch version proposal", userFacingFiles };
  }
  return checkVersionBump({ changedFiles, baseAppJs, headAppJs });
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  try {
    const result = runForCommits(process.argv[2], process.argv[3], process.argv[4] === "--automated-patch");
    console.log(result.message);
    if (result.userFacingFiles) console.log(result.userFacingFiles.map((file) => `- ${file}`).join("\n"));
  } catch (error) {
    console.error(`App version check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
