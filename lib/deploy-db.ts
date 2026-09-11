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

export type DeploymentRequest = {
  id: string;
  projectId: string;
  commitSha: string | null;
  branch: string;
  environment: string;
  status: string;
  provider: string | null;
  providerDeploymentId: string | null;
  deploymentUrl: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type CreateDeploymentRequestInput = {
  projectId: string;
  branch: string;
  commitSha: string | null;
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

function mapDeploymentRequest(row: Record<string, unknown>): DeploymentRequest {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    commitSha: row.commit_sha ? String(row.commit_sha) : null,
    branch: String(row.branch),
    environment: String(row.environment),
    status: String(row.status),
    provider: row.provider ? String(row.provider) : null,
    providerDeploymentId: row.provider_deployment_id ? String(row.provider_deployment_id) : null,
    deploymentUrl: row.deployment_url ? String(row.deployment_url) : null,
    createdAt: String(row.created_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
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

export async function deleteDeployProject(email: string, projectId: string): Promise<boolean> {
  const sql = await getReadySql();
  const normalizedEmail = email.trim().toLowerCase();

  const rows = await sql`
    DELETE FROM public.deploy_projects p
    USING public.users u
    WHERE p.id = ${projectId}::uuid
      AND u.id = p.owner_user_id
      AND lower(u.email) = ${normalizedEmail}
      AND u.is_active = true
    RETURNING p.id
  ` as Array<{ id: string }>;

  return rows.length === 1;
}

export async function listDeploymentRequests(
  email: string,
  projectId: string,
  limit = 50,
): Promise<DeploymentRequest[]> {
  const sql = await getReadySql();
  const normalizedEmail = email.trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(limit, 100));

  const rows = await sql`
    SELECT d.id, d.project_id, d.commit_sha, d.branch, d.environment, d.status,
           d.provider, d.provider_deployment_id, d.deployment_url,
           d.created_at, d.started_at, d.finished_at
    FROM public.deployments d
    JOIN public.deploy_projects p ON p.id = d.project_id
    JOIN public.users u ON u.id = p.owner_user_id
    WHERE d.project_id = ${projectId}::uuid
      AND lower(u.email) = ${normalizedEmail}
      AND u.is_active = true
    ORDER BY d.created_at DESC
    LIMIT ${safeLimit}
  ` as Array<Record<string, unknown>>;

  return rows.map(mapDeploymentRequest);
}

export async function createDeploymentRequest(
  email: string,
  input: CreateDeploymentRequestInput,
): Promise<DeploymentRequest | null> {
  const sql = await getReadySql();
  const normalizedEmail = email.trim().toLowerCase();

  const rows = await sql`
    WITH owned_project AS (
      SELECT p.id
      FROM public.deploy_projects p
      JOIN public.users u ON u.id = p.owner_user_id
      WHERE p.id = ${input.projectId}::uuid
        AND lower(u.email) = ${normalizedEmail}
        AND u.is_active = true
        AND p.status = 'active'
      LIMIT 1
    )
    INSERT INTO public.deployments (
      project_id,
      commit_sha,
      branch,
      environment,
      status
    )
    SELECT
      p.id,
      ${input.commitSha},
      ${input.branch},
      'preview',
      'queued'
    FROM owned_project p
    RETURNING id, project_id, commit_sha, branch, environment, status,
              provider, provider_deployment_id, deployment_url,
              created_at, started_at, finished_at
  ` as Array<Record<string, unknown>>;

  return rows[0] ? mapDeploymentRequest(rows[0]) : null;
}
