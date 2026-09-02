import { neon } from "@neondatabase/serverless";

export type DriveDocsRepairStatus = {
  database: "connected" | "not_configured";
  drive: "ready" | "missing";
  docs: "ready" | "missing";
  repairRequired: string[];
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

export async function inspectDriveDocsRepair(): Promise<DriveDocsRepairStatus> {
  const sql = getSql();
  if (!sql) {
    return { database: "not_configured", drive: "missing", docs: "missing", repairRequired: ["drive_items", "documents"] };
  }

  const rows = await sql`
    SELECT
      to_regclass('public.drive_items') IS NOT NULL AS drive_items_table,
      to_regclass('public.documents') IS NOT NULL AS documents_table
  `;
  const row = rows[0] ?? {};
  const driveReady = Boolean(row.drive_items_table);
  const docsReady = Boolean(row.documents_table);
  return {
    database: "connected",
    drive: driveReady ? "ready" : "missing",
    docs: docsReady ? "ready" : "missing",
    repairRequired: [!driveReady ? "drive_items" : null, !docsReady ? "documents" : null].filter((value): value is string => Boolean(value)),
  };
}

export async function repairDriveDocsSchema(): Promise<DriveDocsRepairStatus> {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured");

  // Deliberately additive/idempotent. No DROP, TRUNCATE, DELETE, UPDATE or ALTER is executed here.
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await sql`
    CREATE TABLE IF NOT EXISTS public.drive_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      parent_id uuid REFERENCES public.drive_items(id) ON DELETE CASCADE,
      kind text NOT NULL DEFAULT 'file',
      name text NOT NULL,
      mime_type text,
      size_bytes bigint NOT NULL DEFAULT 0,
      storage_key text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public.documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      drive_item_id uuid UNIQUE REFERENCES public.drive_items(id) ON DELETE SET NULL,
      title text NOT NULL DEFAULT 'Untitled',
      content jsonb NOT NULL DEFAULT '{}'::jsonb,
      version bigint NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_drive_items_owner_parent
      ON public.drive_items(owner_user_id, parent_id)
  `;

  const status = await inspectDriveDocsRepair();
  if (status.drive !== "ready" || status.docs !== "ready") {
    throw new Error("Drive/Docs schema repair did not reach ready state");
  }
  return status;
}
