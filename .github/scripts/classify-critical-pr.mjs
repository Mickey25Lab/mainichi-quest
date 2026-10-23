import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const CRITICAL_EXACT = new Set(["dist/app.js", "dist/index.html"]);
const CRITICAL_PREFIXES = ["dist/scripts/"];
const TEST_PREFIX = "tests/";

export function classifyCriticalFiles(paths) {
  const files = [...new Set(paths.map(p => p.trim()).filter(Boolean))];
  const reasons = files.filter(path =>
    CRITICAL_EXACT.has(path) ||
    CRITICAL_PREFIXES.some(prefix => path.startsWith(prefix)) ||
    (path.startsWith(TEST_PREFIX) && path.endsWith(".test.cjs"))
  );
  return { critical: reasons.length > 0, reasons };
}

function main() {
  const [base, head] = process.argv.slice(2);
  // Manual dispatches and missing comparison refs should fail open toward
  // *more* testing rather than silently skipping the critical suites.
  let result;
  if (!base || !head) {
    result = { critical: true, reasons: ["missing comparison refs (safe default)"] };
  } else {
    try {
      const diff = execFileSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" });
      result = classifyCriticalFiles(diff.split(/\r?\n/));
    } catch (error) {
      console.error("Cannot classify PR files; running extra regression tests:", error.message);
      result = { critical: true, reasons: ["comparison error (safe default)"] };
    }
  }
  console.log("Critical regression tests:", result.critical ? "required" : "not required");
  for (const reason of result.reasons) console.log("  -", reason);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, "critical=" + result.critical + "\n");
  }
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main();
}
