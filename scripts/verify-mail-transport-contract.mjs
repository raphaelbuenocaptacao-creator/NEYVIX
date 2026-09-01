import fs from "node:fs";

const transport = fs.readFileSync("lib/mail-transport.ts", "utf8");
const request = fs.readFileSync("app/api/auth/magic-login/request/route.ts", "utf8");

const deliveryFailureBlock = request.match(/if \(!delivered\.ok\) \{[\s\S]*?\n    \}/)?.[0] ?? "";

const checks = [
  ["webhook requires URL and secret", /MAIL_TRANSPORT_URL[\s\S]*MAIL_TRANSPORT_SECRET/.test(transport)],
  ["webhook requires HTTPS", /url\.protocol === "https:"/.test(transport)],
  ["Resend requires API key", /RESEND_API_KEY/.test(transport)],
  ["Resend requires explicit MAIL_FROM_ADDRESS", /MAIL_FROM_ADDRESS/.test(transport) && /validFromAddress/.test(transport)],
  ["invalid Resend sender is not ready", /ready: resend\.valid/.test(transport) && /transport_invalid/.test(transport)],
  ["delivery uses validated Resend sender", /if \(resend\?\.valid\)/.test(transport) && /from: resend\.from/.test(transport)],
  ["mail transport has timeout", /AbortController/.test(transport) && /MAIL_TIMEOUT_MS/.test(transport)],
  ["magic login checks transport readiness before token creation", request.indexOf("if (!sql || !transport.ready)") < request.indexOf("randomBytes(32)")],
  ["failed delivery burns the generated token", /SET used_at = now\(\)/.test(deliveryFailureBlock)],
  ["failed delivery does not reveal account existence", /secureRedirect\("\/login\?magic=sent"\)/.test(deliveryFailureBlock) && !/magic=unavailable/.test(deliveryFailureBlock)],
  ["unknown account and delivery failure share public success state", /if \(!user\)[\s\S]*?secureRedirect\("\/login\?magic=sent"\)/.test(request) && /if \(!delivered\.ok\)[\s\S]*?secureRedirect\("\/login\?magic=sent"\)/.test(request)],
  ["magic link uses canonical trusted HTTPS origin", /trustedPublicOrigin/.test(request) && /url\.protocol === "https:"/.test(request)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

if (failed.length) {
  console.error(`Mail transport contract failed: ${failed.length} check(s)`);
  process.exit(1);
}

console.log(`Mail transport contract PASS (${checks.length}/${checks.length})`);
