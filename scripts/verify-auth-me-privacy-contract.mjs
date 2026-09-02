import fs from "node:fs";

const route = fs.readFileSync("app/api/auth/me/route.ts", "utf8");

const checks = [
  ["private responses disable storage", /["']Cache-Control["']\s*:\s*["']no-store["']/.test(route)],
  ["private responses suppress referrers", /["']Referrer-Policy["']\s*:\s*["']no-referrer["']/.test(route)],
  ["anonymous identity reads are rejected", /status\s*:\s*401/.test(route)],
  ["anonymous response has stable error code", /error\s*:\s*["']unauthorized["']/.test(route)],
  ["successful identity response remains non-cacheable", /headers\s*:\s*PRIVATE_RESPONSE_HEADERS/.test(route)],
  ["auth configuration failures remain explicit", /status\s*:\s*503/.test(route) && /auth_not_configured/.test(route)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} auth/me privacy: ${name}`);
}

if (failed.length) {
  console.error(`Auth/me privacy contract failed: ${failed.map(([name]) => name).join(", ")}`);
  process.exit(1);
}
