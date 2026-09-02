import { readdir } from "node:fs/promises";

const entries = await readdir(new URL("../database/", import.meta.url), { withFileTypes: true });
const migrations = entries
  .filter((entry) => entry.isFile() && /^\d{3}_.+\.sql$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();

const prefixes = migrations.map((name) => name.slice(0, 3));
const duplicates = prefixes.filter((prefix, index) => prefixes.indexOf(prefix) !== index);

if (duplicates.length) {
  console.error(`NEYVIX migration order contract FAIL: duplicate migration prefixes: ${[...new Set(duplicates)].join(", ")}`);
  process.exit(1);
}

if (!migrations.includes("014_repair_drive_docs.sql")) {
  console.error("NEYVIX migration order contract FAIL: Drive/Docs repair must have the unique ordered id 014.");
  process.exit(1);
}

console.log(`NEYVIX migration order contract PASS: ${migrations.length} uniquely numbered migrations verified.`);
