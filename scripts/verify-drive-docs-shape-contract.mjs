import { readFile } from "node:fs/promises";

const health = await readFile(new URL("../lib/health.ts", import.meta.url), "utf8");
const repair = await readFile(new URL("../lib/schema-repair.ts", import.meta.url), "utf8");

const requiredDrive = [
  "id", "owner_user_id", "parent_id", "kind", "name", "mime_type", "size_bytes", "storage_key", "metadata", "created_at", "updated_at",
];
const requiredDocs = [
  "id", "owner_user_id", "drive_item_id", "title", "content", "version", "created_at", "updated_at",
];

const checks = [
  ["health exposes partial Drive/Docs state", /drive:\s*"ready"\s*\|\s*"partial"\s*\|\s*"missing"/.test(health) && /docs:\s*"ready"\s*\|\s*"partial"\s*\|\s*"missing"/.test(health)],
  ["health inspects information_schema columns", /information_schema\.columns/.test(health)],
  ["repair inspects information_schema columns", /information_schema\.columns/.test(repair)],
  ["health requires every declared column", /requiredColumns\.every\(\(column\) => actualColumns\.has\(column\)\)/.test(health)],
  ["repair requires every declared column", /requiredColumns\.every\(\(column\) => actualColumns\.has\(column\)\)/.test(repair)],
  ["partial Drive/Docs remain repairRequired", /drive !== "ready" \? "drive_items"/.test(repair) && /docs !== "ready" \? "documents"/.test(repair)],
  ["ecosystem readiness uses Drive/Docs shape readiness", /driveReady,\s*\n\s*docsReady,/.test(health)],
  ["repair refuses to claim success for partial shape", /status\.drive !== "ready" \|\| status\.docs !== "ready"/.test(repair)],
  ...requiredDrive.map((column) => [`Drive required column ${column}`, health.includes(`"${column}"`) && repair.includes(`"${column}"`)]),
  ...requiredDocs.map((column) => [`Docs required column ${column}`, health.includes(`"${column}"`) && repair.includes(`"${column}"`)]),
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("NEYVIX Drive/Docs shape contract FAIL:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`NEYVIX Drive/Docs shape contract PASS: ${checks.length} checks verified.`);
