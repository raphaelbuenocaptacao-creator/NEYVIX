import { canUse, getEntitlements, type EntitlementFeature } from "@/lib/entitlements";

export async function getProductAccess(email: string, feature: EntitlementFeature) {
  const entitlements = await getEntitlements(email);
  return {
    allowed: canUse(entitlements, feature),
    entitlements,
  };
}

export function upgradeRequiredPayload(feature: EntitlementFeature, plan = "Pro") {
  return {
    error: `O recurso ${feature} não está incluído no seu plano atual.`,
    code: "upgrade_required",
    requiredPlan: plan,
    plansUrl: "/plans",
  };
}
