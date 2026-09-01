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
      ai: { gatewayConfigured, gatewayUrlConfigured, gatewaySecretConfigured, messageStore: false },
      memory: { store: false, events: false, aiContextEnabled: memoryAiContext },
    }, 503);
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT
        to_regclass('public.neyvix_ai_messages') IS NOT NULL AS ai_messages,
        to_regclass('public.neyvix_memories') IS NOT NULL AS memories,
        to_regclass('public.neyvix_memory_events') IS NOT NULL AS memory_events
    `;
    const row = rows[0] ?? {};
    const aiMessages = Boolean(row.ai_messages);
    const memories = Boolean(row.memories);
    const memoryEvents = Boolean(row.memory_events);
    const persistenceReady = aiMessages && memories && memoryEvents;
    const status = persistenceReady && gatewayConfigured ? "ready" : persistenceReady ? "partial" : "unavailable";

    return json({
      ok: persistenceReady,
      service: "neyvix-intelligence",
      status,
      database: "connected",
      ai: {
        gatewayConfigured,
        gatewayUrlConfigured,
        gatewaySecretConfigured,
        messageStore: aiMessages,
      },
      memory: {
        store: memories,
        events: memoryEvents,
        aiContextEnabled: memoryAiContext,
      },
    }, persistenceReady ? 200 : 503);
  } catch (error) {
    console.error("NEYVIX intelligence readiness check failed", error);
    return json({
      ok: false,
      service: "neyvix-intelligence",
      status: "unavailable",
      database: "error",
      ai: { gatewayConfigured, gatewayUrlConfigured, gatewaySecretConfigured, messageStore: false },
      memory: { store: false, events: false, aiContextEnabled: memoryAiContext },
    }, 503);
  }
}
