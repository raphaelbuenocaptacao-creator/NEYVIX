import { readFileSync } from "node:fs";

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    console.error(`Storage health contract failed: missing ${path}`);
    process.exit(1);
  }
}

const health = read("lib/storage-health.ts");
const route = read("app/api/health/storage/route.ts");
const ecosystem = read("app/ecosystem/page.tsx");

for (const required of [
  "storage_objects",
  "drive_items",
  "checksum_sha256",
  "content",
  "provider",
  "postgres",
]) {
  if (!health.includes(required)) {
    console.error(`Storage health contract failed: health is missing ${required}`);
    process.exit(1);
  }
}

for (const required of [
  "getStorageHealth",
  'service: "neyvix-storage"',
  'status: health.ready ? "ready" : "unavailable"',
]) {
  if (!route.includes(required)) {
    console.error(`Storage health contract failed: route is missing ${required}`);
    process.exit(1);
  }
}

if (!ecosystem.includes('name: "NEYVIX Drive"') || !ecosystem.includes('status: "Funcional"')) {
  console.error("Storage health contract failed: ecosystem does not describe Drive as functional.");
  process.exit(1);
}

if (ecosystem.includes("upload de arquivos ainda não está habilitado")) {
  console.error("Storage health contract failed: stale Drive upload-disabled copy remains.");
  process.exit(1);
}

console.log("Storage health contract PASS: schema, route and ecosystem truth are aligned.");
