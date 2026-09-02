import { neon } from "@neondatabase/serverless";

export type DriveDocsRepairStatus = {
  database: "connected" | "not_configured";
  drive: "ready" | "partial" | "missing";
  docs: "ready" | "partial" | "missing";
  repairRequired: string[];
};

const DRIVE_REQUIRED_COLUMNS = [
  "id",
  "owner_user_id",
  "parent_id",
  "kind",
  "name",
  "mime_type",
  "size_bytes",
  "storage_key",
  "metadata",
  "created_at",
  "updated_at",
] as const;

const DOCS_REQUIRED_COLUMNS = [
  "id",
  "owner_user_id",
  "drive_item_id",
  "title",
  "content",
  "version",
  "created_at",
  "updated_at",
] as const;

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function shapeState(exists: boolean, actualColumns: Set<string>, requiredColumns: readonly string[]) {
  if (!exists) return "missing" as const;
  return requiredColumns.every((column) => actualColumns.has(column)) ? "ready" as const : "partial" as const;
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
  const hasDrive = Boolean(row.drive_items_table);
  const hasDocs = Boolean(row.documents_table);

  const columnRows = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('drive_items', 'documents')
  ` as Array<{ table_name: string; column_name: string }>;

  const driveColumns = new Set(columnRows.filter((column) => column.table_name === "drive_items").map((column) => column.column_name));
  const docsColumns = new Set(columnRows.filter((column) => column.table_name === "documents").map((column) => column.column_name));
  const drive = shapeState(hasDrive, driveColumns, DRIVE_REQUIRED_COLUMNS);
  const docs = shapeState(hasDocs, docsColumns, DOCS_REQUIRED_COLUMNS);

  return {
    database: "connected",
    drive,
    docs,
    repairRequired: [drive !== "ready" ? "drive_items" : null, docs !== "ready" ? "documents" : null].filter((value): value is string => Boolean(value)),
  };
}

export async function repairDriveDocsSchema(): Promise<DriveDocsRepairStatus> {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured");

  // Deliberately additive/idempotent. No DROP, TRUNCATE, DELETE, UPDATE or ALTER is executed here.
  // Existing partial tables are never reported as repaired: CREATE TABLE IF NOT EXISTS cannot
  // safely infer how to backfill or constrain an unknown production shape.
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
