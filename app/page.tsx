import Link from 'next/link';

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">NEYVIX</div>
        <p className="eyebrow">ONE IDENTITY. YOUR DIGITAL WORLD.</p>
        <h1>Everything you use, connected by one identity.</h1>
        <p className="lead">
          NEYVIX connects identity, communication, AI, productivity, business and developer infrastructure through one shared platform core.
        </p>
        <div className="actions">
          <Link className="primary" href="/register">Create NEYVIX ID</Link>
          <Link className="secondary" href="/mail">Open NEYVIX Mail</Link>
          <Link className="secondary" href="/ecosystem">View Ecosystem</Link>
          <Link className="secondary" href="/deploy">Open Deploy</Link>
        </div>
      </section>

      <section id="products" className="grid">
        <article><span>01</span><h2>NEYVIX ID</h2><p>One secure identity for every NEYVIX product.</p></article>
        <article><span>02</span><h2>NEYVIX Mail</h2><p>A focused communication layer built on the shared identity.</p></article>
        <article><span>03</span><h2>NEYVIX Admin</h2><p>Operations, security, audit and platform visibility.</p></article>
        <article><span>04</span><h2>NEYVIX Deploy</h2><p>Git-connected projects, deployments and future cloud orchestration.</p></article>
        <article><span>05</span><h2>NEYVIX Chat + Meet</h2><p>Private messaging, groups, meetings and calls on the shared platform.</p></article>
        <article><span>06</span><h2>NEYVIX AI</h2><p>A provider-neutral intelligence layer across products.</p></article>
        <article><span>07</span><h2>NEYVIX Drive + Docs</h2><p>Files, folders and collaborative documents connected by one storage model.</p></article>
        <article><span>08</span><h2>NEYVIX Social</h2><p>Profiles, posts and relationships connected to NEYVIX ID.</p></article>
        <article><span>09</span><h2>NEYVIX Business</h2><p>Organizations, members and roles for company workspaces.</p></article>
        <article><span>10</span><h2>NEYVIX Pay</h2><p>Wallet and ledger architecture designed for future regulated integrations.</p></article>
        <article><span>11</span><h2>NEYVIX Cloud</h2><p>Developer infrastructure abstractions connected to NEYVIX Deploy.</p></article>
      </section>
    </main>
  );
}
