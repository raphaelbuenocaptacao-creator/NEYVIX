import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { listAutomationWorkspace } from "@/lib/automation-db";
import AutomationWorkspace from "@/components/automation-workspace";
import AutomationList from "@/components/automation-list";
import { readActiveSession } from "@/lib/session";

const statusLabel: Record<string, string> = { draft: "Rascunho", active: "Ativa", paused: "Pausada", archived: "Arquivada", pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada", cancelled: "Cancelada" };

export default async function AutomationPage() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/automation");

  let workspace = { automations: [], approvals: [], schemaReady: false } as Awaited<ReturnType<typeof listAutomationWorkspace>>;
  try { workspace = await listAutomationWorkspace(session.email); } catch (error) { console.error("Falha ao carregar o NEYVIX Automation", error); }

  return <main className="shell">
    <section className="hero"><div className="brand">NEYVIX <span>Automation</span></div><p className="eyebrow">AUTOMAÇÕES · APROVAÇÕES · CONTROLE</p><h1>Automatize sem perder o controle.</h1><p className="lead">Crie fluxos, acompanhe execuções e mantenha ações sensíveis atrás de uma etapa de aprovação humana.</p><div className="actions"><Link className="primary" href="/ai">Planejar com a NEYVIX AI</Link><Link className="secondary" href="/dashboard">Central de Comando</Link></div></section>
    <section className="grid"><article><span>A</span><h2>Automações</h2><p>{workspace.schemaReady ? `${workspace.automations.length} fluxos carregados` : "Schema preparado no Git e aguardando migração segura no Neon."}</p></article><article><span>✓</span><h2>Aprovações</h2><p>{workspace.schemaReady ? `${workspace.approvals.filter((item) => item.status === "pending").length} solicitações pendentes` : "A fila será ativada assim que a base de automações estiver aplicada."}</p></article><article><span>↻</span><h2>Execuções</h2><p>Fila, execução, espera por aprovação, sucesso, falha e cancelamento já fazem parte do modelo operacional.</p></article></section>
    <AutomationWorkspace approvals={workspace.approvals} schemaReady={workspace.schemaReady} />
    <AutomationList automations={workspace.automations} />
    <section className="grid" aria-label="Aprovações recentes">{workspace.approvals.length ? workspace.approvals.map((approval) => <article key={approval.id}><span>{statusLabel[approval.status] ?? approval.status}</span><h2>{approval.title}</h2><p>Criada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(approval.createdAt))}</p></article>) : <article><span>✓</span><h2>Fila de aprovação vazia</h2><p>Ações sensíveis podem aguardar decisão humana antes da execução.</p></article>}</section>
  </main>;
}
