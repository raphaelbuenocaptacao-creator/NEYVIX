import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { listMemories, listMemoryEvents } from "@/lib/memory-db";
import SmartMemoryClient from "./smart-memory-client";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  invalid: "Revise a chave, categoria e conteúdo da memória.",
  unavailable: "A memória ainda não está disponível neste ambiente.",
  not_found: "Memória não encontrada.",
};

const eventLabels: Record<string, string> = {
  upsert: "Memória salva ou atualizada",
  delete: "Memória apagada",
  recall: "Memória consultada pela NEYVIX AI",
  privacy: "Permissão de uso pela AI alterada",
};

export default async function MemoryPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string; error?: string; shared?: string; privacy?: string }> }) {
  const params = await searchParams;
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/memory");

  const [memories, events] = await Promise.all([
    listMemories(session.email, 100),
    listMemoryEvents(session.email, 12),
  ]);
  const notice = params.saved === "1"
    ? (params.shared === "1" ? "Memória salva e autorizada para contexto da NEYVIX AI." : "Memória salva como privada.")
    : params.deleted === "1"
      ? "Memória removida."
      : params.privacy === "shared"
        ? "Memória autorizada para contexto da NEYVIX AI."
        : params.privacy === "private"
          ? "Memória marcada como privada e removida do contexto da AI."
          : params.error ? notices[params.error] : null;

  return <main className="shell">
    <section className="hero">
      <div className="brand">NEYVIX <span>MEMORY</span></div>
      <p className="eyebrow">MEMÓRIA PESSOAL EM NUVEM</p>
      <h1>O NEYVIX pode lembrar do que importa para você.</h1>
      <p className="lead">Preferências, contexto de trabalho, projetos e decisões ficam vinculados ao seu NEYVIX ID. Você controla o que entra, o que pode ser usado pela AI e pode apagar quando quiser.</p>
      <div className="actions"><Link className="secondary" href="/dashboard">Voltar ao Command Center</Link><Link className="secondary" href="/ai">Abrir NEYVIX AI</Link></div>
    </section>

    {notice ? <section className="hero" style={{ marginTop: "1rem" }}><strong>{notice}</strong></section> : null}

    <SmartMemoryClient />

    <section className="hero" style={{ marginTop: "1.5rem" }}>
      <p className="eyebrow">SALVAR OU ATUALIZAR MANUALMENTE</p>
      <form className="auth-form" action="/api/memory" method="post">
        <label>Chave<input name="key" maxLength={120} placeholder="ex.: preferencia.idioma" required /></label>
        <label>Categoria<input name="category" maxLength={60} placeholder="preferencia, negocio, projeto..." defaultValue="general" required /></label>
        <label>O que lembrar<textarea name="value" rows={4} maxLength={4000} placeholder="Descreva de forma objetiva o que o NEYVIX deve lembrar." required /></label>
        <label><input type="checkbox" name="shareWithAi" /> Permitir que esta memória seja usada como contexto pela NEYVIX AI quando eu ativar memória na conversa.</label>
        <button className="primary-button" type="submit">Salvar na memória</button>
      </form>
      <p className="lead">Por padrão, toda memória é privada. Você pode mudar a permissão de uso pela AI diretamente em cada card, sem reescrever o conteúdo.</p>
    </section>

    <section className="grid" style={{ marginTop: "2rem" }}>
      {memories.length ? memories.map((memory) => <article key={memory.id}>
        <span>{memory.category.toUpperCase()}</span>
        <h2>{memory.key}</h2>
        <p>{memory.value}</p>
        <p>{memory.isPrivate ? "Privada · não enviada à AI" : "Autorizada para contexto da AI"}</p>
        <p>Origem: {memory.source} · Atualizada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(memory.updatedAt))}</p>
        <div className="actions">
          <form action="/api/memory/privacy" method="post">
            <input type="hidden" name="id" value={memory.id} />
            <input type="hidden" name="mode" value={memory.isPrivate ? "shared" : "private"} />
            <button className="secondary" type="submit">{memory.isPrivate ? "Permitir na AI" : "Tornar privada"}</button>
          </form>
          <form action="/api/memory/delete" method="post">
            <input type="hidden" name="id" value={memory.id} />
            <button className="secondary" type="submit">Apagar memória</button>
          </form>
        </div>
      </article>) : <article><span>MEMORY</span><h2>Nenhuma memória salva ainda.</h2><p>Adicione a primeira informação acima. O histórico de conversas da AI continua separado desta memória de longo prazo.</p></article>}
    </section>

    <section className="hero" style={{ marginTop: "1.5rem" }}>
      <p className="eyebrow">ATIVIDADE E PRIVACIDADE</p>
      <h2>Você pode ver quando sua memória foi alterada ou consultada.</h2>
      <p className="lead">Consultas feitas pela NEYVIX AI só aparecem aqui quando uma memória previamente autorizada é carregada como contexto. Memórias privadas não entram nesse fluxo. Mudanças de permissão também ficam auditadas.</p>
      {events.length ? <div className="grid" style={{ marginTop: "1rem" }}>
        {events.map((event) => <article key={event.id}>
          <span>{event.source.toUpperCase()}</span>
          <h3>{eventLabels[event.action] ?? event.action}</h3>
          <p>{typeof event.metadata.key === "string" ? event.metadata.key : "Atividade da NEYVIX Memory"}</p>
          <p>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.createdAt))}</p>
        </article>)}
      </div> : <p className="lead">Nenhuma atividade de memória registrada ainda.</p>}
    </section>
  </main>;
}
