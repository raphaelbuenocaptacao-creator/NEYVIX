"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Approval = { id: string; title: string; status: string; createdAt: string };

export default function AutomationWorkspace({ approvals, schemaReady }: { approvals: Approval[]; schemaReady: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function createAutomation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || busy || !schemaReady) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), triggerType: "manual", actionType: "workflow" }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível criar a automação");
      setName(""); setDescription(""); setMessage("Automação criada com sucesso."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao criar automação"); }
    finally { setBusy(false); }
  }

  async function decide(id: string, decision: "approved" | "rejected") {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/automation/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar a decisão");
      setMessage(decision === "approved" ? "Solicitação aprovada." : "Solicitação rejeitada."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao decidir aprovação"); }
    finally { setBusy(false); }
  }

  return <section className="grid" aria-label="Controles de automação">
    <article>
      <span>＋</span><h2>Novo fluxo</h2>
      <form onSubmit={createAutomation}>
        <input aria-label="Nome da automação" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Ex.: Aprovar publicação" disabled={!schemaReady || busy} />
        <textarea aria-label="Descrição da automação" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="Descreva o objetivo do fluxo" disabled={!schemaReady || busy} />
        <button className="primary" type="submit" disabled={!schemaReady || busy || !name.trim()}>{busy ? "Processando..." : "Criar automação"}</button>
      </form>
      {!schemaReady ? <p>Disponível assim que a migration de Automation estiver aplicada no Neon.</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </article>
    <article>
      <span>✓</span><h2>Decisões pendentes</h2>
      {approvals.filter((item) => item.status === "pending").length ? approvals.filter((item) => item.status === "pending").map((item) => <div key={item.id}>
        <strong>{item.title}</strong><div className="actions"><button type="button" onClick={() => void decide(item.id, "approved")} disabled={busy}>Aprovar</button><button type="button" onClick={() => void decide(item.id, "rejected")} disabled={busy}>Rejeitar</button></div>
      </div>) : <p>Nenhuma decisão pendente para esta conta.</p>}
    </article>
  </section>;
}
