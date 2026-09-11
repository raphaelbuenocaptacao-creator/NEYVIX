import { neon } from "@neondatabase/serverless";

const PROJECT_COLUMNS = [
  "id",
  "owner_user_id",
  "name",
  "git_provider",
  "git_repository",
  "production_branch",
  "framework",
  "status",
  "created_at",
  "updated_at",
] as const;

const DEPLOYMENT_COLUMNS = [
  "id",
  "project_id",
  "commit_sha",
  "branch",
  "environment",
  "status",
  "provider",
  "provider_deployment_id",
  "deployment_url",
  "started_at",
  "finished_at",
  "created_at",
] as const;

const OWNER_REPOSITORY_UNIQUE = "UNIQUE (owner_user_id, git_provider, git_repository)";
const PROJECT_FOREIGN_KEY = "FOREIGN KEY (project_id) REFERENCES deploy_projects(id) ON DELETE CASCADE";

type DeployHealthChecks = {
  deployProjectsTable: boolean;
  deploymentsTable: boolean;
  deployProjectsColumns: boolean;
  deploymentsColumns: boolean;
  ownerRepositoryUnique: boolean;
  projectForeignKey: boolean;
  historyIndex: boolean;
};

export type DeployHealth = {
  ready: boolean;
  database: "connected" | "not_configured" | "error";
  checks: DeployHealthChecks;
};

function emptyChecks(): DeployHealthChecks {
  return {
    deployProjectsTable: false,
    deploymentsTable: false,
    deployProjectsColumns: false,
    deploymentsColumns: false,
    ownerRepositoryUnique: false,
    projectForeignKey: false,
    historyIndex: false,
  };
}

function normalizeConstraintDefinition(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function getDeployHealth(): Promise<DeployHealth> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return { ready: false, database: "not_configured", checks: emptyChecks() };
  }

  try {
    const sql = neon(databaseUrl);
    const columns = (await sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('deploy_projects', 'deployments')
      ORDER BY table_name, ordinal_position
    `) as Array<{ table_name: string; column_name: string }>;

    const constraints = (await sql`
      SELECT c.conname,
             rel.relname AS table_name,
             pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = 'public'
        AND (
          (rel.relname = 'deploy_projects'
            AND c.conname = 'deploy_projects_owner_user_id_git_provider_git_repository_key')
          OR
          (rel.relname = 'deployments'
            AND c.conname = 'deployments_project_id_fkey')
        )
    `) as Array<{ conname: string; table_name: string; definition: string }>;

    const indexes = (await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_deployments_project_created'
    `) as Array<{ indexname: string }>;

    const projectColumns = new Set(
      columns.filter((row) => row.table_name === "deploy_projects").map((row) => row.column_name),
    );
    const deploymentColumns = new Set(
      columns.filter((row) => row.table_name === "deployments").map((row) => row.column_name),
    );
    const constraintDefinitions = new Map(
      constraints.map((row) => [
        `${row.table_name}:${row.conname}`,
        normalizeConstraintDefinition(row.definition),
      ]),
    );
    const indexNames = new Set(indexes.map((row) => row.indexname));

    const checks: DeployHealthChecks = {
      deployProjectsTable: projectColumns.size > 0,
      deploymentsTable: deploymentColumns.size > 0,
      deployProjectsColumns: PROJECT_COLUMNS.every((column) => projectColumns.has(column)),
      deploymentsColumns: DEPLOYMENT_COLUMNS.every((column) => deploymentColumns.has(column)),
      ownerRepositoryUnique: constraintDefinitions.get(
        "deploy_projects:deploy_projects_owner_user_id_git_provider_git_repository_key",
      ) === OWNER_REPOSITORY_UNIQUE,
      projectForeignKey: constraintDefinitions.get(
        "deployments:deployments_project_id_fkey",
      ) === PROJECT_FOREIGN_KEY,
      historyIndex: indexNames.has("idx_deployments_project_created"),
    };

    return {
      ready: Object.values(checks).every(Boolean),
      database: "connected",
      checks,
    };
  } catch {
    return { ready: false, database: "error", checks: emptyChecks() };
  }
}
