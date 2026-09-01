import { readFile } from "node:fs/promises";

const files = {
  db: await readFile(new URL("../lib/product-records.ts", import.meta.url), "utf8"),
  studio: await readFile(new URL("../app/api/studio/route.ts", import.meta.url), "utf8"),
  studioPage: await readFile(new URL("../app/studio/page.tsx", import.meta.url), "utf8"),
  content: await readFile(new URL("../app/api/content/route.ts", import.meta.url), "utf8"),
  contentPage: await readFile(new URL("../app/content/page.tsx", import.meta.url), "utf8"),
};

const checks = [
  ["studio deletion is scoped to authenticated owner", /DELETE FROM public\.neyvix_studio_projects[\s\S]*p\.user_id = u\.id[\s\S]*u\.email = /m.test(files.db)],
  ["content deletion is scoped to authenticated owner", /DELETE FROM public\.neyvix_content_items[\s\S]*c\.user_id = u\.id[\s\S]*u\.email = /m.test(files.db)],
  ["destructive product operations require active database account", /deleteStudioProject[\s\S]*u\.is_active = true[\s\S]*deleteContentItem[\s\S]*u\.is_active = true/m.test(files.db)],
  ["studio rename is owner scoped", /updateStudioProjectTitle[\s\S]*UPDATE public\.neyvix_studio_projects[\s\S]*p\.user_id = u\.id[\s\S]*lower\(u\.email\)[\s\S]*u\.is_active = true/m.test(files.db)],
  ["content editing is owner scoped", /updateContentItem[\s\S]*UPDATE public\.neyvix_content_items[\s\S]*c\.user_id = u\.id[\s\S]*lower\(u\.email\)[\s\S]*u\.is_active = true/m.test(files.db)],
  ["studio DELETE requires active session", /export async function DELETE[\s\S]*getSession\(\)[\s\S]*status: 401/m.test(files.studio)],
  ["studio PUT requires active session", /export async function PUT[\s\S]*getSession\(\)[\s\S]*status: 401/m.test(files.studio)],
  ["content DELETE requires active session", /export async function DELETE[\s\S]*getSession\(\)[\s\S]*status: 401/m.test(files.content)],
  ["content PUT requires active session", /export async function PUT[\s\S]*getSession\(\)[\s\S]*status: 401/m.test(files.content)],
  ["studio DELETE enforces product entitlement", /export async function DELETE[\s\S]*ensureStudioAccess\(session\.email\)/m.test(files.studio)],
  ["studio PUT enforces product entitlement", /export async function PUT[\s\S]*ensureStudioAccess\(session\.email\)/m.test(files.studio)],
  ["content DELETE enforces product entitlement", /export async function DELETE[\s\S]*ensureContentAccess\(session\.email\)/m.test(files.content)],
  ["content PUT enforces product entitlement", /export async function PUT[\s\S]*ensureContentAccess\(session\.email\)/m.test(files.content)],
  ["studio rejects malformed identifiers", /UUID_RE\.test\(id\)[\s\S]*status: 400/m.test(files.studio)],
  ["studio rename rejects empty and oversized titles", /export async function PUT[\s\S]*!title[\s\S]*MAX_TITLE_LENGTH[\s\S]*status: 413/m.test(files.studio)],
  ["content rejects malformed identifiers", /UUID_RE\.test\(id\)[\s\S]*status: 400/m.test(files.content)],
  ["content edit rejects empty and oversized values", /export async function PUT[\s\S]*!content[\s\S]*MAX_CONTENT_LENGTH[\s\S]*status: 413/m.test(files.content)],
  ["studio responses are private", /Cache-Control.*no-store[\s\S]*Referrer-Policy.*no-referrer/m.test(files.studio)],
  ["content responses are private", /Cache-Control.*no-store[\s\S]*Referrer-Policy.*no-referrer/m.test(files.content)],
  ["studio library exposes rename action", /beginRename\(item\)[\s\S]*>Renomear</m.test(files.studioPage)],
  ["studio library saves rename through PUT", /method: "PUT"[\s\S]*JSON\.stringify\(\{ id: item\.id, title: clean \}\)/m.test(files.studioPage)],
  ["studio rename gives accessible feedback", /role="alert"[\s\S]*aria-live="assertive"[\s\S]*aria-live="polite"/m.test(files.studioPage)],
  ["content library exposes edit action", /beginEdit\(item\)[\s\S]*>Editar</m.test(files.contentPage)],
  ["content library saves through PUT", /method: "PUT"[\s\S]*JSON\.stringify\(\{ id: item\.id, content: clean \}\)/m.test(files.contentPage)],
  ["content edit gives accessible feedback", /role="alert"[\s\S]*aria-live="assertive"/m.test(files.contentPage)],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log(`PASS - ${checks.length} product persistence/ownership guarantees verified`);
