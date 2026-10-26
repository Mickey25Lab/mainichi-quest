import { pathToFileURL } from "node:url";

export function validateProductionRelease(meta, mainSha) {
  const errors = [];
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return ["Release metadata is not a JSON object"];
  if (meta.schemaVersion !== 1) errors.push("Unexpected metadata schemaVersion");
  if (meta.environment !== "production") errors.push("Cloudflare is not serving production metadata");
  if (meta.branch !== "main") errors.push("Deployment branch is not main");
  if (!/^\\d+\\.\\d+\\.\\d+$/.test(String(meta.version ?? ""))) errors.push("Invalid numeric version");
  if (!/^[a-f0-9]{40}$/.test(String(meta.commit ?? ""))) errors.push("Invalid deployment commit SHA");
  if (meta.commit !== mainSha) errors.push(`Production commit ${meta.commit ?? "missing"} differs from main ${mainSha}`);
  if (meta.releaseCommit !== meta.commit) errors.push("Production releaseCommit differs from deployment commit");
  return errors;
}

export async function checkProduction(fetcher = fetch) {
  const production = "https://mainichi-quest-63c.pages.dev/release-meta.json";
  const mainUrl = "https://api.github.com/repos/Mickey25Lab/mainichi-quest/branches/main";
  const headers = { "Accept": "application/json", "Cache-Control": "no-cache" };
  const [releaseResponse, mainResponse] = await Promise.all([
    fetcher(production + "?check=" + Date.now(), { headers, cache: "no-store" }),
    fetcher(mainUrl, { headers: { ...headers, "User-Agent": "mainichi-quest-release-monitor" }, cache: "no-store" })
  ]);
  if (!releaseResponse.ok || !mainResponse.ok) {
    throw new Error(`Release HTTP ${releaseResponse.status}; GitHub HTTP ${mainResponse.status}`);
  }
  const [release, main] = await Promise.all([releaseResponse.json(), mainResponse.json()]);
  const mainSha = main?.commit?.sha;
  if (!/^[a-f0-9]{40}$/.test(String(mainSha ?? ""))) throw Error("Invalid GitHub main SHA");
  const errors = validateProductionRelease(release, mainSha);
  if (errors.length) throw Error(errors.join("; "));
  return { version: release.version, commit: release.commit, environment: release.environment };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkProduction().then(result => {
    console.log("Cloudflare production release verified", JSON.stringify(result));
  }).catch(error => {
    console.error("::error::Cloudflare production verification failed:", error.message);
    process.exitCode = 1;
  });
}
