import { readFileSync } from "node:fs";

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    console.error(`Content health contract failed: missing ${path}`);
    process.exit(1);
  }
}

const health = read("lib/content-health.ts");
const route = read("app/api/health/content/route.ts");

for (const required of [
  "neyvix_content_items",
  "user_id",
  "kind",
  "prompt",
  "content",
  "created_at",
  "getContentHealth",
]) {
  if (!health.includes(required)) {
    console.error(`Content health contract failed: health is missing ${required}`);
    process.exit(1);
  }
}

for (const required of [
  "getContentHealth",
  'service: "neyvix-content"',
  'status: health.ready ? "ready" : "unavailable"',
]) {
  if (!route.includes(required)) {
    console.error(`Content health contract failed: route is missing ${required}`);
    process.exit(1);
  }
}

console.log("Content health contract PASS: schema and route readiness are aligned.");
