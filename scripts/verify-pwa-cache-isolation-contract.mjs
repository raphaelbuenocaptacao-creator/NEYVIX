import fs from "node:fs";

const source = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

const checks = [
  ["NEYVIX owns a namespaced cache", /CACHE_PREFIX\s*=\s*["']neyvix-shell-["']/.test(source)],
  ["root document is not pre-cached", !/const\s+SHELL\s*=\s*\[[\s\S]*?["']\/["'][\s\S]*?\]/m.test(source)],
  ["navigation is handled explicitly", /request\.mode\s*===\s*["']navigate["']/.test(source)],
  ["navigation fetch bypasses HTTP cache", /fetch\(request,\s*\{\s*cache:\s*["']no-store["']\s*\}\)/.test(source)],
  ["navigation has no cached root fallback", !/caches\.match\(["']\/["']\)/.test(source)],
  ["authorization requests bypass SW cache", /request\.headers\.has\(["']authorization["']\)/.test(source)],
  ["cookie requests bypass SW cache", /request\.headers\.has\(["']cookie["']\)/.test(source)],
  ["range requests bypass SW cache", /request\.headers\.has\(["']range["']\)/.test(source)],
  ["cross-origin requests bypass SW cache", /url\.origin\s*!==\s*self\.location\.origin/.test(source)],
  ["sensitive query parameters bypass SW cache", /SENSITIVE_QUERY/.test(source) && /hasSensitiveQuery\(url\)/.test(source)],
  ["private routes include API and auth surfaces", /PRIVATE_PATH[^\n]*api[^\n]*auth/i.test(source)],
  ["activation only deletes NEYVIX-owned caches", /key\.startsWith\(CACHE_PREFIX\)/.test(source)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}`);
  if (!pass) failed += 1;
}

if (failed) {
  console.error(`\nPWA cache isolation contract failed: ${failed}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`\nPWA cache isolation contract passed: ${checks.length}/${checks.length}.`);
