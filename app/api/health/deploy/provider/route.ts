import { NextResponse } from "next/server";
import { getDeployProviderReadiness } from "@/lib/deploy-provider-readiness";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const readiness = getDeployProviderReadiness();

  return NextResponse.json({
    module: "deploy-provider",
    provider: readiness.provider,
    configured: readiness.configured,
    executionEnabled: readiness.executionEnabled,
    missing: readiness.missing,
  }, { headers: PRIVATE_HEADERS });
}
