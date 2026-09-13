import { readFileSync } from "node:fs";

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    console.error(`Command Center health contract failed: missing ${path}`);
    process.exit(1);
  }
}

const health = read("lib/command-center-health.ts");
const route = read("app/api/health/command-center/route.ts");

for (const required of [
  "users",
  "sessions",
  "projects",
  "subscriptions",
  "plans",
  "neyvix_ai_messages",
  "neyvix_studio_projects",
  "neyvix_content_items",
  "neyvix_estate_sites",
  "neyvix_automations",
  "neyvix_approval_requests",
  "getCommandCenterHealth",
]) {
  if (!health.includes(required)) {
    console.error(`Command Center health contract failed: health is missing ${required}`);
    process.exit(1);
  }
}

for (const required of [
  "getCommandCenterHealth",
  'service: "neyvix-command-center"',
  'status: health.ready ? "ready" : "unavailable"',
]) {
  if (!route.includes(required)) {
    console.error(`Command Center health contract failed: route is missing ${required}`);
    process.exit(1);
  }
}

console.log("Command Center health contract PASS: runtime dependencies and route readiness are aligned.");
