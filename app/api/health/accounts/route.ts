import { NextResponse } from "next/server";
import { getAdminSystemSummary } from "@/lib/admin-system";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getAdminSystemSummary();

    if (!summary) {
      return NextResponse.json(
        {
          service: "NEYVIX",
          status: "degradado",
          checks: {
            database: "not_configured",
            accountIntegrity: "not_verified",
            subscriptionCoverage: "not_verified",
          },
          timestamp: new Date().toISOString(),
        },
        {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const subscriptionCoverage = summary.activeWithoutSubscription === 0;

    return NextResponse.json(
      {
        service: "NEYVIX",
        status: subscriptionCoverage ? "operacional" : "atenção",
        checks: {
          database: "connected",
          accountIntegrity: "verified",
          subscriptionCoverage: subscriptionCoverage ? "consistent" : "legacy_accounts_need_review",
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Falha ao verificar integridade de contas NEYVIX", error);
    return NextResponse.json(
      {
        service: "NEYVIX",
        status: "degradado",
        checks: {
          database: "error",
          accountIntegrity: "not_verified",
          subscriptionCoverage: "not_verified",
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
