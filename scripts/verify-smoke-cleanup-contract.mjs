import fs from "node:fs";

const db = fs.readFileSync("lib/smoke-user-db.ts", "utf8");
const route = fs.readFileSync("app/api/auth/smoke-cleanup/route.ts", "utf8");
const driveWorkflow = fs.readFileSync(".github/workflows/drive-docs-e2e-smoke.yml", "utf8");
const businessWorkflow = fs.readFileSync(".github/workflows/business-entitlement-negative-e2e-smoke.yml", "utf8");

const checks = [
  [
    "smoke identity namespaces are strict and explicit",
    db.includes("^(?:e2e-smoke|business-negative)-[a-z0-9-]+@neyvix\\.com$") &&
      !db.includes("@gmail.com") &&
      !db.includes(".*@neyvix\\.com"),
  ],
  ["cleanup allows the standard e2e namespace", db.includes("e2e-smoke|business-negative")],
  ["cleanup allows the Business-negative namespace", db.includes("business-negative")],
  ["cleanup refuses non-smoke identities", db.includes("if (!isSmokeAccountEmail(normalizedEmail)) return false")],
  ["cleanup detects optional loans relation without querying it", db.includes("to_regclass('public.loans')")],
  ["cleanup fails closed if loans relation appears", db.includes("if (relations[0]?.loans_table) return false")],
  ["cleanup never directly reads the absent loans table", !/FROM\s+public\.loans/i.test(db)],
  ["user delete stays bound to exact normalized email", db.includes("WHERE u.email = ${normalizedEmail}")],
  ["superadmin identities cannot be removed", db.includes("u.is_superadmin = false")],
  ["endpoint requires an active session", route.includes("readActiveSession") && route.includes("if (!session)")],
  ["endpoint independently rechecks smoke identity", route.includes("isSmokeAccountEmail(session.email)")],
  ["drive workflow always attempts cleanup on shell exit", driveWorkflow.includes("trap cleanup EXIT")],
  ["drive workflow requires explicit successful cleanup on PASS", driveWorkflow.includes("smoke-account-cleanup-status") && driveWorkflow.includes("smoke-account-cleanup-payload")],
  ["Business-negative workflow always attempts cleanup on shell exit", businessWorkflow.includes("trap cleanup EXIT")],
  ["Business-negative workflow uses only its dedicated technical namespace", businessWorkflow.includes("business-negative-")],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
if (failed.length) {
  console.error(`Smoke cleanup contract failed: ${failed.map(([name]) => name).join(", ")}`);
  process.exit(1);
}
console.log(`Smoke cleanup contract passed (${checks.length} checks).`);
