import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { canUse, getEntitlements } from "@/lib/entitlements";
import { hasValidGitHubActionsOidc } from "@/lib/github-actions-oidc";
import {
  beginOutgoingMessage,
  finalizeOutgoingMessage,
  markOutgoingMessageFailed,
} from "@/lib/mail-db";
import {
  getOwnedFailedMailRetryDraft,
  getOwnedMailOutboxPayload,
  getOwnedMailOutboxStatus,
} from "@/lib/mail-outbox-db";
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

export async function POST(request: Request) {
  if (!(await hasValidGitHubActionsOidc(request))) {
    return response({ error: "Não encontrado" }, 404);
  }

  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return response({ error: "Autenticação necessária" }, 401);

  const email = session.email.trim().toLowerCase();
  if (!isSmokeAccountEmail(email) || !email.startsWith("business-positive-mail-retry-")) {
    return response({ error: "Endpoint restrito a conta efêmera Mail retry E2E" }, 403);
  }

  const entitlements = await getEntitlements(email);
  if (!canUse(entitlements, "mail")) {
    return response({ error: "Entitlement Mail necessário" }, 403);
  }

  const idempotencyKey = randomUUID();
  const original = {
    email,
    displayName: session.name,
    to: email,
    subject: "NEYVIX Mail retry E2E original",
    text: "Disposable state-machine smoke. No external transport is invoked.",
    idempotencyKey,
  };

  const first = await beginOutgoingMessage(original);
  if (!first || first.action !== "deliver") {
    return response({ error: "Não foi possível reservar a outbox", stage: "reserve" }, 409);
  }

  const failed = await markOutgoingMessageFailed(email, first.messageId);
  if (!failed) {
    return response({ error: "Não foi possível marcar falha definitiva", stage: "mark_failed" }, 409);
  }

  const failedStatus = await getOwnedMailOutboxStatus(email, first.messageId);
  const retryDraft = await getOwnedFailedMailRetryDraft(email, first.messageId);
  if (
    failedStatus?.status !== "failed" ||
    !retryDraft ||
    retryDraft.idempotencyKey !== idempotencyKey ||
    retryDraft.to !== original.to ||
    retryDraft.subject !== original.subject ||
    retryDraft.text !== original.text
  ) {
    return response({ error: "Estado failed/retry draft não convergiu", stage: "failed_draft" }, 409);
  }

  const retry = await beginOutgoingMessage({
    ...original,
    to: "mutated@example.invalid",
    subject: "MUTATED SUBJECT MUST NOT WIN",
    text: "MUTATED BODY MUST NOT WIN",
  });
  if (!retry || retry.action !== "deliver" || retry.messageId !== first.messageId) {
    return response({ error: "Retry failed→pending não convergiu", stage: "retry_transition" }, 409);
  }

  const canonical = await getOwnedMailOutboxPayload(email, first.messageId);
  if (
    !canonical ||
    canonical.to !== original.to ||
    canonical.subject !== original.subject ||
    canonical.text !== original.text
  ) {
    return response({ error: "Payload canônico foi alterado no retry", stage: "canonical_payload" }, 409);
  }

  const pendingReplay = await beginOutgoingMessage(original);
  if (!pendingReplay || pendingReplay.action !== "delivery_unknown" || pendingReplay.messageId !== first.messageId) {
    return response({ error: "Replay pending não foi bloqueado", stage: "pending_replay" }, 409);
  }

  const finalized = await finalizeOutgoingMessage(email, first.messageId);
  if (!finalized) {
    return response({ error: "Não foi possível finalizar outbox sintética", stage: "finalize" }, 409);
  }

  const sentReplay = await beginOutgoingMessage(original);
  const sentStatus = await getOwnedMailOutboxStatus(email, first.messageId);
  if (!sentReplay || sentReplay.action !== "already_sent" || sentReplay.messageId !== first.messageId || sentStatus?.status !== "sent") {
    return response({ error: "Replay sent não convergiu", stage: "sent_replay" }, 409);
  }

  return response({
    ok: true,
    testOnly: true,
    externalTransport: false,
    externalPayment: false,
    checks: {
      reservedPending: true,
      definitiveFailureRecorded: true,
      failedRetryAllowed: true,
      idempotencyKeyReused: true,
      canonicalPayloadImmutable: true,
      pendingReplayBlocked: true,
      sentReplaySuppressed: true,
    },
  });
}
