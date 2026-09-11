"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ProjectSummary = {
  id: string;
  name: string;
  gitRepository: string;
};

type Props = {
  projects: ProjectSummary[];
};

type ApiError = {
  error?: string;
  code?: string;
};

export default function DeployProjectControls({ projects }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function parseError(response: Response) {
    const payload = await response.json().catch(() => null) as ApiError | null;
    if (payload?.code === "SCHEMA_NOT_READY") {
      return "A persistência do NEYVIX Deploy ainda está sendo preparada.";
    }
    return payload?.error || "Não foi possível concluir a operação.";
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") || ""),
          repository: String(data.get("repository") || ""),
          productionBranch: String(data.get("productionBranch") || ""),
          framework: String(data.get("framework") || "") || null,
        }),
      });

      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      form.reset();
      setMessage("Projeto registrado com segurança. Nenhum deployment externo foi executado.");
      router.refresh();
    } catch {
      setError("Falha de rede ao registrar o projeto. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(project: ProjectSummary) {
    if (deletingId) return;
    if (!window.confirm(`Remover ${project.name} do NEYVIX Deploy? Isso não apaga o repositório Git nem um projeto externo.`)) return;

    setDeletingId(project.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/deploy", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });

      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      setMessage(`${project.name} foi removido do NEYVIX Deploy. O repositório externo não foi alterado.`);
      router.refresh();
    } catch {
      setError("Falha de rede ao remover o projeto. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div aria-live="polite">
      <article>
        <span>+</span>
        <h2>Registrar projeto</h2>
        <p>Adicione a referência do repositório. Esta etapa não publica nem altera nada no GitHub ou Vercel.</p>
        <form onSubmit={handleCreate}>
          <label>
            Nome
            <input name="name" required maxLength={120} autoComplete="off" placeholder="Meu projeto" />
          </label>
          <label>
            Repositório GitHub
            <input name="repository" required maxLength={240} autoComplete="off" placeholder="owner/repository" />
          </label>
          <label>
            Branch de produção
            <input name="productionBranch" defaultValue="main" required maxLength={240} autoComplete="off" />
          </label>
          <label>
            Framework
            <input name="framework" maxLength={80} autoComplete="off" placeholder="Next.js" />
          </label>
          <button className="primary" type="submit" disabled={pending}>
            {pending ? "Registrando…" : "Registrar projeto"}
          </button>
        </form>
      </article>

      {projects.map((project) => (
        <article key={`controls-${project.id}`}>
          <span>×</span>
          <h2>{project.name}</h2>
          <p>{project.gitRepository}</p>
          <button className="secondary" type="button" disabled={Boolean(deletingId)} onClick={() => handleDelete(project)}>
            {deletingId === project.id ? "Removendo…" : "Remover do NEYVIX"}
          </button>
        </article>
      ))}

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
