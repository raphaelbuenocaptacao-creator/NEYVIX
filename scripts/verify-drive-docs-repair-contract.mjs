import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../database/003_repair_drive_docs.sql", import.meta.url), "utf8");

const checks = [
  ["repair creates Drive table idempotently", /create table if not exists drive_items/i.test(sql)],
  ["repair creates Docs table idempotently", /create table if not exists documents/i.test(sql)],
  ["Docs keeps owner isolation foreign key", /owner_user_id uuid not null references users\(id\) on delete cascade/i.test(sql)],
  ["Docs may attach to Drive safely", /drive_item_id uuid unique references drive_items\(id\) on delete set null/i.test(sql)],
  ["Drive parent relation remains scoped structurally", /parent_id uuid references drive_items\(id\) on delete cascade/i.test(sql)],
  ["Drive lookup index is idempotent", /create index if not exists idx_drive_items_owner_parent/i.test(sql)],
  ["repair contains no destructive DROP", !/\bdrop\b/i.test(sql.replace(/--.*$/gm, ""))],
  ["repair contains no TRUNCATE", !/\btruncate\b/i.test(sql.replace(/--.*$/gm, ""))],
  ["repair contains no DELETE or UPDATE data mutation", !/\b(delete|update)\b/i.test(sql.replace(/--.*$/gm, ""))],
  ["Drive is created before Docs dependency", sql.toLowerCase().indexOf("create table if not exists drive_items") < sql.toLowerCase().indexOf("create table if not exists documents")],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("NEYVIX Drive/Docs repair contract FAIL:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`NEYVIX Drive/Docs repair contract PASS: ${checks.length} checks verified.`);
