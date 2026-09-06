import fs from "node:fs";

const route = fs.readFileSync("app/api/mail/send/route.ts", "utf8");
const db = fs.readFileSync("lib/mail-db.ts", "utf8");
const page = fs.readFileSync("app/mail/page.tsx", "utf8");

function expect(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`Missing ${label}`);
}

expect(route, "beginOutgoingMessage", "outbox reservation before transport");
expect(route, "reservation.action === \"delivery_unknown\"", "unknown-delivery fail closed branch");
expect(route, "markOutgoingMessageFailed", "definitive transport failure persistence");
expect(route, "finalizeOutgoingMessage", "post-transport finalization");
expect(db, "'sent', 'pending', true", "pending outbox row");
expect(db, "row.status === \"sent\"", "successful replay short-circuit");
expect(db, "row.status === \"failed\"", "safe retry after definitive failure");
expect(db, "action: \"delivery_unknown\"", "pending replay duplication guard");
expect(page, "name=\"idempotency_key\"", "per-compose idempotency key");
expect(page, "delivery_unknown", "user-visible uncertain delivery state");

const reserveIndex = route.indexOf("beginOutgoingMessage");
const transportIndex = route.indexOf("deliverMail({");
const finalizeIndex = route.indexOf("finalizeOutgoingMessage");
if (!(reserveIndex >= 0 && transportIndex > reserveIndex && finalizeIndex > transportIndex)) {
  throw new Error("Mail send order must be reserve -> transport -> finalize");
}

console.log("PASS mail outbox idempotency contract");
