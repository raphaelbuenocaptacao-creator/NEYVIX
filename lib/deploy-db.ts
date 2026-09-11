import { neon } from "@neondatabase/serverless";
import { getEcosystemModuleReadiness } from "@/lib/ecosystem-health";

export type DeployProject = {
  id: string;
  name: string;
  gitProvider: string;
  gitRepository: string;
  productionBranch: string;
  framework: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateDeployProjectInput = {
  name: string;
  gitRepository: string;
  productionBranch: string;
  framework: string | null;
};

export class DeploySchemaNotReadyError extends Error {
  constructor() {
    super("NEYVIX Deploy persistence schema is not ready");
    this.name = "DeploySchemaNotReadyError";
  }
}

async function getReadySql() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new DeploySchemaNotReadyError();

  const readiness = await getEcosystemModuleReadiness();
  if (readiness.database !== "connected" || readiness.deploy !== "ready") {
    throw new DeploySchemaNotReadyError();
  }

  return neon(databaseUrl);
}

function mapProject(row: Record<string, unknown>): DeployProject {
  return {
    id: String(row.id),
    name: String(row.name),
    gitProvider: String(row.git_provider),
    gitRepository: String(row.git_repository),
    productionBranch: String(row.production_branch),
    framework: row.framework ? String(row.framework) : null,
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listDeployProjects(email: string, limit = 50): Promise<DeployProject[]> {
  const sql = await getReadySql();
  const normalizedEmail = email.trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(limit, 100));

  const rows = await sql`
    SELECT p.id, p.name, p.git_provider, p.git_repository, p.production_branch,
           p.framework, p.status, p.created_at, p.updated_at
    FROM public.deploy_projects p
    JOIN public.users u ON u.id = p.owner_user_id
    WHERE lower(u.email) = ${normalizedEmail}
      AND u.is_active = true
    ORDER BY p.updated_at DESC, p.created_at DESC
    LIMIT ${safeLimit}
  ` as Array<Record<string, unknown>>;

  return rows.map(mapProject);
}

export async function createDeployProject(
  email: string,
  input: CreateDeployProjectInput,
): Promise<DeployProject | null> {
  const sql = await getReadySql();
  const normalizedEmail = email.trim().toLowerCase();

  const rows = await sql`
    WITH target_user AS (
      SELECT id
      FROM public.users
      WHERE lower(email) = ${normalizedEmail}
        AND is_active = true
      LIMIT 1
    )
    INSERT INTO public.deploy_projects (
      owner_user_id,
      name,
      git_provider,
      git_repository,
      production_branch,
      framework,
      status
    )
    SELECT
      u.id,
      ${input.name},
      'github',
      ${input.gitRepository},
      ${input.productionBranch},
      ${input.framework},
      'active'
    FROM target_user u
    ON CONFLICT (owner_user_id, git_provider, git_repository) DO NOTHING
    RETURNING id, name, git_provider, git_repository, production_branch,
              framework, status, created_at, updated_at
  ` as Array<Record<string, unknown>>;

  return rows[0] ? mapProject(rows[0]) : null;
}
