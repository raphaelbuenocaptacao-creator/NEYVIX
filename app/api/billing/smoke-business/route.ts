import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { processBillingEvent } from "@/lib/billing-db";
import { getEntitlements } from "@/lib/entitlements";
import { hasValidGitHubActionsOidc } from "@/lib/github-actions-oidc";
import { readActiveSession } from "@/lib/session";
import { isSmokeAccountEmail } from "@/lib/smoke-user-db";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function hasValidE2ESecret(request: Request) {
  const configured = process.env.NEYVIX_BUSINESS_E2E_SECRET?.trim() ?? "";
  const supplied = request.headers.get("x-neyvix-e2e-secret")?.trim() ?? "";
  if (configured.length < 32 || supplied.length !== configured.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(configured));
}

async function isAuthorizedE2ERequest(request: Request) {
  // The legacy high-entropy secret remains supported, but GitHub Actions can
  // authenticate without cross-platform secret synchronization by presenting
  // a short-lived, cryptographically verified OIDC token whose repository,
  // branch, workflow, audience and event claims are pinned by our verifier.
  if (hasValidE2ESecret(request)) return true;
  return hasValidGitHubActionsOidc(request);
}

export async function POST(request: Request) {
  if (!(await isAuthorizedE2ERequest(request))) {
    return response({ error: "Não encontrado" }, 404);
  }

  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return response({ error: "Autenticação necessária" }, 401);

  const email = session.email.trim().toLowerCase();
  if (!isSmokeAccountEmail(email) || !email.startsWith("business-positive-")) {
    return response({ error: "Endpoint restrito a conta efêmera Business E2E" }, 403);
  }

  let body: { nonce?: unknown; action?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return response({ error: "JSON inválido" }, 400);
  }

  const nonce = typeof body.nonce === "string" ? body.nonce.trim().toLowerCase() : "";
  if (!/^[a-z0-9-]{8,80}$/.test(nonce)) {
    return response({ error: "Nonce técnico inválido" }, 400);
  }

  const action = body.action === undefined ? "activate" : body.action;
  if (action !== "activate" && action !== "cancel") {
    return response({ error: "Ação técnica inválida" }, 400);
  }

  const cancelling = action === "cancel";
  const eventId = cancelling ? `smoke-business-cancel-${nonce}` : `smoke-business-${nonce}`;
  const result = await processBillingEvent({
    provider: "neyvix-smoke",
    eventId,
    type: cancelling ? "subscription.canceled" : "subscription.active",
    email,
    plan: "business",
    payload: {
      source: "production-e2e",
      disposable: true,
      action,
      externalPayment: false,
    },
  });

  if (!result.ok) {
    return response({ error: "Não foi possível aplicar entitlement técnico", reason: result.reason }, 409);
  }

  const billing = await getEntitlements(email);
  const expectedState = cancelling
    ? billing.plan === "expired" &&
      (billing.status === "cancelled" || billing.status === "canceled") &&
      !billing.features.includes("mail") &&
      !billing.features.includes("approvals")
    : billing.plan === "business" &&
      billing.status === "active" &&
      billing.features.includes("mail") &&
      billing.features.includes("approvals");

  if (!expectedState) {
    return response({ error: cancelling ? "Revogação Business não convergiu" : "Entitlement Business não convergiu" }, 409);
  }

  return response({
    ok: true,
    action,
    billing: {
      plan: billing.plan,
      status: billing.status,
      entitlements: billing.features,
    },
    billingEvent: {
      duplicate: result.duplicate,
      updated: result.updated,
    },
    testOnly: true,
    externalPayment: false,
  });
}
