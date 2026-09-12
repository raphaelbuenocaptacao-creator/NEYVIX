import { getDeployProviderReadiness } from "@/lib/deploy-provider-readiness";

export type VercelDeploymentProviderState = "building" | "ready" | "failed";

export type VercelDeploymentStatusResult = {
  provider: "vercel";
  attempted: boolean;
  found: boolean;
  state: VercelDeploymentProviderState | null;
  providerState: string | null;
  deploymentUrl: string | null;
  reason: "provider-not-configured" | "execution-disabled" | "invalid-deployment-id" | "status-read" | "provider-rejected" | "provider-unavailable" | "unknown-provider-state";
  httpStatus: number | null;
};

function disabledResult(
  reason: "provider-not-configured" | "execution-disabled" | "invalid-deployment-id",
): VercelDeploymentStatusResult {
  return {
    provider: "vercel",
    attempted: false,
    found: false,
    state: null,
    providerState: null,
    deploymentUrl: null,
    reason,
    httpStatus: null,
  };
}

function mapProviderState(value: unknown): VercelDeploymentProviderState | null {
  if (typeof value !== "string") return null;
  switch (value.toUpperCase()) {
    case "READY":
      return "ready";
    case "ERROR":
    case "CANCELED":
      return "failed";
    case "BUILDING":
    case "QUEUED":
    case "INITIALIZING":
      return "building";
    default:
      return null;
  }
}

function normalizeDeploymentUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return `https://${value.trim().replace(/^https?:\/\//, "")}`;
}

export async function readVercelDeploymentStatus(
  providerDeploymentId: string,
): Promise<VercelDeploymentStatusResult> {
  const readiness = getDeployProviderReadiness();
  if (!readiness.executionEnabled) {
    return disabledResult(readiness.configured ? "execution-disabled" : "provider-not-configured");
  }

  const deploymentId = providerDeploymentId.trim();
  if (!/^dpl_[A-Za-z0-9]+$/.test(deploymentId)) {
    return disabledResult("invalid-deployment-id");
  }

  const token = process.env.NEYVIX_DEPLOY_VERCEL_TOKEN?.trim();
  const teamId = process.env.NEYVIX_DEPLOY_VERCEL_TEAM_ID?.trim();
  if (!token || !teamId) return disabledResult("provider-not-configured");

  try {
    const response = await fetch(
      `https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentId)}?teamId=${encodeURIComponent(teamId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      },
    );

    const payload = await response.json().catch(() => null) as {
      id?: unknown;
      url?: unknown;
      readyState?: unknown;
      status?: unknown;
    } | null;

    if (!response.ok) {
      return {
        provider: "vercel",
        attempted: true,
        found: false,
        state: null,
        providerState: null,
        deploymentUrl: null,
        reason: "provider-rejected",
        httpStatus: response.status,
      };
    }

    const providerStateRaw = typeof payload?.readyState === "string"
      ? payload.readyState
      : typeof payload?.status === "string"
        ? payload.status
        : null;
    const state = mapProviderState(providerStateRaw);

    return {
      provider: "vercel",
      attempted: true,
      found: true,
      state,
      providerState: providerStateRaw,
      deploymentUrl: normalizeDeploymentUrl(payload?.url),
      reason: state ? "status-read" : "unknown-provider-state",
      httpStatus: response.status,
    };
  } catch {
    return {
      provider: "vercel",
      attempted: true,
      found: false,
      state: null,
      providerState: null,
      deploymentUrl: null,
      reason: "provider-unavailable",
      httpStatus: null,
    };
  }
}
