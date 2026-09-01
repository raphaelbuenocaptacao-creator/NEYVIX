"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AutomationItem = {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  actionType: string;
  updatedAt: string;
};

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  archived: "Arquivada",
};

export default function AutomationList({ automations }: { automations: AutomationItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  async function remove(item: AutomationItem) {
    if (busyId) return;
    const confirmed = window.confirm(`Excluir a automação “${item.name}”? Essa ação remove apenas este fluxo da sua conta.`);
    if (!confirmed) return;

    setBusyId(item.id);
    setMessage("");
    try {
      const response = await fetch(`/api/automation?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir a automação");
      setMessage(`Automação “${item.name}” excluída.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao excluir automação");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section aria-label="Automações recentes">
      {message ? <p role="status" aria-live="polite">{message}</p> : null}
      <div className="grid">
        {automations.length ? automations.map((automation) => (
          <article key={automation.id}>
            <span>{statusLabel[automation.status] ?? automation.status}</span>
            <h2>{automation.name}</h2>
            <p>{automation.triggerType} → {automation.actionType}</p>
            <p>Atualizada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(automation.updatedAt))}</p>
            <div className="actions">
              <button
                type="button"
                onClick={() => void remove(automation)}
                disabled={Boolean(busyId)}
                aria-busy={busyId === automation.id}
              >
                {busyId === automation.id ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </article>
        )) : (
          <article>
            <span>01</span>
            <h2>Nenhuma automação ativa</h2>
            <p>Crie o primeiro fluxo assim que a base estiver disponível.</p>
          </article>
        )}
      </div>
    </section>
  );
}
