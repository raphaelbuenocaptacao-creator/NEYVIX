import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getEntitlements, canUse } from "@/lib/entitlements";

const projects = [
  { name: "neyvix-web", repo: "raphaelbuenocaptacao-creator/NEYVIX", status: "Publicado", branch: "main", url: "neyvix.vercel.app" },
  { name: "mail", repo: "NEYVIX/Mail", status: "Planejado", branch: "main", url: "mail.neyvix.app" },
];

export default async function DeployPage() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const entitlements = await getEntitlements(session.email);
  const allowed = canUse(entitlements, "deploy");

  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">NEYVIX <span>Deploy</span></div>
        <p className="eyebrow">CONSTRUA. PUBLIQUE. ESCALE.</p>
        <h1>Do Git para o mundo.</h1>
        <p className="lead">Conecte um repositório, acompanhe versões e publique projetos dentro do mesmo ecossistema NEYVIX.</p>
        <div className="actions">
          {allowed ? <a className="primary" href="#projects">Importar repositório Git</a> : <Link className="primary" href="/plans">Fazer upgrade</Link>}
          <Link className="secondary" href="/dashboard">Central de Comando</Link>
        </div>
        {!allowed && <p className="lead">Seu plano atual ({entitlements.plan}) não inclui Deploy. O recurso é liberado no Pro e Business quando a aplicação de planos estiver ativa.</p>}
      </section>

      <section id="projects" className="grid">
        {projects.map((project, index) => (
          <article key={project.name}>
            <span>0{index + 1}</span><h2>{project.name}</h2><p>{project.repo}</p><p><strong>{project.status}</strong> · {project.branch}</p><p>{project.url}</p>
          </article>
        ))}
        <article>
          <span>+</span><h2>Novo projeto</h2><p>{allowed ? "Conecte o GitHub e importe um repositório para criar um deployment NEYVIX." : "Disponível nos planos Pro e Business."}</p>
        </article>
      </section>
    </main>
  );
}
