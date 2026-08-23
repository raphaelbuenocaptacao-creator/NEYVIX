import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import styles from "./admin.module.css";
import UserInspector from "./UserInspector";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { getAdminUserSummaries, getDatabaseUserByEmail } from "@/lib/db";

const modules = [
  { label: "IDENTIDADE", title: "NEYVIX ID", state: "Conectado", text: "Contas, sessões, trial e identidade da organização." },
  { label: "INTELIGÊNCIA", title: "AI Gateway", state: "Conectado", text: "Gemini roteado pelo gateway de IA da NEYVIX e n8n." },
  { label: "CONSTRUÇÃO", title: "Studio", state: "Beta", text: "Workspace para transformar prompts em blueprints de produto." },
  { label: "CONTEÚDO", title: "Content", state: "Beta", text: "Workspace de marketing, campanhas e comunicação." },
  { label: "OPERAÇÕES", title: "Automation", state: "Base", text: "Execuções, aprovações e fluxos operacionais." },
  { label: "ENTREGA", title: "Deploy", state: "Base", text: "Releases conectadas ao Git e orquestração de publicação." },
];

export default async function AdminPage() {
  const store = await cookies();
  let session = null;
  try {
    session = readSession(store.get(SESSION_COOKIE)?.value);
  } catch {
    session = null;
  }

  if (!session) redirect("/login");

  let currentUser = null;
  try {
    currentUser = await getDatabaseUserByEmail(session.email);
  } catch (error) {
    console.error("Falha ao validar acesso administrativo", error);
  }

  if (!currentUser?.is_superadmin || !currentUser.is_active) {
    redirect("/dashboard?error=admin_access");
  }

  let users = [];
  try {
    users = await getAdminUserSummaries();
  } catch (error) {
    console.error("Falha ao carregar usuários no NEYVIX Admin", error);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brand}>NEYVIX</Link>
        <div className={styles.status}><span/> CORE DA PLATAFORMA</div>
        <Link href="/dashboard" className={styles.back}>Central de Comando</Link>
      </header>

      <section className={styles.hero}>
        <div>
          <p className="eyebrow">NEYVIX ADMIN · OPERAÇÃO MESTRA</p>
          <h1>Veja o ecossistema. Controle o sistema.</h1>
          <p className={styles.lead}>Identidade, inteligência, automação, conteúdo, builds e entrega convergem aqui. O User 360 agora reúne o contexto real de cada pessoa em um único painel.</p>
        </div>
        <div className={styles.coreOrb} aria-hidden="true"><span>CORE</span></div>
      </section>

      <section className={styles.strip}>
        <div><span>USUÁRIOS</span><strong>{users.length ? `${users.length} carregados` : "Aguardando banco"}</strong></div>
        <div><span>AI GATEWAY</span><strong>Conectado</strong></div>
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
          <p>AI, Studio e Content já entram na mesma linha do tempo. Os próximos eventos a incorporar são automações, cobrança, segurança e dispositivos.</p>
        </div>
        <div className={styles.stack}>
          <span>Identidade</span><span>IA</span><span>Studio</span><span>Conteúdo</span><span>Automações</span>
        </div>
      </section>
    </main>
  );
}
