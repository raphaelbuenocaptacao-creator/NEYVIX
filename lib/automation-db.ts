import { neon } from "@neondatabase/serverless";

export type AutomationSummary = {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  actionType: string;
  updatedAt: string;
};

export type ApprovalSummary = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  return neon(url);
}

type SqlClient = NonNullable<ReturnType<typeof getSql>>;

async function schemaReady(sql: SqlClient) {
  const registry = await sql`
    SELECT
      to_regclass('public.neyvix_automations')::text AS automations_table,
      to_regclass('public.neyvix_approval_requests')::text AS approvals_table
  `;
  const row = registry[0] as { automations_table?: string | null; approvals_table?: string | null } | undefined;
  return Boolean(row?.automations_table && row?.approvals_table);
}

export async function listAutomationWorkspace(email: string) {
  const sql = getSql();
  if (!sql) return { automations: [] as AutomationSummary[], approvals: [] as ApprovalSummary[], schemaReady: false };

  const ready = await schemaReady(sql);
  if (!ready) return { automations: [], approvals: [], schemaReady: false };

  const normalizedEmail = email.trim().toLowerCase();
  const [automationRows, approvalRows] = await Promise.all([
    sql`
      SELECT a.id, a.name, a.status, a.trigger_type, a.action_type, a.updated_at
      FROM public.neyvix_automations a
      JOIN public.users u ON u.id = a.user_id
      WHERE lower(u.email) = ${normalizedEmail}
      ORDER BY a.updated_at DESC
      LIMIT 20
    `,
    sql`
      SELECT DISTINCT r.id, r.title, r.status, r.created_at
      FROM public.neyvix_approval_requests r
      JOIN public.users requester ON requester.id = r.requested_by
      LEFT JOIN public.users assignee ON assignee.id = r.assigned_to
      WHERE lower(requester.email) = ${normalizedEmail}
         OR lower(COALESCE(assignee.email, '')) = ${normalizedEmail}
      ORDER BY r.created_at DESC
      LIMIT 20
    `,
  ]);

  return {
    schemaReady: true,
    automations: automationRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      status: String(row.status),
      triggerType: String(row.trigger_type),
      actionType: String(row.action_type),
      updatedAt: String(row.updated_at),
    })),
    approvals: approvalRows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      status: String(row.status),
      createdAt: String(row.created_at),
    })),
  };
}

export async function createAutomation(email: string, input: {
  name: string;
  description?: string;
  triggerType?: string;
  actionType?: string;
}) {
  const sql = getSql();
  if (!sql) return { ok: false as const, reason: "database_unavailable" as const };
  if (!(await schemaReady(sql))) return { ok: false as const, reason: "schema_unavailable" as const };

  const normalizedEmail = email.trim().toLowerCase();
  const rows = await sql`
    INSERT INTO public.neyvix_automations (user_id, name, description, trigger_type, action_type)
    SELECT u.id, ${input.name}, ${input.description ?? ""}, ${input.triggerType ?? "manual"}, ${input.actionType ?? "workflow"}
    FROM public.users u
    WHERE lower(u.email) = ${normalizedEmail}
      AND COALESCE(u.is_active, true) = true
    RETURNING id, name, status, trigger_type, action_type, updated_at
  `;

  if (!rows[0]) return { ok: false as const, reason: "user_not_found" as const };
  const row = rows[0];
  return {
    ok: true as const,
    automation: {
      id: String(row.id),
      name: String(row.name),
      status: String(row.status),
      triggerType: String(row.trigger_type),
      actionType: String(row.action_type),
      updatedAt: String(row.updated_at),
    },
  };
}

export async function deleteAutomation(email: string, automationId: string) {
  const sql = getSql();
  if (!sql) return { ok: false as const, reason: "database_unavailable" as const };
  if (!(await schemaReady(sql))) return { ok: false as const, reason: "schema_unavailable" as const };

  const normalizedEmail = email.trim().toLowerCase();
  const rows = await sql`
    DELETE FROM public.neyvix_automations a
    USING public.users u
    WHERE a.id::text = ${automationId}
      AND a.user_id = u.id
      AND lower(u.email) = ${normalizedEmail}
      AND COALESCE(u.is_active, true) = true
    RETURNING a.id
  `;

  if (!rows[0]) return { ok: false as const, reason: "not_found_or_forbidden" as const };
  return { ok: true as const, id: String(rows[0].id) };
}

export async function decideApproval(email: string, approvalId: string, decision: "approved" | "rejected", note = "") {
  const sql = getSql();
  if (!sql) return { ok: false as const, reason: "database_unavailable" as const };
  if (!(await schemaReady(sql))) return { ok: false as const, reason: "schema_unavailable" as const };

  const normalizedEmail = email.trim().toLowerCase();
  const rows = await sql`
    UPDATE public.neyvix_approval_requests r
    SET status = ${decision},
        decided_by = u.id,
        decision_note = ${note},
        decided_at = now()
    FROM public.users u
    WHERE r.id::text = ${approvalId}
      AND r.status = 'pending'
      AND lower(u.email) = ${normalizedEmail}
      AND COALESCE(u.is_active, true) = true
      AND (
        r.assigned_to = u.id
        OR (r.assigned_to IS NULL AND r.requested_by = u.id)
      )
    RETURNING r.id, r.title, r.status, r.created_at
  `;

  if (!rows[0]) return { ok: false as const, reason: "not_found_or_forbidden" as const };
  return {
    ok: true as const,
    approval: {
      id: String(rows[0].id),
      title: String(rows[0].title),
      status: String(rows[0].status),
      createdAt: String(rows[0].created_at),
    },
  };
}
