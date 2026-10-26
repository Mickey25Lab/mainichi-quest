const origin = "https://mainichi-quest-63c.pages.dev";
const paths = [
  ["/", "no-cache"],
  ["/index.html", "no-cache"],
  ["/app.js", "no-cache"],
  ["/styles.css", "no-cache"],
  ["/scripts/level-system.js", "no-cache"],
  ["/manifest.webmanifest", "no-cache"],
  ["/release-meta.json", "no-store"],
  ["/preview-meta.json", "no-store"]
];

export function validateCachePolicy(path, header, required) {
  const directives = String(header || "").toLowerCase().split(",").map(x => x.trim());
  if (!directives.includes(required)) return `${path}: Cache-Control must include ${required}; got ${header || "(missing)"}`;
  return null;
}

export async function verifyHeaders(fetcher = fetch, baseUrl = origin) {
  const errors = [];
  for (const [path, required] of paths) {
    const response = await fetcher(baseUrl + path, { cache: "no-store" });
    if (!response.ok) {
      errors.push(`${path}: HTTP ${response.status}`);
      continue;
    }
    const error = validateCachePolicy(path, response.headers.get("cache-control"), required);
    if (error) errors.push(error);
    console.log(`${path}: HTTP ${response.status}, Cache-Control=${response.headers.get("cache-control")}`);
  }
  if (errors.length) throw Error(errors.join("\n"));
  console.log("Cloudflare production cache policy verified.");
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  verifyHeaders().catch(error => { console.error("::error::" + error.message); process.exitCode = 1; });
}
