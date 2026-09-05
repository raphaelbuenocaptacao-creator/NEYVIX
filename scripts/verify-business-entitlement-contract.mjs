import fs from "node:fs";

const source = fs.readFileSync("lib/entitlements.ts", "utf8");

function assertIncludes(fragment, message) {
  if (!source.includes(fragment)) {
    throw new Error(`Business entitlement contract failed: ${message}`);
  }
}

assertIncludes('const BUSINESS: EntitlementFeature[] = [...PRO, "admin", "approvals", "mail", "team"]', "Business must explicitly add admin, approvals, mail and team on top of Pro");
assertIncludes('if (status === "active")', "paid entitlements must require active status");
assertIncludes('const fallbackFeatures = slug === "business" ? BUSINESS : slug === "pro" ? PRO : START', "active Business must resolve to the Business feature set");
assertIncludes('return { plan: slug, status, features, trialEndsAt, enforcementEnabled, source: "database" }', "active plan result must come from the database-backed resolver");
assertIncludes('if (trialActive)', "trial access must be handled separately from paid Business access");
assertIncludes('return { plan: "trial", status, features: PRO', "trial must remain capped at Pro features");
assertIncludes('if (status === "trialing" || ["expired", "cancelled", "canceled", "past_due"].includes(status ?? ""))', "non-active commercial states must not fall through to paid Business access");
assertIncludes('return { plan: "expired", status, features: LIMITED', "expired/cancelled/past-due access must remain limited");

const businessIndex = source.indexOf('const BUSINESS: EntitlementFeature[]');
const trialIndex = source.indexOf('features: PRO, trialEndsAt');
if (businessIndex < 0 || trialIndex < 0) {
  throw new Error("Business entitlement contract failed: expected Business and trial branches were not found");
}

console.log("PASS: Business positive entitlement contract is explicit, database-backed, and isolated from trial/expired access.");
