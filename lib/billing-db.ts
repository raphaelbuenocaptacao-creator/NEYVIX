import { neon } from "@neondatabase/serverless";
import { ensureNeyvixSubscription } from "@/lib/subscription-heal";

export type BillingEventInput = {
  provider: string;
  eventId: string;
  type: string;
  email: string;
  plan: "start" | "pro" | "business";
  customerId?: string | null;
  subscriptionId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  payload?: unknown;
};

type DbFailureStage = "identity_lookup" | "subscription_heal" | "billing_write";

type PostgresLikeError = {
  code?: unknown;
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function normalizeStatus(type: string) {
  const value = type.toLowerCase();
  if (["subscription.active", "checkout.completed", "payment.succeeded", "invoice.paid"].includes(value)) return "active";
  if (["subscription.past_due", "payment.failed", "invoice.payment_failed"].includes(value)) return "past_due";
  if (["subscription.cancelled", "subscription.canceled"].includes(value)) return "cancelled";
  if (["subscription.expired"].includes(value)) return "expired";
  return null;
}

function classifyDatabaseFailure(stage: DbFailureStage, error: unknown) {
  const code =
    typeof error === "object" && error !== null && typeof (error as PostgresLikeError).code === "string"
      ? String((error as PostgresLikeError).code)
      : "";

  // Only stable SQLSTATE classes are surfaced. Never return the database
  // message, query, connection string, values or stack to the caller.
  if (code === "42P10") return `${stage}_idempotency_constraint_missing`;
  if (code === "42703") return `${stage}_schema_column_missing`;
  if (code === "42P01") return `${stage}_schema_table_missing`;
  if (code === "23503") return `${stage}_foreign_key_violation`;
  if (code === "23505") return `${stage}_unique_violation`;
  if (code === "23514") return `${stage}_check_violation`;
  if (code.startsWith("23")) return `${stage}_integrity_violation`;
  if (code.startsWith("42")) return `${stage}_schema_mismatch`;
  if (code.startsWith("08")) return `${stage}_connection_failure`;
  return `${stage}_database_failure`;
}

export async function processBillingEvent(input: BillingEventInput) {
  const sql = getSql();
  if (!sql) return { ok: false as const, reason: "database_unavailable" };

  const provider = input.provider.trim().toLowerCase().slice(0, 80);
  const eventId = input.eventId.trim().slice(0, 180);
  const email = input.email.trim().toLowerCase();
  const status = normalizeStatus(input.type);
  if (!provider || !eventId || !email || !status) return { ok: false as const, reason: "invalid_event" };

  // Legacy NEYVIX accounts can predate the subscription contract. Heal the
  // entitlement atomically before applying a provider event so a legitimate
  // billing event is not discarded merely because the user has not logged in
  // since subscription healing was introduced. This creates no charge and
  // remains idempotent via the subscription (project_id, user_id) constraint.
  let identityRows;
  try {
    identityRows = await sql`
      SELECT u.id
      FROM public.users u
      JOIN public.projects p ON p.slug = 'neyvix' AND p.is_active = true
      WHERE lower(u.email) = ${email} AND u.is_active = true
      LIMIT 1
    `;
  } catch (error) {
    return { ok: false as const, reason: classifyDatabaseFailure("identity_lookup", error) };
  }

  const userId = String(identityRows[0]?.id ?? "");
  if (!userId) return { ok: false as const, reason: "account_or_plan_not_found" };

  let subscriptionReady = false;
  try {
    subscriptionReady = await ensureNeyvixSubscription(userId);
  } catch (error) {
    return { ok: false as const, reason: classifyDatabaseFailure("subscription_heal", error) };
  }
  if (!subscriptionReady) return { ok: false as const, reason: "subscription_unavailable" };

  const code = `${input.plan}-monthly`;
  const payload = JSON.stringify(input.payload ?? input);
  const billingMetadata = JSON.stringify({
    last_billing_event: eventId,
    provider,
    provider_customer_id: input.customerId ?? null,
    provider_subscription_id: input.subscriptionId ?? null,
    current_period_start: input.periodStart ?? null,
    current_period_ends_at: input.periodEnd ?? null,
    cancel_at_period_end: Boolean(input.cancelAtPeriodEnd),
    ...(status === "cancelled" ? { canceled_at: new Date().toISOString() } : {}),
  });

  let rows;
  try {
    rows = await sql`
      WITH target AS (
        SELECT s.id AS subscription_id, u.id AS user_id, p.id AS project_id, pl.id AS plan_id
        FROM public.users u
        JOIN public.projects p ON p.slug = 'neyvix' AND p.is_active = true
        JOIN public.subscriptions s ON s.user_id = u.id AND s.project_id = p.id
        JOIN public.plans pl ON pl.project_id = p.id AND pl.code = ${code} AND pl.is_active = true
        WHERE lower(u.email) = ${email}
        LIMIT 1
      ), event_insert AS (
        INSERT INTO public.neyvix_billing_events (provider, provider_event_id, event_type, subscription_id, payload, processed_at)
        SELECT ${provider}, ${eventId}, ${input.type}, target.subscription_id, ${payload}::jsonb, now()
        FROM target
        ON CONFLICT (provider, provider_event_id) DO NOTHING
        RETURNING subscription_id
      ), updated AS (
        UPDATE public.subscriptions s
        SET
          plan_id = target.plan_id,
          status = ${status},
          updated_at = now(),
          metadata = COALESCE(s.metadata, '{}'::jsonb) || ${billingMetadata}::jsonb
        FROM target, event_insert
        WHERE s.id = target.subscription_id AND event_insert.subscription_id = s.id
        RETURNING s.id, s.status, s.plan_id
      )
      SELECT
        (SELECT count(*)::int FROM target) AS target_count,
        (SELECT count(*)::int FROM event_insert) AS event_count,
        (SELECT count(*)::int FROM updated) AS updated_count
    `;
  } catch (error) {
    return { ok: false as const, reason: classifyDatabaseFailure("billing_write", error) };
  }

  const result = rows[0] as { target_count?: number; event_count?: number; updated_count?: number } | undefined;
  if (!result || Number(result.target_count ?? 0) === 0) return { ok: false as const, reason: "account_or_plan_not_found" };
  if (Number(result.event_count ?? 0) === 0) return { ok: true as const, duplicate: true, updated: false };
  return { ok: true as const, duplicate: false, updated: Number(result.updated_count ?? 0) === 1 };
}
