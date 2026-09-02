import fs from "node:fs";

const route = fs.readFileSync("app/api/health/route.ts", "utf8");

const checks = [
  ["health exposes release metadata", /release:\s*\{[\s\S]*sha:\s*releaseSha[\s\S]*environment:\s*releaseEnvironment/.test(route)],
  ["Vercel commit SHA is preferred", /process\.env\.VERCEL_GIT_COMMIT_SHA/.test(route)],
  ["GitHub SHA is a safe CI fallback", /process\.env\.GITHUB_SHA/.test(route)],
  ["release SHA never reads secrets", !/releaseSha[\s\S]{0,120}(SECRET|TOKEN|KEY|DATABASE_URL)/.test(route)],
  ["environment is explicit", /process\.env\.VERCEL_ENV/.test(route)],
  ["unknown SHA is represented explicitly", /\?\?\s*"unknown"/.test(route)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}
if (failed.length > 0) process.exit(1);
