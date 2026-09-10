import fs from "node:fs";

const db = fs.readFileSync("lib/memory-db.ts", "utf8");
const route = fs.readFileSync("app/api/memory/route.ts", "utf8");
const page = fs.readFileSync("app/memory/page.tsx", "utf8");
const controls = fs.readFileSync("app/memory/memory-controls.tsx", "utf8");

const checks = [
  ["owner scoped by email", db.includes("lower(u.email) = ${email.trim().toLowerCase()}" )],
  ["active account required", db.includes("AND u.is_active = true")],
  ["privacy mutation is audited", db.includes("'privacy', 'user'") && db.includes("shared_with_ai")],
  ["canonical endpoint requires active session", route.includes("getMemorySession") && route.includes("if (!session)")],
  ["AI entitlement required", route.includes('getProductAccess(email, "ai")')],
  ["UUID is constrained", route.includes("[1-5][0-9a-f]{3}") && route.includes("[89ab][0-9a-f]{3}")],
  ["privacy input is boolean-only", route.includes('typeof body?.shareWithAi !== "boolean"')],
  ["sensitive responses are private", route.includes('"Cache-Control": "no-store"') && route.includes('"Referrer-Policy": "no-referrer"')],
  ["canonical privacy mutation uses PATCH", route.includes("export async function PATCH") && route.includes("setMemoryPrivacy(session.email, id, !body.shareWithAi)")],
  ["UI calls canonical Memory endpoint", controls.includes('fetch("/api/memory"') && controls.includes('method: "PATCH"')],
  ["UI validates authoritative privacy confirmation", controls.includes("payload?.ok !== true") && controls.includes("payload.id !== id") && controls.includes("payload.shareWithAi !== shareWithAi")],
  ["UI can share with AI", controls.includes("Permitir na AI")],
  ["UI can return to private", controls.includes("Tornar privada")],
  ["privacy event is visible", page.includes('privacy: "Permissão de uso pela AI alterada"')],
  ["delete remains separately confirmed", controls.includes("window.confirm") && controls.includes('method: "DELETE"')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`PASS ${name}`);
  else { console.error(`FAIL ${name}`); failed += 1; }
}
if (failed) process.exit(1);
console.log(`PASS memory privacy contract (${checks.length} checks)`);
