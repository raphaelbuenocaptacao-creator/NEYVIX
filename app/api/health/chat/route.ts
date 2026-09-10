import { NextResponse } from "next/server";
import { getChatReadiness } from "@/lib/chat-health";

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
  const readiness = await getChatReadiness();
  return json({
    ok: readiness.ok,
    service: "neyvix-chat",
    status: readiness.ok ? "ready" : "unavailable",
    database: readiness.database,
    schema: readiness.schema,
    project: readiness.project,
  }, readiness.ok ? 200 : 503);
}
