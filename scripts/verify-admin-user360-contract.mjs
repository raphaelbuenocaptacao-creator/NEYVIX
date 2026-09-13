import { readFileSync } from "node:fs";

const role = readFileSync("lib/user-role.ts", "utf8");
const admin = readFileSync("app/admin/page.tsx", "utf8");
const inspector = readFileSync("app/admin/UserInspector.tsx", "utf8");
const detailApi = readFileSync("app/api/admin/user360/route.ts", "utf8");
const directory = readFileSync("lib/admin-user360.ts", "utf8");
const health = readFileSync("lib/admin-user360-health.ts", "utf8");
const healthRoute = readFileSync("app/api/health/admin-user360/route.ts", "utf8");

const checks = [
  ["User 360 has a dedicated least-privilege gate", role.includes("export function canInspectUser360")],
  ["CRO is excluded from User 360 detail access", role.includes('return role === "admin" || role === "superadmin"')],
  ["Admin page uses active sessions", admin.includes("readActiveSession")],
  ["Admin page still checks admin-area authorization", admin.includes("canAccessAdmin(role)")],
  ["Admin page evaluates User 360 authorization", admin.includes("canInspectUser360(role)")],
  ["User directory is only loaded when authorized", admin.includes("canInspectUsers ? getAdminUserDirectory(")],
  ["UserInspector is rendered conditionally", admin.includes("canInspectUsers ? (") && admin.includes("<UserInspector users={users} />")],
  ["Restricted roles receive an explicit privacy state", admin.includes("USER 360 · ACESSO RESTRITO")],
  ["Operational telemetry remains available separately", admin.includes("getAdminSystemSummary()")],
  ["Restricted User 360 is represented as restricted, not healthy", admin.includes('canInspectUsers ? (system?.activeWithoutSubscription') && admin.includes(': "Restrito"')],
  ["User 360 detail is fetched on demand", inspector.includes("/api/admin/user360?id=") && inspector.includes("AbortController")],
  ["User 360 detail API requires an active session", detailApi.includes("readActiveSession")],
  ["User 360 detail API enforces least privilege", detailApi.includes("canInspectUser360(role)")],
  ["User 360 detail API disables shared caching", detailApi.includes('Cache-Control') && detailApi.includes('no-store')],
  ["User directory accepts a bounded server-side search query", directory.includes("query = \"\"") && directory.includes("normalizedQuery")],
  ["User directory searches name, email and exact ID without loading the full base", directory.includes("ILIKE") && directory.includes("u.email") && directory.includes("u.id::text") && directory.includes("LIMIT ${boundedLimit}")],
  ["Admin page passes the search term only through the authorized directory path", admin.includes("searchParams") && admin.includes("getAdminUserDirectory(userQuery)")],
  ["Admin User 360 exposes a GET search form with a named q field", admin.includes('method="get"') && admin.includes('name="q"') && admin.includes("Buscar usuário")],
  ["User 360 health verifies runtime dependency tables", health.includes("users") && health.includes("subscriptions") && health.includes("neyvix_ai_messages") && health.includes("neyvix_studio_projects") && health.includes("neyvix_content_items") && health.includes("neyvix_estate_sites") && health.includes("neyvix_automations") && health.includes("neyvix_approval_requests")],
  ["User 360 health is fail closed on missing database configuration", health.includes('database: "not_configured"') && health.includes("ready: false")],
  ["User 360 exposes a canonical no-store health route", healthRoute.includes("getAdminUser360Health") && healthRoute.includes('service: "neyvix-admin-user360"') && healthRoute.includes('Cache-Control') && healthRoute.includes('no-store')],
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
