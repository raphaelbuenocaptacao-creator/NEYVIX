import fs from "node:fs";

const route = fs.readFileSync("app/api/health/route.ts", "utf8");

const checks = [
  [
    "public status follows full ecosystem readiness",
    /status:\s*ecosystemReady\s*\?\s*["']operacional["']\s*:\s*["']degradado["']/,
  ],
  [
    "ecosystem readiness remains explicit",
    /ecosystem:\s*ecosystemReady/,
  ],
  [
    "launchReady mirrors ecosystem readiness",
    /launchReady:\s*ecosystemReady/,
  ],
  [
    "HTTP liveness remains tied to access readiness",
    /status:\s*accessReady\s*\?\s*200\s*:\s*503/,
  ],
  [
    "health responses remain non-cacheable",
    /["']Cache-Control["']:\s*["']no-store["']/,
  ],
];

const failures = checks.filter(([, pattern]) => !pattern.test(route));

if (failures.length) {
  console.error("Health readiness truth contract failed:");
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`Health readiness truth contract PASS (${checks.length}/${checks.length})`);
