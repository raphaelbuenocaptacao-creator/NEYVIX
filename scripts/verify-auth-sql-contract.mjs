import { readFileSync } from "node:fs";

const source = readFileSync("lib/register-db.ts", "utf8");

const requiredFragments = [
  "WITH active_project AS (",
  "selected_plan AS (",
  "new_user AS (",
  "new_subscription AS (",
  "INSERT INTO public.users",
  "INSERT INTO public.subscriptions",
  "JOIN new_subscription",
  "AS project_ready",
  "AS plan_ready",
  'throw new Error("NEYVIX signup configuration missing active project")',
  'throw new Error("NEYVIX signup configuration missing active plan")',
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    console.error(`NEYVIX auth SQL contract failed: missing ${fragment}`);
    process.exit(1);
  }
}

const typedPlanCodeUses = source.match(/\$\{selectedPlanCode\}::text/g) ?? [];
if (typedPlanCodeUses.length < 2) {
  console.error(
    "NEYVIX auth SQL contract failed: plan_code metadata parameters must be explicitly cast to text in both signup schema paths.",
  );
  process.exit(1);
}

const metadataUses = source.match(/jsonb_build_object\([^\n]+\$\{selectedPlanCode\}/g) ?? [];
if (metadataUses.length !== typedPlanCodeUses.length) {
  console.error(
    "NEYVIX auth SQL contract failed: found an untyped selectedPlanCode parameter inside jsonb_build_object.",
  );
  process.exit(1);
}

const conflictGuards = source.match(/ON CONFLICT DO NOTHING/g) ?? [];
if (conflictGuards.length < 2) {
  console.error(
    "NEYVIX auth SQL contract failed: both signup schema paths must remain conflict-safe.",
  );
  process.exit(1);
}

const readinessCheckIndex = source.indexOf("const readinessRows = await sql`");
const compatibilityCheckIndex = source.indexOf("const compatibilityRows = await sql`");
const insertIndex = source.indexOf("INSERT INTO public.users");
if (readinessCheckIndex < 0 || compatibilityCheckIndex < 0 || insertIndex < 0 || readinessCheckIndex > insertIndex) {
  console.error(
    "NEYVIX auth SQL contract failed: signup project/plan readiness must be checked before any user insert.",
  );
  process.exit(1);
}

console.log(
  `NEYVIX auth SQL contract PASS: canonical signup readiness, ${typedPlanCodeUses.length} typed plan metadata parameters and ${conflictGuards.length} conflict guards verified.`,
);
