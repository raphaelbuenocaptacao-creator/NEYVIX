import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import styles from "./admin.module.css";
import UserInspector from "./UserInspector";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAdminUserSummaries, type AdminUserSummary } from "@/lib/db";
import { readActiveSession } from "@/lib/session";
import { canAccessAdmin, getUserRole, roleLabel } from "@/lib/user-role";

const modules = [
  { label: "IDENTIDADE", title: "NEYVIX ID", state: "Conectado", text: "Contas, sessões, trial e identidade da organização." },
  { label: "INTELIGÊNCIA", title: "AI Gateway", state: "Conectado", text: "Gateway de inteligência da NEYVIX para planejamento, criação e execução assistida." },
  { label: "CONSTRUÇÃO", title: "Studio", state: "Beta", text: "Workspace para transformar prompts em blueprints de produto." },
  { label: "CONTEÚDO", title: "Content", state: "Beta", text: "Workspace de marketing, campanhas e comunicação." },
  { label: "OPERAÇÕES", title: "Automation", state: "Operacional", text: "Execuções, aprovações e fluxos operacionais com ações sensíveis sob controle." },
  { label: "ENTREGA", title: "Deploy", state: "Integrado", text: "Releases conectadas ao Git e orquestração de publicação." },
];

export default async function AdminPage() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/admin");

  const role = await getUserRole(session.email);
  if (!canAccessAdmin(role)) redirect("/dashboard?error=admin_access");

  let users: AdminUserSummary[] = [];
  try {
    users = await getAdminUserSummaries();
  } catch (error) {
    console.error("Falha ao carregar usuários no NEYVIX Admin", error);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brand}>NEYVIX</Link>
        <div className={styles.status}><span/> CORE DA PLATAFORMA · {roleLabel(role)}</div>
        <Link href="/dashboard" className={styles.back}>Central de Comando</Link>
      </header>

      <section className={styles.hero}>
        <div>
          <p className="eyebrow">NEYVIX ADMIN · OPERAÇÃO MESTRA</p>
          <h1>Veja o ecossistema. Controle o sistema.</h1>
          <p className={styles.lead}>Identidade, inteligência, automação, conteúdo, builds e entrega convergem aqui. O User 360 reúne o contexto real de cada pessoa em um único painel.</p>
        </div>
        <div className={styles.coreOrb} aria-hidden="true"><span>CORE</span></div>
      </section>

      <section className={styles.strip}>
        <div><span>USUÁRIOS</span><strong>{users.length ? `${users.length} carregados` : "Aguardando banco"}</strong></div>
        <div><span>SEU PAPEL</span><strong>{roleLabel(role)}</strong></div>
        <div><span>TRIAL</span><strong>7 dias</strong></div>
        <div><span>DEPLOY</span><strong>Conectado ao Git</strong></div>
      </section>

      <UserInspector users={users} />

      <section className={styles.grid}>
        {modules.map((item) => (
          <article key={item.title} className={styles.card}>
            <div className={styles.cardTop}><span>{item.label}</span><small>{item.state}</small></div>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
            <div className={styles.cardLine}><i/><i/><i/></div>
          </article>
        ))}
      </section>

      <section className={styles.activity}>
        <div>
          <p className="eyebrow">CENTRO DE ATIVIDADE</p>
          <h2>O contexto do usuário já virou operação.</h2>
          <p>AI, Studio, Content, Estate, Automation e aprovações já convergem para a visão operacional. Cobrança, segurança e dispositivos seguem como próximas camadas de telemetria.</p>
        </div>
        <div className={styles.stack}>
          <span>Identidade</span><span>IA</span><span>Studio</span><span>Conteúdo</span><span>Estate</span><span>Automações</span><span>Aprovações</span>
        </div>
      </section>
    </main>
  );
}
