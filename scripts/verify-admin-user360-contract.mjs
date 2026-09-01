import { readFileSync } from "node:fs";

const role = readFileSync("lib/user-role.ts", "utf8");
const admin = readFileSync("app/admin/page.tsx", "utf8");

const checks = [
  ["User 360 has a dedicated least-privilege gate", role.includes("export function canInspectUser360")],
  ["CRO is excluded from User 360 detail access", role.includes('return role === "admin" || role === "superadmin"')],
  ["Admin page uses active sessions", admin.includes("readActiveSession")],
  ["Admin page still checks admin-area authorization", admin.includes("canAccessAdmin(role)")],
  ["Admin page evaluates User 360 authorization", admin.includes("canInspectUser360(role)")],
  ["Detailed user summaries are only loaded when authorized", admin.includes("canInspectUsers ? getAdminUserSummaries() : Promise.resolve([])")],
  ["UserInspector is rendered conditionally", admin.includes("canInspectUsers ? (") && admin.includes("<UserInspector users={users} />")],
  ["Restricted roles receive an explicit privacy state", admin.includes("USER 360 · ACESSO RESTRITO")],
  ["Operational telemetry remains available separately", admin.includes("getAdminSystemSummary()")],
  ["Restricted User 360 is represented as restricted, not healthy", admin.includes('canInspectUsers ? (system?.activeWithoutSubscription') && admin.includes(': "Restrito"')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`Admin/User 360 authorization contract failed: ${failed}/${checks.length}`);
  process.exit(1);
}

console.log(`Admin/User 360 authorization contract passed: ${checks.length}/${checks.length}`);
