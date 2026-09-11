import { neon } from "@neondatabase/serverless";

export type EcosystemModuleState = "ready" | "partial" | "missing" | "unknown";

export type EcosystemModuleReadiness = {
  database: "connected" | "not_configured" | "error";
  social: EcosystemModuleState;
  meet: EcosystemModuleState;
  deploy: EcosystemModuleState;
  cloud: EcosystemModuleState;
  business: EcosystemModuleState;
  pay: EcosystemModuleState;
};

type TableContract = Record<string, readonly string[]>;

const CONTRACTS: Record<Exclude<keyof EcosystemModuleReadiness, "database">, TableContract> = {
  social: {
    social_profiles: ["user_id", "bio", "avatar_url", "is_private", "created_at", "updated_at"],
    social_posts: ["id", "author_user_id", "body", "visibility", "metadata", "created_at", "updated_at"],
    social_follows: ["follower_user_id", "following_user_id", "status", "created_at"],
  },
  meet: {
    meetings: ["id", "owner_user_id", "title", "room_code", "status", "starts_at", "ends_at", "created_at"],
  },
  deploy: {
    deploy_projects: ["id", "owner_user_id", "name", "git_provider", "git_repository", "production_branch", "framework", "status", "created_at", "updated_at"],
    deployments: ["id", "project_id", "commit_sha", "branch", "environment", "status", "provider", "provider_deployment_id", "deployment_url", "started_at", "finished_at", "created_at"],
  },
  cloud: {
    cloud_resources: ["id", "owner_user_id", "project_id", "resource_type", "provider", "provider_resource_id", "region", "status", "metadata", "created_at", "updated_at"],
  },
  business: {
    organizations: ["id", "name", "slug", "owner_user_id", "created_at", "updated_at"],
    organization_members: ["organization_id", "user_id", "role", "created_at"],
  },
  pay: {
    wallets: ["id", "owner_user_id", "organization_id", "currency", "status", "created_at"],
    ledger_accounts: ["id", "wallet_id", "account_type", "created_at"],
    ledger_transactions: ["id", "reference", "status", "metadata", "created_at", "posted_at"],
    ledger_entries: ["id", "transaction_id", "account_id", "direction", "amount_minor", "currency", "created_at"],
  },
};

const MODULES = Object.keys(CONTRACTS) as Array<keyof typeof CONTRACTS>;
const CONTRACT_TABLES = Array.from(
  new Set(MODULES.flatMap((module) => Object.keys(CONTRACTS[module]))),
);

function unavailable(database: EcosystemModuleReadiness["database"]): EcosystemModuleReadiness {
  return {
    database,
    social: "unknown",
    meet: "unknown",
    deploy: "unknown",
    cloud: "unknown",
    business: "unknown",
    pay: "unknown",
  };
}

function moduleState(
  contract: TableContract,
  columnsByTable: Map<string, Set<string>>,
): EcosystemModuleState {
  const tables = Object.entries(contract);
  const existing = tables.filter(([table]) => columnsByTable.has(table));
  if (existing.length === 0) return "missing";
  if (existing.length !== tables.length) return "partial";

  return tables.every(([table, requiredColumns]) => {
    const actual = columnsByTable.get(table) ?? new Set<string>();
    return requiredColumns.every((column) => actual.has(column));
  })
    ? "ready"
    : "partial";
}

export async function getEcosystemModuleReadiness(): Promise<EcosystemModuleReadiness> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return unavailable("not_configured");

  try {
    const sql = neon(databaseUrl);
    const rows = await sql.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name, ordinal_position`,
      [CONTRACT_TABLES],
    ) as Array<{ table_name: string; column_name: string }>;

    const columnsByTable = new Map<string, Set<string>>();
    for (const row of rows) {
      const columns = columnsByTable.get(row.table_name) ?? new Set<string>();
      columns.add(row.column_name);
      columnsByTable.set(row.table_name, columns);
    }

    return {
      database: "connected",
      social: moduleState(CONTRACTS.social, columnsByTable),
      meet: moduleState(CONTRACTS.meet, columnsByTable),
      deploy: moduleState(CONTRACTS.deploy, columnsByTable),
      cloud: moduleState(CONTRACTS.cloud, columnsByTable),
      business: moduleState(CONTRACTS.business, columnsByTable),
      pay: moduleState(CONTRACTS.pay, columnsByTable),
    };
  } catch {
    return unavailable("error");
  }
}
