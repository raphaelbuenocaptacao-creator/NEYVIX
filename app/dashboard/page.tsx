import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { getRecentActivity, getTrialStatus } from "@/lib/db";

const modules = [
  ["AI", "/ai", "Pense, planeje e execute com a inteligência NEYVIX", "Perguntar"],
  ["Studio", "/studio", "Transforme ideias em blueprints de produto", "Construir"],
  ["Content", "/content", "Crie campanhas, roteiros e materiais de lançamento", "Criar"],
  ["Mail", "/mail", "Comunique-se dentro da mesma identidade", "Conectar"],
  ["Deploy", "/deploy", "Projetos, versões e publicação", "Publicar"],
  ["Admin", "/admin", "Usuários, acesso, uso e operação", "Controlar"],
  ["Ecossistema", "/ecosystem", "Explore todo o universo de produtos NEYVIX", "Explorar"],
] as const;

type ActivityRow = {
  source: string;
  kind: string;
  summary: string;
  created_at: string;
};

const sourceMeta: Record<string, { icon: string; title: string }> = {
  ai: { icon: "AI", title: "NEYVIX AI" },
  studio: { icon: "ST", title: "NEYVIX Studio" },
  content: { icon: "CT", title: "NEYVIX Content" },
};

function relativeTime(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff)) return "agora";
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

export default async function DashboardPage() {
  const store = await cookies();
  let session;
  try {
    session = readSession(store.get(SESSION_COOKIE)?.value);
  } catch {
    session = null;
  }
  if (!session) redirect("/login");

  let activity: ActivityRow[] = [];
  let trial: { status?: string; trial_ends_at?: string } | null = null;
  try {
    const [recent, trialStatus] = await Promise.all([
      getRecentActivity(session.email, 8),
      getTrialStatus(session.email),
    ]);
    activity = recent as unknown as ActivityRow[];
    trial = trialStatus as { status?: string; trial_ends_at?: string } | null;
  } catch (error) {
    console.error("Falha ao carregar atividade do Command Center", error);
  }

  const trialLabel = trial?.status === "trialing" && trial.trial_ends_at
    ? `Trial até ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(trial.trial_ends_at))}`
    : trial?.status
      ? `Plano: ${trial.status}`
      : "Plano em sincronização";

  return (
    <main className="command-shell">
      <header className="command-header">
        <div>
          <div className="brand-lockup">NEYVIX</div>
          <p className="eyebrow">CENTRAL DE COMANDO</p>
        </div>
        <div className="command-user">
          <div className="user-copy">
            <strong>{session.name}</strong>
            <span>{session.email}</span>
            <small>{trialLabel}</small>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="secondary-button" type="submit">Sair</button>
          </form>
        </div>
      </header>

      <section className="command-hero-card">
        <div className="command-hero-copy">
          <div className="live-pill"><span /> NEYVIX PRONTA</div>
          <h1>O que você quer fazer acontecer?</h1>
          <p className="muted">Comece pela intenção. A NEYVIX conecta você à inteligência, ao workspace e à camada de execução certa.</p>
        </div>
        <Link href="/ai" className="command-prompt-box">
          <span className="command-key">N</span>
          <span className="command-placeholder">Peça para a NEYVIX criar, planejar, analisar ou automatizar…</span>
          <span className="command-enter">Abrir AI ↗</span>
        </Link>
        <div className="quick-command-row">
          <Link href="/studio">Criar um app</Link>
          <Link href="/content">Criar uma campanha</Link>
          <Link href="/ai">Planejar uma automação</Link>
          <Link href="/deploy">Publicar um projeto</Link>
        </div>
      </section>

      <section className="command-layout">
        <div className="command-main">
          <div className="section-heading compact-heading">
            <p className="eyebrow">SEU ECOSSISTEMA</p>
            <h2>Tudo funciona como um só workspace.</h2>
          </div>
          <div className="command-module-grid">
            {modules.map(([name, href, description, action], index) => (
              <Link key={name} href={href} className="command-module-card">
                <div className="module-card-topline"><span>0{index + 1}</span><em>{action}</em></div>
                <div>
                  <h3>{name}</h3>
                  <p>{description}</p>
                </div>
                <span className="module-open">↗</span>
              </Link>
            ))}
          </div>
        </div>

        <aside className="activity-panel">
          <div className="activity-head">
            <div>
              <p className="eyebrow">CENTRO DE ATIVIDADE</p>
              <h2>Pulso do sistema</h2>
            </div>
            <span className="status-badge">AO VIVO</span>
          </div>

          <div className="activity-list">
            {activity.length > 0 ? activity.map((item, index) => {
              const meta = sourceMeta[item.source] ?? { icon: "NX", title: "NEYVIX" };
              return (
                <div className="activity-item" key={`${item.source}-${item.created_at}-${index}`}>
                  <span className="activity-icon">{meta.icon}</span>
                  <div>
                    <strong>{meta.title}</strong>
                    <p>{item.summary}</p>
                  </div>
                  <em>{relativeTime(item.created_at)}</em>
                </div>
              );
            }) : (
              <>
                <div className="activity-item"><span className="activity-icon">ID</span><div><strong>NEYVIX ID ativo</strong><p>{session.email}</p></div><em>Agora</em></div>
                <div className="activity-item"><span className="activity-icon">NX</span><div><strong>Seu histórico começa aqui</strong><p>Use AI, Studio ou Content e suas atividades aparecerão nesta linha do tempo.</p></div><em>Pronto</em></div>
              </>
            )}
          </div>

          <div className="activity-note">
            <span>Base conectada</span>
            <strong>Identidade + AI + Studio + Content</strong>
            <p>O Command Center agora lê atividade persistida no Neon e apresenta o histórico real desta identidade NEYVIX.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
