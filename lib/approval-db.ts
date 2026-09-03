import { neon } from "@neondatabase/serverless";

export type ApprovalRecord = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

export async function listSelfApprovals(email: string, limit = 50) {
  const sql = getSql();
  if (!sql) return { ok: false as const, reason: "database_unavailable" as const };

  const registry = await sql`
    SELECT to_regclass('public.neyvix_approval_requests')::text AS approvals_table
  `;
  if (!registry[0]?.approvals_table) {
    return { ok: false as const, reason: "schema_unavailable" as const };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit) || 50, 50));
  const rows = await sql`
    SELECT r.id, r.title, r.status, r.created_at
    FROM public.neyvix_approval_requests r
    JOIN public.users u
      ON (r.requested_by = u.id OR r.assigned_to = u.id)
    WHERE lower(u.email) = ${normalizedEmail}
      AND COALESCE(u.is_active, true) = true
    ORDER BY r.created_at DESC
    LIMIT ${boundedLimit}
  `;

  return {
    ok: true as const,
    approvals: rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      status: String(row.status),
      createdAt: String(row.created_at),
    } satisfies ApprovalRecord)),
  };
}

export async function createSelfApproval(
  email: string,
  input: { title: string; payload?: Record<string, unknown> },
) {
  const sql = getSql();
  if (!sql) return { ok: false as const, reason: "database_unavailable" as const };

  const registry = await sql`
    SELECT to_regclass('public.neyvix_approval_requests')::text AS approvals_table
  `;
  if (!registry[0]?.approvals_table) {
    return { ok: false as const, reason: "schema_unavailable" as const };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const payloadJson = JSON.stringify(input.payload ?? {});
  const rows = await sql`
    INSERT INTO public.neyvix_approval_requests (
      requested_by,
      assigned_to,
      title,
      payload
    )
    SELECT
      u.id,
      u.id,
      ${input.title},
      ${payloadJson}::jsonb
    FROM public.users u
    WHERE lower(u.email) = ${normalizedEmail}
      AND COALESCE(u.is_active, true) = true
    RETURNING id, title, status, created_at
  `;

  if (!rows[0]) return { ok: false as const, reason: "user_not_found" as const };

  return {
    ok: true as const,
    approval: {
      id: String(rows[0].id),
      title: String(rows[0].title),
      status: String(rows[0].status),
      createdAt: String(rows[0].created_at),
    } satisfies ApprovalRecord,
  };
}
