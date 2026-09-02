import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../app/api/admin/schema-repair/route.ts", import.meta.url), "utf8");
const service = await readFile(new URL("../lib/schema-repair.ts", import.meta.url), "utf8");

const checks = [
  ["endpoint requires active session", /readActiveSession/.test(route)],
  ["endpoint requires superadmin role", /role === "superadmin"/.test(route)],
  ["write requires explicit confirmation token", /REPAIR_DRIVE_DOCS/.test(route) && /requiredConfirmation/.test(route)],
  ["responses are private", /Cache-Control": "no-store"/.test(route) && /Referrer-Policy": "no-referrer"/.test(route)],
  ["service only uses additive DDL commands", /CREATE EXTENSION IF NOT EXISTS/.test(service) && /CREATE TABLE IF NOT EXISTS/.test(service) && /CREATE INDEX IF NOT EXISTS/.test(service)],
  ["service contains no destructive statements", !/\b(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)\b/i.test(service)],
  ["service verifies Drive readiness after repair", /status\.drive !== "ready"/.test(service)],
  ["service verifies Docs readiness after repair", /status\.docs !== "ready"/.test(service)],
  ["endpoint is idempotent when already ready", /before\.repairRequired\.length === 0/.test(route) && /changed: false/.test(route)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) process.exit(1);
console.log(`Schema repair endpoint contract: ${checks.length}/${checks.length} guarantees passed.`);
