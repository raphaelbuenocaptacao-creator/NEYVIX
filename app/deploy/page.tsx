import Link from 'next/link';

const projects = [
  { name: 'neyvix-web', repo: 'raphaelbuenocaptacao-creator/NEYVIX', status: 'Ready', branch: 'main', url: 'neyvix-web.deploy.local' },
  { name: 'mail', repo: 'NEYVIX/Mail', status: 'Planned', branch: 'main', url: 'mail.deploy.local' },
];

export default function DeployPage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">NEYVIX <span>Deploy</span></div>
        <p className="eyebrow">BUILD. SHIP. SCALE.</p>
        <h1>Deploy from Git to the world.</h1>
        <p className="lead">Connect a repository, build in an isolated runner, publish and manage every deployment from one place.</p>
        <div className="actions">
          <a className="primary" href="#projects">Import Git Repository</a>
          <Link className="secondary" href="/admin">Open Admin</Link>
        </div>
      </section>

      <section id="projects" className="grid">
        {projects.map((project, index) => (
          <article key={project.name}>
            <span>0{index + 1}</span>
            <h2>{project.name}</h2>
            <p>{project.repo}</p>
            <p><strong>{project.status}</strong> · {project.branch}</p>
            <p>{project.url}</p>
          </article>
        ))}
        <article>
          <span>+</span>
          <h2>New Project</h2>
          <p>Connect GitHub and import a repository to create a NEYVIX deployment.</p>
        </article>
      </section>
    </main>
  );
}
