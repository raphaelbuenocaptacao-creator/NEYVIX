import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { processBillingEvent } from "@/lib/billing-db";
import { getEntitlements } from "@/lib/entitlements";
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

  // Fail closed. Without a dedicated high-entropy secret there is no path
  // that can synthesize a Business entitlement in production.
  if (configured.length < 32 || supplied.length !== configured.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(configured));
}

export async function POST(request: Request) {
  if (!hasValidE2ESecret(request)) {
    return response({ error: "Não encontrado" }, 404);
  }

  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return response({ error: "Autenticação necessária" }, 401);

  const email = session.email.trim().toLowerCase();
  if (!isSmokeAccountEmail(email) || !email.startsWith("business-positive-")) {
    return response({ error: "Endpoint restrito a conta efêmera Business E2E" }, 403);
  }

  let body: { nonce?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return response({ error: "JSON inválido" }, 400);
  }

  const nonce = typeof body.nonce === "string" ? body.nonce.trim().toLowerCase() : "";
  if (!/^[a-z0-9-]{8,80}$/.test(nonce)) {
    return response({ error: "Nonce técnico inválido" }, 400);
  }

  const eventId = `smoke-business-${nonce}`;
  const result = await processBillingEvent({
    provider: "neyvix-smoke",
    eventId,
    type: "subscription.active",
    email,
    plan: "business",
    payload: {
      source: "production-e2e",
      disposable: true,
      externalPayment: false,
    },
  });

  if (!result.ok) {
    return response({ error: "Não foi possível aplicar entitlement técnico", reason: result.reason }, 409);
  }

  const billing = await getEntitlements(email);
  const businessReady =
    billing.plan === "business" &&
    billing.status === "active" &&
    billing.features.includes("mail") &&
    billing.features.includes("approvals");

  if (!businessReady) {
    return response({ error: "Entitlement Business não convergiu" }, 409);
  }

  return response({
    ok: true,
    billing: {
      plan: billing.plan,
      status: billing.status,
      entitlements: billing.features,
    },
    testOnly: true,
    externalPayment: false,
  });
}
