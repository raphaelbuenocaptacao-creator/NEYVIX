"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ProjectSummary = {
  id: string;
  name: string;
  productionBranch: string;
};

type DeploymentRequest = {
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

type RequestPayload = {
  requests?: DeploymentRequest[];
  request?: DeploymentRequest;
  providerExecution?: boolean;
  providerAccepted?: boolean;
  providerChecked?: boolean;
  providerState?: string | null;
  providerReason?: string;
  providerHttpStatus?: number | null;
  executionNote?: string;
  error?: string;
  code?: string;
};

type Props = {
  projects: ProjectSummary[];
};

function statusLabel(status: string) {
  switch (status) {
    case "queued": return "na fila";
    case "building": return "construindo";
    case "ready": return "pronto";
    case "failed": return "falhou";
    default: return status;
  }
}

export default function DeployRequestControls({ projects }: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? projects[0] ?? null,
    [projectId, projects],
  );
  const [branch, setBranch] = useState(selectedProject?.productionBranch ?? "main");
  const [commitSha, setCommitSha] = useState("");
  const [requests, setRequests] = useState<DeploymentRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setBranch(selectedProject?.productionBranch ?? "main");
    setCommitSha("");
    setMessage("");
  }, [selectedProject]);

  useEffect(() => {
    if (!projectId) {
      setRequests([]);
      return;
    }

    const controller = new AbortController();
    setLoadingHistory(true);
    setError("");

    fetch(`/api/deploy/requests?projectId=${encodeURIComponent(projectId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as RequestPayload | null;
        if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar o histórico.");
        setRequests(payload?.requests ?? []);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setRequests([]);
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar o histórico.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingHistory(false);
      });

    return () => controller.abort();
  }, [projectId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || submitting) return;

    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/deploy/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          branch,
          commitSha: commitSha.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => null) as RequestPayload | null;

      if (!response.ok) {
        if (payload?.code === "SCHEMA_NOT_READY") {
          setError("A persistência do NEYVIX Deploy ainda está sendo preparada.");
        } else {
          setError(payload?.error || "Não foi possível registrar a solicitação.");
        }
        return;
      }
      if (!payload?.request) {
        setError("Resposta inválida do NEYVIX Deploy.");
        return;
      }

      setRequests((current) => [payload.request as DeploymentRequest, ...current.filter((item) => item.id !== payload.request?.id)]);
      setCommitSha("");

      if (payload.providerExecution && payload.providerAccepted) {
        setMessage(payload.executionNote || "Deployment aceito pelo provider e acompanhado pelo NEYVIX.");
      } else if (payload.providerExecution) {
        setMessage(payload.executionNote || "O provider foi consultado, mas não aceitou o deployment.");
      } else {
        setMessage(payload.executionNote || "Solicitação registrada com segurança na fila do NEYVIX.");
      }
    } catch {
      setError("Falha de rede ao registrar a solicitação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReconcile(deploymentId: string) {
    if (reconcilingId) return;
    setReconcilingId(deploymentId);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/deploy/requests/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentId }),
      });
      const payload = await response.json().catch(() => null) as RequestPayload | null;
      if (!response.ok) {
        setError(payload?.error || "Não foi possível atualizar o status do deployment.");
        return;
      }
      if (!payload?.request) {
        setError("Resposta inválida ao atualizar o deployment.");
        return;
      }

      setRequests((current) => current.map((item) => item.id === payload.request?.id ? payload.request as DeploymentRequest : item));
      if (payload.request.status === "ready") {
        setMessage("Deployment concluído e confirmado pelo provider.");
      } else if (payload.request.status === "failed") {
        setMessage("O provider confirmou que o deployment falhou ou foi cancelado.");
      } else if (payload.providerChecked) {
        setMessage("Status consultado no provider. O deployment ainda está em andamento.");
      } else {
        setMessage("Status mantido. A consulta externa continua bloqueada até configuração e opt-in seguros.");
      }
    } catch {
      setError("Falha de rede ao atualizar o status do deployment.");
    } finally {
      setReconcilingId(null);
    }
  }

  if (projects.length === 0) return null;

  return (
    <article aria-live="polite">
      <span>→</span>
      <h2>Solicitar deploy</h2>
      <p>Registre uma solicitação rastreável. Quando o provider estiver configurado e habilitado com opt-in explícito, o NEYVIX executa e acompanha o deployment; caso contrário, mantém a fila interna fail-closed.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Projeto
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <label>
          Branch
          <input name="branch" value={branch} onChange={(event) => setBranch(event.target.value)} required maxLength={240} autoComplete="off" />
        </label>
        <label>
          Commit SHA opcional
          <input name="commitSha" value={commitSha} onChange={(event) => setCommitSha(event.target.value)} maxLength={64} autoComplete="off" placeholder="7+ caracteres hexadecimais" />
        </label>
        <button className="primary" type="submit" disabled={submitting || !projectId}>
          {submitting ? "Enviando…" : "Solicitar deploy"}
        </button>
      </form>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <h3>Histórico de solicitações</h3>
      {loadingHistory ? (
        <p role="status">Carregando histórico…</p>
      ) : requests.length === 0 ? (
        <p>Nenhuma solicitação registrada para este projeto.</p>
      ) : (
        <ul>
          {requests.map((request) => (
            <li key={request.id}>
              <strong>{statusLabel(request.status)}</strong> · {request.branch}
              {request.commitSha ? ` · ${request.commitSha.slice(0, 12)}` : ""}
              <br />
              <small>{new Date(request.createdAt).toLocaleString("pt-BR")}</small>
              {request.deploymentUrl && (
                <>
                  <br />
                  <a href={request.deploymentUrl} target="_blank" rel="noreferrer">Abrir deployment</a>
                </>
              )}
              {request.status === "building" && request.provider === "vercel" && request.providerDeploymentId && (
                <>
                  <br />
                  <button type="button" onClick={() => handleReconcile(request.id)} disabled={reconcilingId !== null}>
                    {reconcilingId === request.id ? "Atualizando…" : "Atualizar status"}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
