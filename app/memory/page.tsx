import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { listMemories } from "@/lib/memory-db";
import SmartMemoryClient from "./smart-memory-client";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  invalid: "Revise a chave, categoria e conteúdo da memória.",
  unavailable: "A memória ainda não está disponível neste ambiente.",
  not_found: "Memória não encontrada.",
};

export default async function MemoryPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string; error?: string }> }) {
  const params = await searchParams;
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/memory");

  const memories = await listMemories(session.email, 100);
  const notice = params.saved === "1" ? "Memória salva." : params.deleted === "1" ? "Memória removida." : params.error ? notices[params.error] : null;

  return <main className="shell">
    <section className="hero">
      <div className="brand">NEYVIX <span>MEMORY</span></div>
      <p className="eyebrow">MEMÓRIA PESSOAL EM NUVEM</p>
      <h1>O NEYVIX pode lembrar do que importa para você.</h1>
      <p className="lead">Preferências, contexto de trabalho, projetos e decisões ficam vinculados ao seu NEYVIX ID. Você controla o que entra e pode apagar quando quiser.</p>
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
        <button className="primary-button" type="submit">Salvar na memória</button>
      </form>
      <p className="lead">Salvar novamente a mesma chave atualiza a memória em vez de duplicar.</p>
    </section>

    <section className="grid" style={{ marginTop: "2rem" }}>
      {memories.length ? memories.map((memory) => <article key={memory.id}>
        <span>{memory.category.toUpperCase()}</span>
        <h2>{memory.key}</h2>
        <p>{memory.value}</p>
        <p>Origem: {memory.source} · Atualizada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(memory.updatedAt))}</p>
        <form action="/api/memory/delete" method="post">
          <input type="hidden" name="id" value={memory.id} />
          <button className="secondary" type="submit">Apagar memória</button>
        </form>
      </article>) : <article><span>MEMORY</span><h2>Nenhuma memória salva ainda.</h2><p>Adicione a primeira informação acima. O histórico de conversas da AI continua separado desta memória de longo prazo.</p></article>}
    </section>
  </main>;
}
