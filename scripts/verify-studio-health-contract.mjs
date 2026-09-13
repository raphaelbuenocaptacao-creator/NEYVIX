import { readFileSync } from "node:fs";

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    console.error(`Studio health contract failed: missing ${path}`);
    process.exit(1);
  }
}

const health = read("lib/studio-health.ts");
const route = read("app/api/health/studio/route.ts");

for (const required of [
  "neyvix_studio_projects",
  "user_id",
  "prompt",
  "blueprint",
  "status",
  "created_at",
  "updated_at",
  "getStudioHealth",
]) {
  if (!health.includes(required)) {
    console.error(`Studio health contract failed: health is missing ${required}`);
    process.exit(1);
  }
}

for (const required of [
  "getStudioHealth",
  'service: "neyvix-studio"',
  'status: health.ready ? "ready" : "unavailable"',
]) {
  if (!route.includes(required)) {
    console.error(`Studio health contract failed: route is missing ${required}`);
    process.exit(1);
  }
}

console.log("Studio health contract PASS: schema and route readiness are aligned.");
