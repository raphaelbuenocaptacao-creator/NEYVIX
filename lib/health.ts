import { neon } from "@neondatabase/serverless";

export type HealthStatus = {
  ok: boolean;
  database: "connected" | "not_configured" | "error";
  project: "ready" | "missing" | "unknown";
};

export async function getHealthStatus(): Promise<HealthStatus> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return {
      ok: false,
      database: "not_configured",
      project: "unknown",
    };
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT EXISTS (
        SELECT 1
        FROM public.projects
        WHERE slug = 'neyvix' AND is_active = true
      ) AS project_ready
    `;

    const projectReady = Boolean(rows[0]?.project_ready);

    return {
      ok: projectReady,
      database: "connected",
      project: projectReady ? "ready" : "missing",
    };
  } catch {
    return {
      ok: false,
      database: "error",
      project: "unknown",
    };
  }
}
