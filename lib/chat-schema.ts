export const CHAT_REQUIRED_COLUMNS = {
  projects: ["id", "slug", "is_active"],
  users: ["id", "email", "name", "is_active"],
  project_users: ["project_id", "user_id", "role"],
  realtime_events: ["id", "project_id", "actor_user_id", "topic", "event_type", "payload", "created_at"],
} as const;

export type ChatSchemaState = "ready" | "partial" | "missing";
export type ChatShapeRow = { table_name: string; column_name: string };

export function evaluateChatSchema(rows: ChatShapeRow[]) {
  const entries = Object.entries(CHAT_REQUIRED_COLUMNS) as Array<[
    keyof typeof CHAT_REQUIRED_COLUMNS,
    readonly string[],
  ]>;

  const missingTables: string[] = [];
  const missingColumns: string[] = [];

  for (const [table, requiredColumns] of entries) {
    const actual = new Set(
      rows.filter((row) => row.table_name === table).map((row) => row.column_name),
    );

    if (actual.size === 0) {
      missingTables.push(table);
      continue;
    }

    for (const column of requiredColumns) {
      if (!actual.has(column)) missingColumns.push(`${table}.${column}`);
    }
  }

  const state: ChatSchemaState = missingTables.length === entries.length
    ? "missing"
    : missingTables.length === 0 && missingColumns.length === 0
      ? "ready"
      : "partial";

  return {
    state,
    requiredColumns: entries.reduce((total, [, columns]) => total + columns.length, 0),
    presentRequiredColumns: entries.reduce((total, [table, columns]) => {
      const actual = new Set(
        rows.filter((row) => row.table_name === table).map((row) => row.column_name),
      );
      return total + columns.filter((column) => actual.has(column)).length;
    }, 0),
    missingTables,
    missingColumns,
  };
}
