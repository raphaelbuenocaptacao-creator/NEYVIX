import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../app/api/admin/schema-repair/route.ts", import.meta.url), "utf8");
const service = await readFile(new URL("../lib/schema-repair.ts", import.meta.url), "utf8");

// Contract safety scans must inspect executable source, not prose in comments.
// This avoids false positives such as a safety comment that names forbidden verbs.
const executableService = service
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const checks = [
  ["endpoint requires active session", /readActiveSession/.test(route)],
  ["endpoint requires superadmin role", /role === "superadmin"/.test(route)],
  ["write requires explicit confirmation token", /REPAIR_DRIVE_DOCS/.test(route) && /requiredConfirmation/.test(route)],
  ["responses are private", /Cache-Control": "no-store"/.test(route) && /Referrer-Policy": "no-referrer"/.test(route)],
  ["service only uses additive DDL commands", /CREATE EXTENSION IF NOT EXISTS/.test(executableService) && /CREATE TABLE IF NOT EXISTS/.test(executableService) && /CREATE INDEX IF NOT EXISTS/.test(executableService)],
  ["service contains no destructive statements", !/\b(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)\b/i.test(executableService)],
  ["service verifies Drive readiness after repair", /status\.drive !== "ready"/.test(service)],
  ["service verifies Docs readiness after repair", /status\.docs !== "ready"/.test(service)],
  ["endpoint is idempotent when already ready", /before\.repairRequired\.length === 0/.test(route) && /changed: false/.test(route)],
  ["partial schema is never advertised as executable", /!partialSchema/.test(route) && /blockedReason: partialSchema \? PARTIAL_SCHEMA_CODE : null/.test(route)],
  ["partial schema write is refused explicitly", /hasPartialSchema\(before\)/.test(route) && /status: 409/.test(route)],
  ["partial schema refusal has stable machine code", /PARTIAL_SCHEMA_REQUIRES_MANUAL_REPAIR/.test(route)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) process.exit(1);
console.log(`Schema repair endpoint contract: ${checks.length}/${checks.length} guarantees passed.`);
