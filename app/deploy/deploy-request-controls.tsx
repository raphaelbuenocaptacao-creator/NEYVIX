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
  executionNote?: string;
  error?: string;
  code?: string;
};

type Props = {
  projects: ProjectSummary[];
};

export default function DeployRequestControls({ projects }: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? projects[0] ?? null,
    [projectId, projects],
  );
  const [branch, setBranch] = useState(selectedProject?.productionBranch ?? "main");
  const [requests, setRequests] = useState<DeploymentRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setBranch(selectedProject?.productionBranch ?? "main");
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
        if (payload?.providerExecution !== false) {
          throw new Error("Estado de execução externa inesperado. A operação foi interrompida por segurança.");
        }
        setRequests(payload.requests ?? []);
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

    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/deploy/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          branch: String(data.get("branch") || branch || "main"),
          commitSha: String(data.get("commitSha") || "") || null,
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
      if (!payload?.request || payload.providerExecution !== false) {
        setError("Resposta inválida da fila interna. Nenhuma execução externa foi iniciada.");
        return;
      }

      setRequests((current) => [payload.request as DeploymentRequest, ...current.filter((item) => item.id !== payload.request?.id)]);
      setMessage(payload.executionNote || "Solicitação registrada na fila interna. Nenhum deployment externo foi executado.");
      const form = event.currentTarget;
      form.elements.namedItem("commitSha") instanceof HTMLInputElement && (form.elements.namedItem("commitSha") as HTMLInputElement).value === "";
    } catch {
      setError("Falha de rede ao registrar a solicitação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (projects.length === 0) return null;

  return (
    <article aria-live="polite">
      <span>→</span>
      <h2>Solicitar deploy interno</h2>
      <p>Registre uma solicitação rastreável na fila do NEYVIX. Esta etapa ainda não executa Vercel ou GitHub externamente.</p>

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
          <input name="commitSha" maxLength={64} autoComplete="off" placeholder="7+ caracteres hexadecimais" />
        </label>
        <button className="primary" type="submit" disabled={submitting || !projectId}>
          {submitting ? "Registrando…" : "Solicitar deploy interno"}
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
              <strong>{request.status}</strong> · {request.branch}
              {request.commitSha ? ` · ${request.commitSha.slice(0, 12)}` : ""}
              <br />
              <small>{new Date(request.createdAt).toLocaleString("pt-BR")}</small>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
