import fs from "node:fs";

const db = fs.readFileSync("lib/memory-db.ts", "utf8");
const route = fs.readFileSync("app/api/memory/privacy/route.ts", "utf8");
const page = fs.readFileSync("app/memory/page.tsx", "utf8");

const checks = [
  ["owner scoped by email", db.includes("lower(u.email) = ${email.trim().toLowerCase()}" )],
  ["active account required", db.includes("AND u.is_active = true")],
  ["privacy mutation is audited", db.includes("'privacy', 'user'") && db.includes("shared_with_ai")],
  ["session must be active", route.includes("readActiveSession")],
  ["AI entitlement required", route.includes('getProductAccess(session.email, "ai")')],
  ["UUID is constrained", route.includes("[1-5][0-9a-f]{3}") && route.includes("[89ab][0-9a-f]{3}")],
  ["privacy modes are allowlisted", route.includes('["private", "shared"].includes(mode)')],
  ["sensitive errors are private", route.includes('"Cache-Control": "no-store"') && route.includes('"Referrer-Policy": "no-referrer"')],
  ["UI exposes direct privacy control", page.includes('action="/api/memory/privacy"')],
  ["UI can share with AI", page.includes("Permitir na AI")],
  ["UI can return to private", page.includes("Tornar privada")],
  ["privacy event is visible", page.includes('privacy: "Permissão de uso pela AI alterada"')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`PASS ${name}`);
  else { console.error(`FAIL ${name}`); failed += 1; }
}
if (failed) process.exit(1);
console.log(`PASS memory privacy contract (${checks.length} checks)`);
