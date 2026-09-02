import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const panel = await readFile(new URL("../app/admin/SchemaRepairPanel.tsx", import.meta.url), "utf8");

// Inspect only the mount effect body. A file-wide greedy expression can incorrectly
// match the separately declared repair() handler that appears later in the module.
const mountEffect = panel.match(/useEffect\(\(\) => \{([\s\S]*?)\}\s*,\s*\[\]\s*\);/)?.[1] ?? "";

const checks = [
  ["panel is rendered only for superadmin", /role === "superadmin" \? <SchemaRepairPanel/.test(page)],
  ["panel inspects through guarded endpoint", /fetch\("\/api\/admin\/schema-repair"/.test(panel)],
  ["panel uses explicit confirmation token", /REPAIR_DRIVE_DOCS/.test(panel)],
  ["repair uses POST", /method: "POST"/.test(panel)],
  ["repair sends confirmation payload", /JSON\.stringify\(\{ confirmation \}\)/.test(panel)],
  ["repair requires exact confirmation before enabling", /confirmation === CONFIRMATION/.test(panel)],
  ["panel mount effect is present", mountEffect.length > 0],
  ["panel never auto-runs repair", mountEffect.length > 0 && !/\brepair\s*\(/.test(mountEffect)],
  ["panel exposes database Drive and Docs states", /BANCO/.test(panel) && /DRIVE/.test(panel) && /DOCS/.test(panel)],
  ["panel surfaces failures instead of optimistic success", /setError/.test(panel) && /response\.ok/.test(panel)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) process.exit(1);
console.log(`Schema repair UI contract: ${checks.length}/${checks.length} guarantees passed.`);
