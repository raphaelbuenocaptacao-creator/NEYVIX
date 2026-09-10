import { neon } from "@neondatabase/serverless";
import { evaluateChatSchema, type ChatShapeRow } from "@/lib/chat-schema";

export type ChatReadiness = {
  ok: boolean;
  database: "connected" | "not_configured" | "error";
  schema: ReturnType<typeof evaluateChatSchema> | {
    state: "unknown";
    requiredColumns: 17;
    presentRequiredColumns: 0;
    missingTables: string[];
    missingColumns: string[];
  };
  project: "ready" | "missing" | "unknown";
};

const unknownSchema = () => ({
  state: "unknown" as const,
  requiredColumns: 17 as const,
  presentRequiredColumns: 0 as const,
  missingTables: [] as string[],
  missingColumns: [] as string[],
});

export async function getChatReadiness(): Promise<ChatReadiness> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return {
      ok: false,
      database: "not_configured",
      schema: unknownSchema(),
      project: "unknown",
    };
  }

  try {
    const sql = neon(databaseUrl);
    const shapeRows = await sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('projects', 'users', 'project_users', 'realtime_events')
    ` as ChatShapeRow[];
    const schema = evaluateChatSchema(shapeRows);

    if (schema.state !== "ready") {
      return {
        ok: false,
        database: "connected",
        schema,
        project: "unknown",
      };
    }

    const projectRows = await sql`
      SELECT EXISTS (
        SELECT 1 FROM public.projects
        WHERE slug = 'neyvix' AND is_active = true
      ) AS project_ready
    `;
    const projectReady = Boolean(projectRows[0]?.project_ready);

    return {
      ok: projectReady,
      database: "connected",
      schema,
      project: projectReady ? "ready" : "missing",
    };
  } catch (error) {
    console.error("NEYVIX Chat readiness inspection failed", error);
    return {
      ok: false,
      database: "error",
      schema: unknownSchema(),
      project: "unknown",
    };
  }
}
