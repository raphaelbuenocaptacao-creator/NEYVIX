import { readFile } from "node:fs/promises";

const files = {
  db: await readFile(new URL("../lib/drive-db.ts", import.meta.url), "utf8"),
  api: await readFile(new URL("../app/api/drive/route.ts", import.meta.url), "utf8"),
  page: await readFile(new URL("../app/drive/page.tsx", import.meta.url), "utf8"),
  layout: await readFile(new URL("../app/drive/layout.tsx", import.meta.url), "utf8"),
  ecosystem: await readFile(new URL("../app/ecosystem/page.tsx", import.meta.url), "utf8"),
  schema: await readFile(new URL("../database/002_ecosystem.sql", import.meta.url), "utf8"),
};

const checks = [
  ["drive schema exists with owner relationship", /create table if not exists drive_items[\s\S]*owner_user_id uuid not null references users\(id\)/m.test(files.schema)],
  ["drive listing is owner scoped", /listDriveItems[\s\S]*JOIN public\.users u ON u\.id = d\.owner_user_id[\s\S]*lower\(u\.email\)[\s\S]*u\.is_active = true/m.test(files.db)],
  ["folder creation resolves active owner", /createDriveFolder[\s\S]*public\.users[\s\S]*is_active = true/m.test(files.db)],
  ["nested folder creation validates parent ownership", /valid_parent[\s\S]*JOIN target_user u ON u\.id = d\.owner_user_id[\s\S]*d\.kind = 'folder'/m.test(files.db)],
  ["rename is owner scoped", /renameDriveItem[\s\S]*UPDATE public\.drive_items[\s\S]*u\.id = d\.owner_user_id[\s\S]*lower\(u\.email\)[\s\S]*u\.is_active = true/m.test(files.db)],
  ["folder deletion is owner scoped and non recursive", /deleteEmptyDriveFolder[\s\S]*d\.kind = 'folder'[\s\S]*lower\(u\.email\)[\s\S]*u\.is_active = true[\s\S]*NOT EXISTS/m.test(files.db)],
  ["drive GET requires active session", /export async function GET[\s\S]*getSession\(\)[\s\S]*status: 401/m.test(files.api)],
  ["drive POST requires active session", /export async function POST[\s\S]*getSession\(\)[\s\S]*status: 401/m.test(files.api)],
  ["drive PUT requires active session", /export async function PUT[\s\S]*getSession\(\)[\s\S]*status: 401/m.test(files.api)],
  ["drive DELETE requires active session", /export async function DELETE[\s\S]*getSession\(\)[\s\S]*status: 401/m.test(files.api)],
  ["drive validates UUID identifiers", /UUID_RE[\s\S]*UUID_RE\.test\(id\)/m.test(files.api)],
  ["drive limits names", /MAX_NAME_LENGTH = 160[\s\S]*status: 413/m.test(files.api)],
  ["drive responses are private", /Cache-Control.*no-store[\s\S]*Referrer-Policy.*no-referrer/m.test(files.api)],
  ["drive route is protected before rendering", /requireActiveSession\("\/drive"\)/.test(files.layout)],
  ["drive UI lists through private API", /fetch\(`\/api\/drive\$\{query\}`[\s\S]*cache: "no-store"/m.test(files.page)],
  ["drive UI creates nested folders", /method: "POST"[\s\S]*parentId: currentParent/m.test(files.page)],
  ["drive UI supports rename", /method: "PUT"[\s\S]*id: item\.id[\s\S]*name/m.test(files.page)],
  ["drive UI only requests safe folder deletion", /method: "DELETE"[\s\S]*id: item\.id/m.test(files.page)],
  ["drive UI handles loading error empty and success feedback", /styles\.loading[\s\S]*role="alert"[\s\S]*role="status"[\s\S]*styles\.emptyState/m.test(files.page)],
  ["ecosystem exposes Drive as MVP with live route", /NEYVIX Drive", status: "MVP"[\s\S]*href: "\/drive"/m.test(files.ecosystem)],
  ["drive clearly labels binary upload as unavailable", /Upload binário ainda não está habilitado/.test(files.page)],
  ["drive does not expose binary upload yet", !/multipart\/form-data|putBlob|uploadFile|storage provider/i.test(files.api)],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`PASS - ${checks.length} Drive persistence/ownership/UI guarantees verified`);
