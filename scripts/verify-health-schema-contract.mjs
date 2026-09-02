import { readFile } from "node:fs/promises";

const health = await readFile(new URL("../lib/health.ts", import.meta.url), "utf8");

const checks = [
  ["health catalogs Studio persistence", /to_regclass\('public\.neyvix_studio_projects'\) IS NOT NULL AS studio_projects_table/.test(health)],
  ["health catalogs Content persistence", /to_regclass\('public\.neyvix_content_items'\) IS NOT NULL AS content_items_table/.test(health)],
  ["health catalogs Drive persistence", /to_regclass\('public\.drive_items'\) IS NOT NULL AS drive_items_table/.test(health)],
  ["health catalogs Docs persistence", /to_regclass\('public\.documents'\) IS NOT NULL AS documents_table/.test(health)],
  ["health exposes productRecords schema status", /productRecords: "ready" \| "partial" \| "missing" \| "unknown"/.test(health)],
  ["health exposes Drive schema status", /drive: "ready" \| "partial" \| "missing" \| "unknown"/.test(health)],
  ["health exposes Docs schema status", /docs: "ready" \| "partial" \| "missing" \| "unknown"/.test(health)],
  ["health exposes repairRequired list", /repairRequired: string\[\]/.test(health)],
  ["health computes product record completeness", /productRecordTablesReady[\s\S]*studio_projects_table[\s\S]*content_items_table[\s\S]*productRecords/.test(health)],
  ["health computes Drive readiness from schema shape", /const drive = shapeState\(Boolean\(catalog\.drive_items_table\), driveColumns, DRIVE_REQUIRED_COLUMNS\)[\s\S]*const driveReady = drive === "ready"/.test(health)],
  ["health computes Docs readiness from schema shape", /const docs = shapeState\(Boolean\(catalog\.documents_table\), docsColumns, DOCS_REQUIRED_COLUMNS\)[\s\S]*const docsReady = docs === "ready"/.test(health)],
  ["health identifies Drive Docs repair targets", /!driveReady \? "drive_items"[\s\S]*!docsReady \? "documents"/.test(health)],
  ["health reports productRecords Drive Docs in schema payload", /schema:\s*\{[\s\S]*automation[\s\S]*memory[\s\S]*productRecords[\s\S]*drive[\s\S]*docs[\s\S]*ecosystem[\s\S]*repairRequired/.test(health)],
  ["launch readiness requires complete product records Drive and Docs", /launchReady:[\s\S]*productRecords === "ready"[\s\S]*driveReady[\s\S]*docsReady[\s\S]*ecosystem === "ready"/.test(health)],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("NEYVIX health schema contract FAIL:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`NEYVIX health schema contract PASS: ${checks.length} checks verified.`);
