import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../database/014_repair_drive_docs.sql", import.meta.url), "utf8");
const executableSql = sql.replace(/--.*$/gm, "");

const checks = [
  ["repair creates Drive table idempotently", /create table if not exists drive_items/i.test(sql)],
  ["repair creates Docs table idempotently", /create table if not exists documents/i.test(sql)],
  ["Docs keeps owner isolation foreign key", /owner_user_id uuid not null references users\(id\) on delete cascade/i.test(sql)],
  ["Docs may attach to Drive safely", /drive_item_id uuid unique references drive_items\(id\) on delete set null/i.test(sql)],
  ["Drive parent relation remains scoped structurally", /parent_id uuid references drive_items\(id\) on delete cascade/i.test(sql)],
  ["Drive lookup index is idempotent", /create index if not exists idx_drive_items_owner_parent/i.test(sql)],
  ["repair contains no destructive DROP statement", !/^\s*drop\b/im.test(executableSql)],
  ["repair contains no TRUNCATE statement", !/^\s*truncate\b/im.test(executableSql)],
  ["repair contains no DELETE data mutation", !/^\s*delete\s+from\b/im.test(executableSql)],
  ["repair contains no UPDATE data mutation", !/^\s*update\s+[^\n]+\s+set\b/im.test(executableSql)],
  ["Drive is created before Docs dependency", sql.toLowerCase().indexOf("create table if not exists drive_items") < sql.toLowerCase().indexOf("create table if not exists documents")],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("NEYVIX Drive/Docs repair contract FAIL:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`NEYVIX Drive/Docs repair contract PASS: ${checks.length} checks verified.`);
