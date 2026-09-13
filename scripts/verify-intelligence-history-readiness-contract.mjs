import fs from "node:fs";

const route = fs.readFileSync("app/api/health/intelligence/route.ts", "utf8");

const failures = [];

if (!route.includes("count(*) = 5")) {
  failures.push("intelligence health must require all 5 AI message columns used by runtime history");
}

if (!/ARRAY\[[^\]]*["']id["'][^\]]*["']user_id["'][^\]]*["']role["'][^\]]*["']content["'][^\]]*["']created_at["'][^\]]*\]/s.test(route)) {
  failures.push("intelligence health must include id, user_id, role, content and created_at in the AI message schema contract");
}

if (failures.length) {
  console.error("Intelligence history readiness contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Intelligence history readiness contract passed");
