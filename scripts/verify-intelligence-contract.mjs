import fs from "node:fs";

const route = fs.readFileSync("app/api/ai/route.ts", "utf8");
const health = fs.readFileSync("app/api/health/intelligence/route.ts", "utf8");
const memory = fs.readFileSync("lib/memory-db.ts", "utf8");

const checks = [
  ["gateway requires HTTPS", route.includes('parsed.protocol !== "https:"')],
  ["gateway secret is mandatory", route.includes("if (!url || !secret) return null")],
  ["gateway always authenticates upstream", route.includes('"Authorization": `Bearer ${gateway.secret}`')],
  ["private AI responses disable caching", route.includes('"Cache-Control": "no-store, max-age=0"')],
  ["AI responses suppress referrer leakage", route.includes('"Referrer-Policy": "no-referrer"')],
  ["gateway errors do not log upstream body", route.includes('console.error("NEYVIX AI gateway error", upstream.status);') && !route.includes("text.slice(0, 500)")],
  ["health readiness requires URL and secret", health.includes("gatewayConfigured = gatewayUrlConfigured && gatewaySecretConfigured")],
  ["memory context is explicit opt-in", route.includes('useMemory && process.env.NEYVIX_MEMORY_AI_CONTEXT === "true"')],
  ["AI memory excludes private records", memory.includes("AND m.is_private = false")],
  ["AI memory is scoped to the active user", memory.includes("WHERE lower(u.email) = ${email.trim().toLowerCase()}") && memory.includes("AND u.is_active = true")],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log(`NEYVIX intelligence contract: ${checks.length}/${checks.length} PASS`);
