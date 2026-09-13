import { neon } from "@neondatabase/serverless";

const DRIVE_ITEM_COLUMNS = [
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

const STORAGE_OBJECT_COLUMNS = [
  "id",
  "project_id",
  "owner_user_id",
  "bucket",
  "object_key",
  "provider",
  "provider_key",
  "content_type",
  "size_bytes",
  "checksum_sha256",
  "visibility",
  "metadata",
  "deleted_at",
  "created_at",
  "updated_at",
  "content",
] as const;

type StorageHealthChecks = {
  driveItemsTable: boolean;
  storageObjectsTable: boolean;
  driveItemsColumns: boolean;
  storageObjectsColumns: boolean;
  provider: "postgres" | "mixed" | "unknown";
  checksumsPresent: boolean;
  contentPresent: boolean;
  driveLinksResolvable: boolean;
};

export type StorageHealth = {
  ready: boolean;
  database: "connected" | "not_configured" | "error";
  checks: StorageHealthChecks;
};

function emptyChecks(): StorageHealthChecks {
  return {
    driveItemsTable: false,
    storageObjectsTable: false,
    driveItemsColumns: false,
    storageObjectsColumns: false,
    provider: "unknown",
    checksumsPresent: false,
    contentPresent: false,
    driveLinksResolvable: false,
  };
}

export async function getStorageHealth(): Promise<StorageHealth> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return { ready: false, database: "not_configured", checks: emptyChecks() };
  }

  try {
    const sql = neon(databaseUrl);
    const columns = (await sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('drive_items', 'storage_objects')
      ORDER BY table_name, ordinal_position
    `) as Array<{ table_name: string; column_name: string }>;

    const driveColumns = new Set(
      columns.filter((row) => row.table_name === "drive_items").map((row) => row.column_name),
    );
    const storageColumns = new Set(
      columns.filter((row) => row.table_name === "storage_objects").map((row) => row.column_name),
    );

    const schemaChecks = {
      driveItemsTable: driveColumns.size > 0,
      storageObjectsTable: storageColumns.size > 0,
      driveItemsColumns: DRIVE_ITEM_COLUMNS.every((column) => driveColumns.has(column)),
      storageObjectsColumns: STORAGE_OBJECT_COLUMNS.every((column) => storageColumns.has(column)),
    };

    if (!Object.values(schemaChecks).every(Boolean)) {
      return {
        ready: false,
        database: "connected",
        checks: {
          ...schemaChecks,
          provider: "unknown",
          checksumsPresent: false,
          contentPresent: false,
          driveLinksResolvable: false,
        },
      };
    }

    const integrityRows = (await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE deleted_at IS NULL AND provider <> 'postgres'
        )::int AS non_postgres_objects,
        COUNT(*) FILTER (
          WHERE deleted_at IS NULL AND provider = 'postgres' AND checksum_sha256 IS NULL
        )::int AS missing_checksums,
        COUNT(*) FILTER (
          WHERE deleted_at IS NULL AND provider = 'postgres' AND content IS NULL
        )::int AS missing_content
      FROM public.storage_objects
    `) as Array<{
      non_postgres_objects: number;
      missing_checksums: number;
      missing_content: number;
    }>;

    const linkRows = (await sql`
      SELECT COUNT(*)::int AS broken_links
      FROM public.drive_items d
      WHERE d.kind = 'file'
        AND NOT EXISTS (
          SELECT 1
          FROM public.storage_objects s
          WHERE s.owner_user_id = d.owner_user_id
            AND s.bucket = 'drive'
            AND s.object_key = d.storage_key
            AND s.deleted_at IS NULL
        )
    `) as Array<{ broken_links: number }>;

    const integrity = integrityRows[0];
    const nonPostgresObjects = Number(integrity?.non_postgres_objects ?? 0);
    const missingChecksums = Number(integrity?.missing_checksums ?? 0);
    const missingContent = Number(integrity?.missing_content ?? 0);
    const brokenLinks = Number(linkRows[0]?.broken_links ?? 0);

    const checks: StorageHealthChecks = {
      ...schemaChecks,
      provider: nonPostgresObjects === 0 ? "postgres" : "mixed",
      checksumsPresent: missingChecksums === 0,
      contentPresent: missingContent === 0,
      driveLinksResolvable: brokenLinks === 0,
    };

    return {
      ready:
        checks.driveItemsTable &&
        checks.storageObjectsTable &&
        checks.driveItemsColumns &&
        checks.storageObjectsColumns &&
        checks.provider === "postgres" &&
        checks.checksumsPresent &&
        checks.contentPresent &&
        checks.driveLinksResolvable,
      database: "connected",
      checks,
    };
  } catch {
    return { ready: false, database: "error", checks: emptyChecks() };
  }
}
