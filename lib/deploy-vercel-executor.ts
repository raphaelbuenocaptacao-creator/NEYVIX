import { getDeployProviderReadiness } from "@/lib/deploy-provider-readiness";

export type VercelDeploymentExecutionInput = {
  gitRepository: string;
  branch: string;
  commitSha: string | null;
  environment: string;
};

export type VercelDeploymentExecutionResult = {
  provider: "vercel";
  attempted: boolean;
  accepted: boolean;
  providerDeploymentId: string | null;
  deploymentUrl: string | null;
  reason: "provider-not-configured" | "execution-disabled" | "invalid-repository" | "accepted" | "provider-rejected" | "provider-unavailable";
  httpStatus: number | null;
};

function disabledResult(reason: "provider-not-configured" | "execution-disabled" | "invalid-repository"): VercelDeploymentExecutionResult {
  return {
    provider: "vercel",
    attempted: false,
    accepted: false,
    providerDeploymentId: null,
    deploymentUrl: null,
    reason,
    httpStatus: null,
  };
}

function parseRepository(repository: string) {
  const [org, repo, extra] = repository.split("/");
  const part = /^[A-Za-z0-9_.-]+$/;
  if (!org || !repo || extra || !part.test(org) || !part.test(repo)) return null;
  return { org, repo };
}

export async function executeVercelDeployment(
  input: VercelDeploymentExecutionInput,
): Promise<VercelDeploymentExecutionResult> {
  const readiness = getDeployProviderReadiness();
  if (!readiness.executionEnabled) {
    return disabledResult(readiness.configured ? "execution-disabled" : "provider-not-configured");
  }

  const repository = parseRepository(input.gitRepository);
  if (!repository) return disabledResult("invalid-repository");

  const token = process.env.NEYVIX_DEPLOY_VERCEL_TOKEN?.trim();
  const projectId = process.env.NEYVIX_DEPLOY_VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.NEYVIX_DEPLOY_VERCEL_TEAM_ID?.trim();
  if (!token || !projectId || !teamId) return disabledResult("provider-not-configured");

  const gitRef = input.commitSha || input.branch;
  const body = {
    name: repository.repo,
    project: projectId,
    gitSource: {
      type: "github" as const,
      org: repository.org,
      repo: repository.repo,
      ref: gitRef,
    },
    ...(input.environment === "production" ? { target: "production" as const } : {}),
  };

  try {
    const response = await fetch(
      `https://api.vercel.com/v13/deployments?teamId=${encodeURIComponent(teamId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      },
    );

    const payload = await response.json().catch(() => null) as {
      id?: unknown;
      url?: unknown;
    } | null;
    const providerDeploymentId = typeof payload?.id === "string" ? payload.id : null;
    const deploymentUrl = typeof payload?.url === "string" && payload.url
      ? `https://${payload.url.replace(/^https?:\/\//, "")}`
      : null;
    const accepted = response.ok && Boolean(providerDeploymentId);

    return {
      provider: "vercel",
      attempted: true,
      accepted,
      providerDeploymentId,
      deploymentUrl,
      reason: accepted ? "accepted" : "provider-rejected",
      httpStatus: response.status,
    };
  } catch {
    return {
      provider: "vercel",
      attempted: true,
      accepted: false,
      providerDeploymentId: null,
      deploymentUrl: null,
      reason: "provider-unavailable",
      httpStatus: null,
    };
  }
}
