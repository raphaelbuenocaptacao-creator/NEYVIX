import fs from "node:fs";

const db = fs.readFileSync("lib/automation-db.ts", "utf8");
const route = fs.readFileSync("app/api/automation/approvals/[id]/route.ts", "utf8");

const checks = [
  ["decision requires pending state", /r\.status\s*=\s*'pending'/],
  ["decision binds authenticated email", /lower\(u\.email\)\s*=\s*\$\{normalizedEmail\}/],
  ["decision requires active user", /COALESCE\(u\.is_active, true\)\s*=\s*true/],
  ["assigned approvals require matching assignee", /r\.assigned_to\s*=\s*u\.id/],
  ["unassigned approvals require requester ownership", /r\.assigned_to IS NULL AND r\.requested_by = u\.id/],
  ["arbitrary unassigned approval is not allowed", !/r\.assigned_to IS NULL\s*\)/.test(db)],
  ["route requires active session", /if \(!session\).*status:\s*401/s.test(route)],
  ["route checks approvals entitlement", /getProductAccess\(session\.email,\s*"approvals"\)/.test(route)],
  ["route restricts decision values", /decision !== "approved" && decision !== "rejected"/.test(route)],
  ["forbidden or missing approval is not disclosed as success", /not_found_or_forbidden/.test(route)],
];

let failed = 0;
for (const [name, matcher] of checks) {
  const ok = typeof matcher === "boolean" ? matcher : matcher.test(db);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`Approval authorization contract failed: ${failed}/${checks.length}`);
  process.exit(1);
}

console.log(`Approval authorization contract passed: ${checks.length}/${checks.length}`);
