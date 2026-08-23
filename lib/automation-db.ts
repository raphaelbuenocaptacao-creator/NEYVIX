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

export async function listAutomationWorkspace(email: string) {
  const sql = getSql();
  if (!sql) return { automations: [] as AutomationSummary[], approvals: [] as ApprovalSummary[], schemaReady: false };

  const registry = await sql`
    SELECT
      to_regclass('public.neyvix_automations')::text AS automations_table,
      to_regclass('public.neyvix_approval_requests')::text AS approvals_table
  `;

  const schemaReady = Boolean(registry[0]?.automations_table && registry[0]?.approvals_table);
  if (!schemaReady) return { automations: [], approvals: [], schemaReady: false };

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
      SELECT r.id, r.title, r.status, r.created_at
      FROM public.neyvix_approval_requests r
      JOIN public.users u ON u.id = r.requested_by
      WHERE lower(u.email) = ${normalizedEmail}
         OR r.assigned_to = u.id
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
