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
  ["status transition is implemented", /export async function updateAutomationStatus\(/.test(db)],
  ["status transition binds owner and active account", /UPDATE public\.neyvix_automations a[\s\S]*a\.user_id\s*=\s*u\.id[\s\S]*lower\(u\.email\)[\s\S]*COALESCE\(u\.is_active, true\)\s*=\s*true/.test(db)],
  ["status transition cannot mutate archived records", /a\.status IN \('draft', 'active', 'paused'\)/.test(db)],
  ["status route requires active session and entitlement", /export async function PATCH[\s\S]*if \(!session\)[\s\S]*checkAccess\(session\.email\)/.test(route)],
  ["status route validates UUID", /export async function PATCH[\s\S]*UUID_RE\.test\(id\)/.test(route)],
  ["status route allowlists active and paused only", /ALLOWED_STATUS_UPDATES = new Set\(\["active", "paused"\]\)/.test(route)],
  ["rename is implemented", /export async function renameAutomation\(/.test(db)],
  ["rename binds owner and active account", /export async function renameAutomation[\s\S]*a\.user_id\s*=\s*u\.id[\s\S]*lower\(u\.email\)[\s\S]*COALESCE\(u\.is_active, true\)\s*=\s*true/.test(db)],
  ["rename cannot mutate archived records", /export async function renameAutomation[\s\S]*a\.status IN \('draft', 'active', 'paused'\)/.test(db)],
  ["rename route requires active session and entitlement", /export async function PUT[\s\S]*if \(!session\)[\s\S]*checkAccess\(session\.email\)/.test(route)],
  ["rename route validates UUID", /export async function PUT[\s\S]*UUID_RE\.test\(id\)/.test(route)],
  ["rename route enforces name bounds", /export async function PUT[\s\S]*!name[\s\S]*name\.length > MAX_NAME/.test(route)],
  ["automation API responses are private", /Referrer-Policy":\s*"no-referrer"/.test(route) && /Cache-Control":\s*"no-store"/.test(route)],
  ["upgrade response remains private", /status:\s*402[\s\S]*Referrer-Policy":\s*"no-referrer"/.test(route)],
  ["workspace page revalidates active session", /readActiveSession/.test(page) && !/\breadSession\(/.test(page)],
  ["workspace exposes owner delete flow", /<AutomationList\s+automations=\{workspace\.automations\}/.test(page) && /method:\s*"DELETE"/.test(list)],
  ["workspace exposes pause and activate flow", /method:\s*"PATCH"/.test(list) && /"Pausar"/.test(list) && /"Ativar"/.test(list)],
  ["workspace exposes rename flow", /method:\s*"PUT"/.test(list) && /"Renomear"/.test(list) && /window\.prompt\(/.test(list)],
  ["archived automation has no rename or status mutation control", /automation\.status !== "archived"/.test(list)],
  ["delete experience asks for confirmation", /window\.confirm\(/.test(list)],
  ["mutations refresh verified server state", /router\.refresh\(\)/.test(list)],
  ["mutation feedback is accessible", /role="status"/.test(list) && /aria-live="polite"/.test(list) && /aria-busy=/.test(list)],
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
