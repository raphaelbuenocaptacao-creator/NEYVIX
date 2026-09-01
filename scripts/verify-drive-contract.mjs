import { readFile } from "node:fs/promises";

const files = {
  db: await readFile(new URL("../lib/drive-db.ts", import.meta.url), "utf8"),
  api: await readFile(new URL("../app/api/drive/route.ts", import.meta.url), "utf8"),
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
  ["drive does not expose binary upload yet", !/multipart\/form-data|putBlob|uploadFile|storage provider/i.test(files.api)],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`PASS - ${checks.length} Drive persistence/ownership guarantees verified`);
