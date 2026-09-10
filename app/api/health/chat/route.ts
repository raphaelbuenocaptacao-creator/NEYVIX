import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { evaluateChatSchema, type ChatShapeRow } from "@/lib/chat-schema";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return json({
      ok: false,
      service: "neyvix-chat",
      status: "unavailable",
      database: "not_configured",
      schema: { state: "unknown", requiredColumns: 17, presentRequiredColumns: 0 },
      project: "unknown",
    }, 503);
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
    const projectRows = schema.state === "ready"
      ? await sql`
          SELECT EXISTS (
            SELECT 1 FROM public.projects
            WHERE slug = 'neyvix' AND is_active = true
          ) AS project_ready
        `
      : [];
    const projectReady = Boolean(projectRows[0]?.project_ready);
    const ready = schema.state === "ready" && projectReady;

    return json({
      ok: ready,
      service: "neyvix-chat",
      status: ready ? "ready" : "unavailable",
      database: "connected",
      schema,
      project: projectReady ? "ready" : schema.state === "ready" ? "missing" : "unknown",
    }, ready ? 200 : 503);
  } catch (error) {
    console.error("NEYVIX Chat readiness check failed", error);
    return json({
      ok: false,
      service: "neyvix-chat",
      status: "unavailable",
      database: "error",
      schema: { state: "unknown", requiredColumns: 17, presentRequiredColumns: 0 },
      project: "unknown",
    }, 503);
  }
}
