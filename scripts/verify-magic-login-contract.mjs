import { readFileSync } from "node:fs";

const requestSource = readFileSync("app/api/auth/magic-login/request/route.ts", "utf8");
const consumeSource = readFileSync("app/api/auth/magic-login/route.ts", "utf8");

const requestRequirements = [
  'rateLimitBucket(`magic-login|account|${email}`)',
  'rateLimitBucket(`magic-login|origin|${address}`)',
  '"magic_login_request_account"',
  '"magic_login_request_origin"',
  "MAGIC_LOGIN_ACCOUNT_LIMIT",
  "MAGIC_LOGIN_ORIGIN_LIMIT",
  "Promise.all([",
  'return secureRedirect("/login?magic=rate_limit")',
  'return secureRedirect("/login?magic=sent")',
  'new URL("/api/auth/magic-login", trustedPublicOrigin())',
  "randomBytes(32).toString(\"base64url\")",
];

const consumeRequirements = [
  "MAGIC_LOGIN_TOKEN_PATTERN",
  "prt.used_at IS NULL",
  "prt.expires_at > now()",
  "u.is_active = true",
  "SET used_at = now()",
  "AND used_at IS NULL",
  "RETURNING id",
  "createSession(",
];

for (const fragment of requestRequirements) {
  if (!requestSource.includes(fragment)) {
    console.error(`NEYVIX magic login contract failed: request flow missing ${fragment}`);
    process.exit(1);
  }
}

for (const fragment of consumeRequirements) {
  if (!consumeSource.includes(fragment)) {
    console.error(`NEYVIX magic login contract failed: consume flow missing ${fragment}`);
    process.exit(1);
  }
}

const accountRecord = requestSource.indexOf('recordRateLimitEvent("magic_login_request_account", accountBucket)');
const originRecord = requestSource.indexOf('recordRateLimitEvent("magic_login_request_origin", originBucket)');
const accountLookup = requestSource.indexOf("const users = await sql`");
if (accountRecord < 0 || originRecord < 0 || accountLookup < 0 || accountRecord > accountLookup || originRecord > accountLookup) {
  console.error("NEYVIX magic login contract failed: both throttle dimensions must be recorded before account lookup.");
  process.exit(1);
}

if (requestSource.includes("magic-login|${email}|${clientAddress(request)}")) {
  console.error("NEYVIX magic login contract failed: combined email+IP bucket reintroduced.");
  process.exit(1);
}

console.log(
  `NEYVIX magic login contract PASS: ${requestRequirements.length + consumeRequirements.length + 2} security guarantees verified.`,
);
