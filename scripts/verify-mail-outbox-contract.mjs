import fs from "node:fs";

const route = fs.readFileSync("app/api/mail/send/route.ts", "utf8");
const db = fs.readFileSync("lib/mail-db.ts", "utf8");
const page = fs.readFileSync("app/mail/page.tsx", "utf8");
const transport = fs.readFileSync("lib/mail-transport.ts", "utf8");
const statusRoute = fs.readFileSync("app/api/mail/outbox/status/route.ts", "utf8");
const statusDb = fs.readFileSync("lib/mail-outbox-db.ts", "utf8");

function expect(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`Missing ${label}`);
}

expect(route, "beginOutgoingMessage", "outbox reservation before transport");
expect(route, "reservation.action === \"delivery_unknown\"", "unknown-delivery fail closed branch");
expect(route, "if (result.retrySafe)", "retry only after definitive non-delivery");
expect(route, "markOutgoingMessageFailed", "definitive transport failure persistence");
expect(route, "finalizeOutgoingMessage", "post-transport finalization");
expect(transport, 'reason: "transport_rejected"', "HTTP rejection classified as definitive");
expect(transport, 'reason: timedOut ? "transport_timeout" as const : "transport_unknown" as const', "network ambiguity classification");
expect(transport, "retrySafe: false as const", "ambiguous delivery cannot auto-retry");
expect(db, "'sent', 'pending', true", "pending outbox row");
expect(db, "row.status === \"sent\"", "successful replay short-circuit");
expect(db, "row.status === \"failed\"", "safe retry after definitive failure");
expect(db, "action: \"delivery_unknown\"", "pending replay duplication guard");
expect(page, "name=\"idempotency_key\"", "per-compose idempotency key");
expect(page, "delivery_unknown", "user-visible uncertain delivery state");
expect(page, "getOwnedMailOutboxStatus", "server-side reconciliation from Mail UI");
expect(page, "Verificar entrega", "pending-delivery reconciliation action");
expect(page, "Nenhum reenvio foi realizado", "reconciliation failure remains non-destructive");
expect(page, 'mail.status === "pending"', "reconciliation action limited to ambiguous delivery");
expect(page, "getOwnedFailedMailRetryDraft", "manual retry loads owned failed delivery");
expect(page, "retryDraft.idempotencyKey", "manual retry preserves original idempotency key");
expect(page, 'mail.status === "failed"', "manual retry limited to confirmed failure");
expect(page, "Tentar novamente", "manual retry user action");
expect(statusDb, "getOwnedFailedMailRetryDraft", "owned failed-delivery retry lookup");
expect(statusDb, "m.status = 'failed'", "retry lookup confirmed-failure boundary");
expect(statusDb, "m.provider_message_id LIKE 'neyvix-outbox:%'", "retry lookup only accepts NEYVIX outbox markers");

expect(statusRoute, "getOwnedMailOutboxStatus", "direct owned-message reconciliation lookup");
expect(statusRoute, "readActiveSession", "reconciliation authentication gate");
expect(statusRoute, 'canUse(entitlements, "mail")', "reconciliation entitlement gate");
expect(statusDb, "m.id = ${messageId}::uuid", "reconciliation direct message id predicate");
expect(statusDb, "lower(u.email) = ${email.trim().toLowerCase()}", "reconciliation ownership predicate");
expect(statusDb, "m.folder = 'sent'", "reconciliation outbox folder boundary");
if (statusRoute.includes("listMailMessages")) {
  throw new Error("Outbox reconciliation must not depend on a bounded message list");
}

const reserveIndex = route.indexOf("beginOutgoingMessage");
const transportIndex = route.indexOf("deliverMail({");
const finalizeIndex = route.indexOf("finalizeOutgoingMessage");
if (!(reserveIndex >= 0 && transportIndex > reserveIndex && finalizeIndex > transportIndex)) {
  throw new Error("Mail send order must be reserve -> transport -> finalize");
}

console.log("PASS mail outbox idempotency, reconciliation and manual retry contract");
