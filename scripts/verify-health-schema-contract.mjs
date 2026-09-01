import { readFile } from "node:fs/promises";

const health = await readFile(new URL("../lib/health.ts", import.meta.url), "utf8");

const checks = [
  ["health catalogs Studio persistence", /to_regclass\('public\.neyvix_studio_projects'\) IS NOT NULL AS studio_projects_table/.test(health)],
  ["health catalogs Content persistence", /to_regclass\('public\.neyvix_content_items'\) IS NOT NULL AS content_items_table/.test(health)],
  ["health exposes productRecords schema status", /productRecords: "ready" \| "partial" \| "missing" \| "unknown"/.test(health)],
  ["health computes product record completeness", /productRecordTablesReady[\s\S]*studio_projects_table[\s\S]*content_items_table[\s\S]*productRecords/.test(health)],
  ["health reports productRecords in schema payload", /schema:\s*\{[\s\S]*automation[\s\S]*memory[\s\S]*productRecords[\s\S]*ecosystem/.test(health)],
  ["launch readiness requires complete product records", /launchReady:[\s\S]*productRecords === "ready"[\s\S]*ecosystem === "ready"/.test(health)],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("NEYVIX health schema contract FAIL:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`NEYVIX health schema contract PASS: ${checks.length} checks verified.`);
