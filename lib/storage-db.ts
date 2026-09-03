import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export type StoredDriveFile = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  storageKey: string;
  checksumSha256: string;
  createdAt: string;
};

export type StoredDownload = StoredDriveFile & { contentBase64: string };

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

async function schemaReady(sql: NonNullable<ReturnType<typeof getSql>>) {
  const rows = await sql`
    SELECT
      to_regclass('public.users')::text AS users,
      to_regclass('public.projects')::text AS projects,
      to_regclass('public.drive_items')::text AS drive_items,
      to_regclass('public.storage_objects')::text AS storage_objects
  ` as Array<Record<string, string | null>>;
  const row = rows[0];
  return Boolean(row?.users && row?.projects && row?.drive_items && row?.storage_objects);
}

function mapFile(row: Record<string, unknown>): StoredDriveFile {
  return {
    id: String(row.id),
    name: String(row.name),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    sizeBytes: Number(row.size_bytes ?? 0),
    storageKey: String(row.storage_key),
    checksumSha256: String(row.checksum_sha256),
    createdAt: String(row.created_at),
  };
}

export async function createPrivateDriveFile(input: {
  email: string;
  name: string;
  mimeType: string;
  content: Buffer;
  parentId: string | null;
}): Promise<StoredDriveFile | null> {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return null;

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 160);
  const mimeType = input.mimeType.trim().slice(0, 160) || "application/octet-stream";
  if (!email || !name || input.content.length < 1) return null;

  const objectKey = `drive/${randomUUID()}`;
  const base64 = input.content.toString("base64");
  const checksum = createHash("sha256").update(input.content).digest("hex");
  const size = input.content.length;

  const rows = await sql`
    WITH target_user AS (
      SELECT id FROM public.users
      WHERE lower(email) = ${email} AND is_active = true
      LIMIT 1
    ), target_project AS (
      SELECT id FROM public.projects
      WHERE slug = 'neyvix' AND is_active = true
      LIMIT 1
    ), valid_parent AS (
      SELECT d.id
      FROM public.drive_items d
      JOIN target_user u ON u.id = d.owner_user_id
      WHERE ${input.parentId}::uuid IS NOT NULL
        AND d.id = ${input.parentId}::uuid
        AND d.kind = 'folder'
      UNION ALL
      SELECT NULL::uuid WHERE ${input.parentId}::uuid IS NULL
      LIMIT 1
    ), stored AS (
      INSERT INTO public.storage_objects (
        project_id, owner_user_id, bucket, object_key, provider, provider_key,
        content_type, size_bytes, checksum_sha256, visibility, metadata, content
      )
      SELECT p.id, u.id, 'drive', ${objectKey}, 'postgres', NULL,
        ${mimeType}, ${size}, ${checksum}, 'private',
        jsonb_build_object('source'::text, 'neyvix-drive'::text),
        decode(${base64}, 'base64')
      FROM target_user u CROSS JOIN target_project p CROSS JOIN valid_parent vp
      RETURNING owner_user_id, object_key, content_type, size_bytes, checksum_sha256, created_at
    ), item AS (
      INSERT INTO public.drive_items (
        owner_user_id, parent_id, kind, name, mime_type, size_bytes, storage_key, metadata
      )
      SELECT s.owner_user_id, vp.id, 'file', ${name}, s.content_type, s.size_bytes, s.object_key,
        jsonb_build_object('checksumSha256'::text, s.checksum_sha256::text)
      FROM stored s CROSS JOIN valid_parent vp
      RETURNING id, name, mime_type, size_bytes, storage_key, created_at
    )
    SELECT i.id, i.name, i.mime_type, i.size_bytes, i.storage_key, s.checksum_sha256, i.created_at
    FROM item i JOIN stored s ON s.object_key = i.storage_key
  ` as Array<Record<string, unknown>>;

  return rows[0] ? mapFile(rows[0]) : null;
}

export async function readPrivateDriveFile(emailInput: string, id: string): Promise<StoredDownload | null> {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return null;
  const email = emailInput.trim().toLowerCase();
  const rows = await sql`
    SELECT d.id, d.name, d.mime_type, d.size_bytes, d.storage_key,
      s.checksum_sha256, d.created_at, encode(s.content, 'base64') AS content_base64
    FROM public.drive_items d
    JOIN public.users u ON u.id = d.owner_user_id
    JOIN public.storage_objects s
      ON s.owner_user_id = u.id
     AND s.bucket = 'drive'
     AND s.object_key = d.storage_key
     AND s.deleted_at IS NULL
    JOIN public.projects p ON p.id = s.project_id AND p.slug = 'neyvix' AND p.is_active = true
    WHERE d.id = ${id}::uuid
      AND d.kind = 'file'
      AND lower(u.email) = ${email}
      AND u.is_active = true
    LIMIT 1
  ` as Array<Record<string, unknown>>;
  const row = rows[0];
  return row ? { ...mapFile(row), contentBase64: String(row.content_base64 ?? "") } : null;
}

export async function deletePrivateDriveFile(emailInput: string, id: string): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return false;
  const email = emailInput.trim().toLowerCase();
  const rows = await sql`
    WITH target_user AS (
      SELECT id FROM public.users
      WHERE lower(email) = ${email} AND is_active = true
      LIMIT 1
    ), removed_item AS (
      DELETE FROM public.drive_items d
      USING target_user u
      WHERE d.id = ${id}::uuid
        AND d.owner_user_id = u.id
        AND d.kind = 'file'
      RETURNING d.owner_user_id, d.storage_key
    )
    DELETE FROM public.storage_objects s
    USING removed_item r, public.projects p
    WHERE s.owner_user_id = r.owner_user_id
      AND s.object_key = r.storage_key
      AND s.bucket = 'drive'
      AND s.project_id = p.id
      AND p.slug = 'neyvix'
    RETURNING s.id
  ` as Array<{ id: string }>;
  return rows.length === 1;
}
