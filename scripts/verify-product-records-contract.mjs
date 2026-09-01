import { readFile } from "node:fs/promises";

const files = {
  db: await readFile(new URL("../lib/product-records.ts", import.meta.url), "utf8"),
  studio: await readFile(new URL("../app/api/studio/route.ts", import.meta.url), "utf8"),
  content: await readFile(new URL("../app/api/content/route.ts", import.meta.url), "utf8"),
};

const checks = [
  ["studio deletion is scoped to authenticated owner", /DELETE FROM public\.neyvix_studio_projects[\s\S]*p\.user_id = u\.id[\s\S]*u\.email = /m.test(files.db)],
  ["content deletion is scoped to authenticated owner", /DELETE FROM public\.neyvix_content_items[\s\S]*c\.user_id = u\.id[\s\S]*u\.email = /m.test(files.db)],
  ["studio DELETE requires active session", /export async function DELETE[\s\S]*getSession\(\)[\s\S]*status: 401/m.test(files.studio)],
  ["content DELETE requires active session", /export async function DELETE[\s\S]*getSession\(\)[\s\S]*status: 401/m.test(files.content)],
  ["studio DELETE enforces product entitlement", /export async function DELETE[\s\S]*ensureStudioAccess\(session\.email\)/m.test(files.studio)],
  ["content DELETE enforces product entitlement", /export async function DELETE[\s\S]*ensureContentAccess\(session\.email\)/m.test(files.content)],
  ["studio rejects malformed identifiers", /UUID_RE\.test\(id\)[\s\S]*status: 400/m.test(files.studio)],
  ["content rejects malformed identifiers", /UUID_RE\.test\(id\)[\s\S]*status: 400/m.test(files.content)],
  ["studio responses are private", /Cache-Control.*no-store[\s\S]*Referrer-Policy.*no-referrer/m.test(files.studio)],
  ["content responses are private", /Cache-Control.*no-store[\s\S]*Referrer-Policy.*no-referrer/m.test(files.content)],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log(`PASS - ${checks.length} product persistence/ownership guarantees verified`);
