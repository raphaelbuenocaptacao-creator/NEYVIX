import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getEntitlements, canUse } from "@/lib/entitlements";
import {
  DeploySchemaNotReadyError,
  listDeployProjects,
} from "@/lib/deploy-db";
import DeployProjectControls from "./deploy-project-controls";

export default async function DeployPage() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const entitlements = await getEntitlements(session.email);
  const allowed = canUse(entitlements, "deploy");

  let projects = await Promise.resolve<Awaited<ReturnType<typeof listDeployProjects>>>([]);
  let persistenceReady = false;

  if (allowed) {
    try {
      projects = await listDeployProjects(session.email);
      persistenceReady = true;
    } catch (error) {
      if (!(error instanceof DeploySchemaNotReadyError)) throw error;
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">NEYVIX <span>Deploy</span></div>
        <p className="eyebrow">CONSTRUA. PUBLIQUE. ESCALE.</p>
        <h1>Do Git para o mundo.</h1>
        <p className="lead">Conecte um repositório, acompanhe versões e publique projetos dentro do mesmo ecossistema NEYVIX.</p>
        <div className="actions">
          {allowed && persistenceReady ? <a className="primary" href="#projects">Registrar repositório Git</a> : allowed ? <span className="primary" aria-disabled="true">Persistência em preparação</span> : <Link className="primary" href="/plans">Fazer upgrade</Link>}
          <Link className="secondary" href="/dashboard">Central de Comando</Link>
        </div>
        {!allowed && <p className="lead">Seu plano atual ({entitlements.plan}) não inclui Deploy. O recurso é liberado no Pro e Business quando a aplicação de planos estiver ativa.</p>}
        {allowed && !persistenceReady && <p className="lead">O runtime de Deploy está disponível, mas a persistência ainda não está pronta neste ambiente. Nenhum projeto fictício é exibido.</p>}
      </section>

      <section id="projects" className="grid" aria-live="polite">
        {allowed && persistenceReady && (
          <DeployProjectControls
            projects={projects.map((project) => ({
              id: project.id,
              name: project.name,
              gitRepository: project.gitRepository,
            }))}
          />
        )}

        {allowed && persistenceReady && projects.map((project, index) => (
          <article key={project.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{project.name}</h2>
            <p>{project.gitRepository}</p>
            <p><strong>{project.status}</strong> · {project.productionBranch}</p>
            <p>{project.framework ?? project.gitProvider}</p>
          </article>
        ))}

        {allowed && persistenceReady && projects.length === 0 && (
          <article>
            <span>00</span>
            <h2>Nenhum projeto ainda</h2>
            <p>Registre um repositório acima. O NEYVIX salva apenas a referência nesta etapa e não executa deployment externo automaticamente.</p>
          </article>
        )}

        {allowed && !persistenceReady && (
          <article>
            <span>!</span>
            <h2>Persistência indisponível</h2>
            <p>O schema produtivo do NEYVIX Deploy ainda não foi promovido. O módulo permanece em modo seguro, sem inventar projetos ou status.</p>
          </article>
        )}

        {!allowed && (
          <article>
            <span>+</span>
            <h2>Deploy protegido por plano</h2>
            <p>Disponível nos planos Pro e Business quando a aplicação de planos estiver ativa.</p>
          </article>
        )}
      </section>
    </main>
  );
}
