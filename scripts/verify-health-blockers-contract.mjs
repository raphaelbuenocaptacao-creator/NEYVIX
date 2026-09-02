import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8");

const checks = [
  ["health exposes blockers", /blockers,/.test(route)],
  ["database failures are surfaced", /database:\$\{health\.database\}/.test(route)],
  ["project failures are surfaced", /project:\$\{health\.project\}/.test(route)],
  ["auth schema failures are surfaced", /auth_schema:\$\{health\.auth\.schema\}/.test(route)],
  ["dedicated production session secret is enforced", /auth_session_secret:dedicated_required/.test(route)],
  ["Drive schema status is surfaced", /schema:drive:\$\{health\.schema\.drive\}/.test(route)],
  ["Docs schema status is surfaced", /schema:docs:\$\{health\.schema\.docs\}/.test(route)],
  ["repair targets are surfaced without SQL", /schema_repair:\$\{table\}/.test(route)],
  ["AI integration blocker is surfaced", /integration:ai_gateway/.test(route)],
  ["billing integration blocker is surfaced", /integration:billing_webhook/.test(route)],
  ["mail integration blockers are surfaced", /integration:mail_transport/.test(route) && /integration:mail_inbound/.test(route)],
  ["storage integration blocker is surfaced", /integration:storage/.test(route)],
  ["blockers are machine-readable strings", /filter\(\(value\): value is string => Boolean\(value\)\)/.test(route)],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("NEYVIX health blockers contract FAIL:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`NEYVIX health blockers contract PASS: ${checks.length} checks verified.`);
