import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealthStatus();

  return NextResponse.json(
    {
      service: "NEYVIX",
      status: health.ok ? "operacional" : "degradado",
      checks: {
        database: health.database,
        project: health.project,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: health.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
