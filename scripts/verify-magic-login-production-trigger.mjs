import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/magic-login-positive-e2e-smoke.yml", "utf8");

for (const required of [
  "github.event.deployment_status.state == 'success'",
  "github.event.deployment_status.environment_url != ''",
  "github.event.deployment.environment == 'Production'",
]) {
  if (!workflow.includes(required)) {
    console.error(`NEYVIX magic-login trigger check failed: missing contract ${required}`);
    process.exit(1);
  }
}

if (!workflow.includes("NEYVIX_PRODUCTION_URL: https://neyvix.vercel.app")) {
  console.error("NEYVIX magic-login trigger check failed: production E2E must target the canonical production URL.");
  process.exit(1);
}

console.log("NEYVIX magic-login trigger check PASS: deployment_status execution is production-only.");
