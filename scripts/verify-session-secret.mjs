import { readFileSync } from "node:fs";

const auth = readFileSync("lib/auth.ts", "utf8");

for (const required of [
  'process.env.NEYVIX_SESSION_SECRET?.trim()',
  'NEYVIX_SESSION_SECRET is required in production',
  'source: "missing" as const',
]) {
  if (!auth.includes(required)) {
    console.error(`NEYVIX session-secret check failed: missing contract ${required}`);
    process.exit(1);
  }
}

if (auth.includes('source: "database_derived"') || auth.includes('NEYVIX_SESSION_KEY_V1')) {
  console.error("NEYVIX session-secret check failed: production session secret must not be derived from DATABASE_URL.");
  process.exit(1);
}

console.log("NEYVIX session-secret check PASS: production requires an explicit session secret.");
