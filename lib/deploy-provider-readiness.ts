const REQUIRED_ENV = [
  ["NEYVIX_DEPLOY_VERCEL_TOKEN", "token"],
  ["NEYVIX_DEPLOY_VERCEL_PROJECT_ID", "projectId"],
  ["NEYVIX_DEPLOY_VERCEL_TEAM_ID", "teamId"],
] as const;

export type DeployProviderReadiness = {
  provider: "vercel";
  configured: boolean;
  executionEnabled: boolean;
  missing: string[];
};

export function getDeployProviderReadiness(): DeployProviderReadiness {
  const missing = REQUIRED_ENV
    .filter(([envName]) => !process.env[envName]?.trim())
    .map(([, label]) => label);

  const configured = missing.length === 0;
  const executionOptIn = process.env.NEYVIX_DEPLOY_EXECUTION_ENABLED?.trim().toLowerCase() === "true";

  return {
    provider: "vercel",
    configured,
    executionEnabled: configured && executionOptIn,
    missing,
  };
}
