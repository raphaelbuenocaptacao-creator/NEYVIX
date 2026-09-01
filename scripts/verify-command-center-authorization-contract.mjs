import { readFileSync } from "node:fs";

const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");
const role = readFileSync("lib/user-role.ts", "utf8");

const checks = [
  ["Command Center uses active sessions", dashboard.includes("readActiveSession")],
  ["Dashboard resolves the persisted user role", dashboard.includes("getUserRole(session.email)")],
  ["Admin visibility uses role authorization", dashboard.includes("const adminAllowed = canAccessAdmin(role)")],
  ["Admin card is hidden when role is unauthorized", dashboard.includes('modules.filter(([name]) => name !== "Admin" || adminAllowed)')],
  ["Admin access is not incorrectly tied to subscription entitlement", dashboard.includes('name === "Admin" ? adminAllowed')],
  ["AI command honors entitlement", dashboard.includes('const aiAllowed = canUse(entitlements, "ai")')],
  ["AI command falls back to plans when blocked", dashboard.includes('href={aiAllowed ? "/ai" : "/plans"}')],
  ["Quick commands are entitlement-aware", dashboard.includes("quickCommands.map") && dashboard.includes("canUse(entitlements, feature as EntitlementFeature)")],
  ["Blocked quick commands route to plans", dashboard.includes('href={allowed ? href : "/plans"}')],
  ["Role layer keeps explicit admin-area authorization", role.includes("export function canAccessAdmin")],
  ["Member remains excluded from admin authorization", role.includes('return role === "cro" || role === "admin" || role === "superadmin"')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`Command Center authorization contract failed: ${failed}/${checks.length}`);
  process.exit(1);
}

console.log(`Command Center authorization contract passed: ${checks.length}/${checks.length}`);
