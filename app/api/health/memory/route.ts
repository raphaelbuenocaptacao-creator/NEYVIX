import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const aiContextEnabled = process.env.NEYVIX_MEMORY_AI_CONTEXT === "true";

  if (!databaseUrl) {
    return json({
      ok: false,
      service: "neyvix-memory",
      status: "unavailable",
      database: "not_configured",
      schema: { memories: false, events: false, ownership: false, privacy: false, expiry: false, audit: false },
      aiContextEnabled,
    }, 503);
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      WITH required_columns AS (
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('neyvix_memories', 'neyvix_memory_events')
      )
      SELECT
        to_regclass('public.neyvix_memories') IS NOT NULL AS memories,
        to_regclass('public.neyvix_memory_events') IS NOT NULL AS events,
        EXISTS (SELECT 1 FROM required_columns WHERE table_name = 'neyvix_memories' AND column_name = 'user_id') AS memories_user_id,
        EXISTS (SELECT 1 FROM required_columns WHERE table_name = 'neyvix_memory_events' AND column_name = 'user_id') AS events_user_id,
        EXISTS (SELECT 1 FROM required_columns WHERE table_name = 'neyvix_memories' AND column_name = 'is_private') AS is_private,
        EXISTS (SELECT 1 FROM required_columns WHERE table_name = 'neyvix_memories' AND column_name = 'expires_at') AS expires_at,
        EXISTS (SELECT 1 FROM required_columns WHERE table_name = 'neyvix_memories' AND column_name = 'last_used_at') AS last_used_at,
        EXISTS (SELECT 1 FROM required_columns WHERE table_name = 'neyvix_memory_events' AND column_name = 'memory_id') AS event_memory_id,
        EXISTS (SELECT 1 FROM required_columns WHERE table_name = 'neyvix_memory_events' AND column_name = 'action') AS event_action,
        EXISTS (SELECT 1 FROM required_columns WHERE table_name = 'neyvix_memory_events' AND column_name = 'metadata') AS event_metadata
    `;

    const row = rows[0] ?? {};
    const memories = Boolean(row.memories);
    const events = Boolean(row.events);
    const ownership = Boolean(row.memories_user_id && row.events_user_id);
    const privacy = Boolean(row.is_private);
    const expiry = Boolean(row.expires_at);
    const audit = Boolean(row.last_used_at && row.event_memory_id && row.event_action && row.event_metadata);
    const ready = memories && events && ownership && privacy && expiry && audit;

    return json({
      ok: ready,
      service: "neyvix-memory",
      status: ready ? "ready" : "unavailable",
      database: "connected",
      schema: { memories, events, ownership, privacy, expiry, audit },
      aiContextEnabled,
    }, ready ? 200 : 503);
  } catch (error) {
    console.error("NEYVIX Memory readiness check failed", error);
    return json({
      ok: false,
      service: "neyvix-memory",
      status: "unavailable",
      database: "error",
      schema: { memories: false, events: false, ownership: false, privacy: false, expiry: false, audit: false },
      aiContextEnabled,
    }, 503);
  }
}
