export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">NEYVIX</div>
        <p className="eyebrow">ONE IDENTITY. YOUR DIGITAL WORLD.</p>
        <h1>Everything you use, connected by one identity.</h1>
        <p className="lead">
          NEYVIX begins with identity and email, then grows into communication, social, AI, files, productivity, payments and cloud services.
        </p>
        <div className="actions">
          <a className="primary" href="/register">Create NEYVIX ID</a>
          <a className="secondary" href="/mail">Open NEYVIX Mail</a>
        </div>
      </section>

      <section id="products" className="grid">
        <article><span>01</span><h2>NEYVIX ID</h2><p>One secure identity for every NEYVIX product.</p></article>
        <article><span>02</span><h2>NEYVIX Mail</h2><p>A focused, intelligent inbox built as the first communication layer.</p></article>
        <article><span>03</span><h2>NEYVIX Chat</h2><p>Private messaging, groups, voice and video — planned for the next phase.</p></article>
        <article><span>04</span><h2>NEYVIX AI</h2><p>An intelligence layer across communication, search and productivity.</p></article>
        <article><span>05</span><h2>NEYVIX Social</h2><p>A future social network connected to your NEYVIX identity.</p></article>
        <article><span>06</span><h2>NEYVIX Pay</h2><p>Payments and wallet services through compliant regulated infrastructure.</p></article>
      </section>
    </main>
  );
}
