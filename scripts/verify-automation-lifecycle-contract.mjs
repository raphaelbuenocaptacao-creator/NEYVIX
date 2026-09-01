import fs from "node:fs";

const db = fs.readFileSync("lib/automation-db.ts", "utf8");
const route = fs.readFileSync("app/api/automation/route.ts", "utf8");
const page = fs.readFileSync("app/automation/page.tsx", "utf8");
const list = fs.readFileSync("components/automation-list.tsx", "utf8");

const checks = [
  ["delete automation is implemented", /export async function deleteAutomation\(/.test(db)],
  ["delete binds automation to user row", /a\.user_id\s*=\s*u\.id/.test(db)],
  ["delete binds authenticated email", /lower\(u\.email\)\s*=\s*\$\{normalizedEmail\}/.test(db)],
  ["delete requires active user", /COALESCE\(u\.is_active, true\)\s*=\s*true/.test(db)],
  ["delete route requires active session", /export async function DELETE[\s\S]*if \(!session\)[\s\S]*status:\s*401/.test(route)],
  ["delete route checks automation entitlement", /export async function DELETE[\s\S]*checkAccess\(session\.email\)/.test(route)],
  ["delete route validates UUID", /UUID_RE\.test\(id\)/.test(route)],
  ["automation API responses are private", /Referrer-Policy":\s*"no-referrer"/.test(route) && /Cache-Control":\s*"no-store"/.test(route)],
  ["workspace page revalidates active session", /readActiveSession/.test(page) && !/\breadSession\(/.test(page)],
  ["workspace exposes owner delete flow", /<AutomationList\s+automations=\{workspace\.automations\}/.test(page) && /method:\s*"DELETE"/.test(list)],
  ["delete experience asks for confirmation", /window\.confirm\(/.test(list)],
  ["delete experience refreshes verified server state", /router\.refresh\(\)/.test(list)],
  ["delete feedback is accessible", /role="status"/.test(list) && /aria-live="polite"/.test(list) && /aria-busy=/.test(list)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`Automation lifecycle contract failed: ${failed}/${checks.length}`);
  process.exit(1);
}

console.log(`Automation lifecycle contract passed: ${checks.length}/${checks.length}`);
