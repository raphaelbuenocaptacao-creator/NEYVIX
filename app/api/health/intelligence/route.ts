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

function validHttpsUrl(value?: string) {
  if (!value?.trim()) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const gatewayUrlConfigured = validHttpsUrl(process.env.NEYVIX_AI_GATEWAY_URL);
  const gatewaySecretConfigured = Boolean(process.env.NEYVIX_AI_GATEWAY_SECRET?.trim());
  const gatewayConfigured = gatewayUrlConfigured && gatewaySecretConfigured;
  const memoryAiContext = process.env.NEYVIX_MEMORY_AI_CONTEXT === "true";

  if (!databaseUrl) {
    return json({
      ok: false,
      service: "neyvix-intelligence",
      status: "unavailable",
      database: "not_configured",
      ai: { gatewayConfigured, gatewayUrlConfigured, gatewaySecretConfigured, messageStore: false, schemaReady: false },
      memory: { store: false, events: false, schemaReady: false, aiContextEnabled: memoryAiContext },
    }, 503);
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT
        to_regclass('public.neyvix_ai_messages') IS NOT NULL AS ai_messages,
        to_regclass('public.neyvix_memories') IS NOT NULL AS memories,
        to_regclass('public.neyvix_memory_events') IS NOT NULL AS memory_events,
        (
          SELECT count(*) = 4
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'neyvix_ai_messages'
            AND column_name = ANY (ARRAY['user_id', 'role', 'content', 'created_at'])
        ) AS ai_messages_columns,
        (
          SELECT count(*) = 7
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'neyvix_memories'
            AND column_name = ANY (ARRAY['user_id', 'memory_key', 'category', 'value', 'is_private', 'expires_at', 'updated_at'])
        ) AS memory_columns,
        (
          SELECT count(*) = 5
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'neyvix_memory_events'
            AND column_name = ANY (ARRAY['user_id', 'memory_id', 'action', 'metadata', 'created_at'])
        ) AS memory_event_columns
    `;
    const row = rows[0] ?? {};
    const aiMessages = Boolean(row.ai_messages);
    const memories = Boolean(row.memories);
    const memoryEvents = Boolean(row.memory_events);
    const aiSchemaReady = aiMessages && Boolean(row.ai_messages_columns);
    const memorySchemaReady = memories && memoryEvents && Boolean(row.memory_columns) && Boolean(row.memory_event_columns);
    const persistenceReady = aiSchemaReady && memorySchemaReady;
    const ready = persistenceReady && gatewayConfigured;
    const status = ready ? "ready" : persistenceReady ? "partial" : "unavailable";

    return json({
      ok: ready,
      service: "neyvix-intelligence",
      status,
      database: "connected",
      ai: {
        gatewayConfigured,
        gatewayUrlConfigured,
        gatewaySecretConfigured,
        messageStore: aiMessages,
        schemaReady: aiSchemaReady,
      },
      memory: {
        store: memories,
        events: memoryEvents,
        schemaReady: memorySchemaReady,
        aiContextEnabled: memoryAiContext,
      },
    }, ready ? 200 : 503);
  } catch (error) {
    console.error("NEYVIX intelligence readiness check failed", error);
    return json({
      ok: false,
      service: "neyvix-intelligence",
      status: "unavailable",
      database: "error",
      ai: { gatewayConfigured, gatewayUrlConfigured, gatewaySecretConfigured, messageStore: false, schemaReady: false },
      memory: { store: false, events: false, schemaReady: false, aiContextEnabled: memoryAiContext },
    }, 503);
  }
}
