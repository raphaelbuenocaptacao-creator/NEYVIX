import { neon } from "@neondatabase/serverless";

export type DriveItem = {
  id: string;
  parentId: string | null;
  kind: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  storageKey: string | null;
  createdAt: string;
  updatedAt: string;
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

async function schemaReady(sql: NonNullable<ReturnType<typeof getSql>>) {
  const rows = await sql`SELECT to_regclass('public.drive_items')::text AS drive_items` as Array<{ drive_items: string | null }>;
  return Boolean(rows[0]?.drive_items);
}

function mapItem(row: Record<string, unknown>): DriveItem {
  return {
    id: String(row.id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    kind: String(row.kind),
    name: String(row.name),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    sizeBytes: Number(row.size_bytes ?? 0),
    storageKey: row.storage_key ? String(row.storage_key) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listDriveItems(email: string, parentId: string | null = null, limit = 100): Promise<DriveItem[]> {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return [];
  const normalizedEmail = email.trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const rows = parentId
    ? await sql`
        SELECT d.id, d.parent_id, d.kind, d.name, d.mime_type, d.size_bytes, d.storage_key, d.created_at, d.updated_at
        FROM public.drive_items d
        JOIN public.users u ON u.id = d.owner_user_id
        WHERE lower(u.email) = ${normalizedEmail} AND u.is_active = true AND d.parent_id = ${parentId}::uuid
        ORDER BY CASE WHEN d.kind = 'folder' THEN 0 ELSE 1 END, lower(d.name), d.created_at DESC
        LIMIT ${safeLimit}
      ` as Array<Record<string, unknown>>
    : await sql`
        SELECT d.id, d.parent_id, d.kind, d.name, d.mime_type, d.size_bytes, d.storage_key, d.created_at, d.updated_at
        FROM public.drive_items d
        JOIN public.users u ON u.id = d.owner_user_id
        WHERE lower(u.email) = ${normalizedEmail} AND u.is_active = true AND d.parent_id IS NULL
        ORDER BY CASE WHEN d.kind = 'folder' THEN 0 ELSE 1 END, lower(d.name), d.created_at DESC
        LIMIT ${safeLimit}
      ` as Array<Record<string, unknown>>;
  return rows.map(mapItem);
}

export async function createDriveFolder(email: string, name: string, parentId: string | null = null): Promise<DriveItem | null> {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name.trim().slice(0, 160);
  if (!cleanName) return null;

  const rows = await sql`
    WITH target_user AS (
      SELECT id FROM public.users WHERE lower(email) = ${normalizedEmail} AND is_active = true LIMIT 1
    ), valid_parent AS (
      SELECT d.id
      FROM public.drive_items d
      JOIN target_user u ON u.id = d.owner_user_id
      WHERE ${parentId}::uuid IS NOT NULL AND d.id = ${parentId}::uuid AND d.kind = 'folder'
      UNION ALL
      SELECT NULL::uuid WHERE ${parentId}::uuid IS NULL
      LIMIT 1
    )
    INSERT INTO public.drive_items (owner_user_id, parent_id, kind, name)
    SELECT u.id, p.id, 'folder', ${cleanName}
    FROM target_user u CROSS JOIN valid_parent p
    RETURNING id, parent_id, kind, name, mime_type, size_bytes, storage_key, created_at, updated_at
  ` as Array<Record<string, unknown>>;
  return rows[0] ? mapItem(rows[0]) : null;
}

export async function renameDriveItem(email: string, id: string, name: string): Promise<DriveItem | null> {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return null;
  const cleanName = name.trim().slice(0, 160);
  if (!cleanName) return null;
  const rows = await sql`
    UPDATE public.drive_items d
    SET name = ${cleanName}, updated_at = now()
    FROM public.users u
    WHERE d.id = ${id}::uuid
      AND u.id = d.owner_user_id
      AND lower(u.email) = ${email.trim().toLowerCase()}
      AND u.is_active = true
    RETURNING d.id, d.parent_id, d.kind, d.name, d.mime_type, d.size_bytes, d.storage_key, d.created_at, d.updated_at
  ` as Array<Record<string, unknown>>;
  return rows[0] ? mapItem(rows[0]) : null;
}

export async function deleteEmptyDriveFolder(email: string, id: string): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return false;
  const rows = await sql`
    DELETE FROM public.drive_items d
    USING public.users u
    WHERE d.id = ${id}::uuid
      AND d.kind = 'folder'
      AND u.id = d.owner_user_id
      AND lower(u.email) = ${email.trim().toLowerCase()}
      AND u.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.drive_items child WHERE child.parent_id = d.id)
    RETURNING d.id
  ` as Array<{ id: string }>;
  return rows.length === 1;
}
