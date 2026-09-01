import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import styles from "./admin.module.css";
import UserInspector from "./UserInspector";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAdminUserSummaries, type AdminUserSummary } from "@/lib/db";
import { getAdminSystemSummary, type AdminSystemSummary } from "@/lib/admin-system";
import { readActiveSession } from "@/lib/session";
import { canAccessAdmin, canInspectUser360, getUserRole, roleLabel } from "@/lib/user-role";

export default async function AdminPage() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/admin");

  const role = await getUserRole(session.email);
  if (!canAccessAdmin(role)) redirect("/dashboard?error=admin_access");
  const canInspectUsers = canInspectUser360(role);

  let users: AdminUserSummary[] = [];
  let system: AdminSystemSummary | null = null;
  try {
    [users, system] = await Promise.all([
      canInspectUsers ? getAdminUserSummaries() : Promise.resolve([]),
      getAdminSystemSummary(),
    ]);
  } catch (error) {
    console.error("Falha ao carregar telemetria do NEYVIX Admin", error);
  }

  const modules = [
    {
      label: "IDENTIDADE",
      title: "NEYVIX ID",
      state: system ? `${system.activeUsers}/${system.usersTotal} ativos` : "Indisponível",
      text: "Contas, sessões, trial e identidade da organização.",
    },
    {
      label: "INTELIGÊNCIA",
      title: "AI Gateway",
      state: system?.gatewayConfigured && system.gatewaySecretConfigured ? "Pronto" : system?.gatewayConfigured ? "Parcial" : "Não configurado",
      text: "Gateway de inteligência da NEYVIX para planejamento, criação e execução assistida.",
    },
    {
      label: "MEMÓRIA",
      title: "NEYVIX Memory",
      state: system ? `${system.memories} memórias` : "Indisponível",
      text: system?.memoryAiContextEnabled
        ? "Contexto para AI habilitado; somente memórias autorizadas podem ser utilizadas."
        : "Persistência disponível; contexto para AI permanece desativado por padrão.",
    },
    {
      label: "CONSTRUÇÃO",
      title: "Studio",
      state: system ? `${system.studioProjects} projetos` : "Indisponível",
      text: "Workspace para transformar prompts em blueprints de produto.",
    },
    {
      label: "CONTEÚDO",
      title: "Content",
      state: system ? `${system.contentItems} itens` : "Indisponível",
      text: "Workspace de marketing, campanhas e comunicação.",
    },
    {
      label: "OPERAÇÕES",
      title: "User 360",
      state: canInspectUsers ? (system?.activeWithoutSubscription ? `${system.activeWithoutSubscription} atenção` : "Consistente") : "Restrito",
      text: canInspectUsers
        ? "Visão real de identidade, assinatura e atividade por usuário, sem alterar dados automaticamente."
        : "Detalhes pessoais e históricos ficam disponíveis apenas para administradores autorizados.",
    },
  ];

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
          <p className={styles.lead}>Identidade, inteligência, memória e criação convergem aqui. O User 360 aplica menor privilégio: telemetria operacional continua disponível sem expor detalhes pessoais a papéis que não precisam deles.</p>
        </div>
        <div className={styles.coreOrb} aria-hidden="true"><span>CORE</span></div>
      </section>

      <section className={styles.strip}>
        <div><span>USUÁRIOS</span><strong>{system ? `${system.activeUsers} ativos de ${system.usersTotal}` : "Banco indisponível"}</strong></div>
        <div><span>ASSINATURAS</span><strong>{system ? `${system.neyvixSubscriptions} NEYVIX` : "Não verificado"}</strong></div>
        <div><span>SEM ASSINATURA</span><strong>{system ? `${system.activeWithoutSubscription} ativos` : "Não verificado"}</strong></div>
        <div><span>AI</span><strong>{system?.gatewayConfigured && system.gatewaySecretConfigured ? "Gateway pronto" : system?.gatewayConfigured ? "Gateway parcial" : "Gateway indisponível"}</strong></div>
      </section>

      {canInspectUsers ? (
        <UserInspector users={users} />
      ) : (
        <section className={styles.user360Empty}>
          <p className="eyebrow">USER 360 · ACESSO RESTRITO</p>
          <h2>Telemetria sem exposição desnecessária</h2>
          <p>Seu papel pode acompanhar o estado operacional do ecossistema, mas e-mails, históricos de AI e atividade individual exigem permissão de administrador.</p>
        </section>
      )}

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
          <p className="eyebrow">TELEMETRIA REAL</p>
          <h2>O painel agora reflete o que realmente existe.</h2>
          <p>{system
            ? `${system.aiMessages} mensagens AI, ${system.memories} memórias, ${system.studioProjects} projetos Studio e ${system.contentItems} itens de conteúdo persistidos. Nenhum número nesta área é estimado.`
            : "A telemetria não pôde ser carregada. O painel mantém o estado como não verificado em vez de exibir métricas estimadas."}</p>
        </div>
        <div className={styles.stack}>
          <span>Identidade</span><span>Assinaturas</span><span>IA</span><span>Memory</span><span>Studio</span><span>Conteúdo</span>
        </div>
      </section>
    </main>
  );
}
