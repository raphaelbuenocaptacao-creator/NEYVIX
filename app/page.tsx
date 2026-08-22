export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">ZYVO</div>
        <p className="eyebrow">ONE ACCOUNT. EVERYTHING CONNECTED.</p>
        <h1>Your digital world, simplified.</h1>
        <p className="lead">
          Start with ZYVO ID and ZYVO Mail. Built to grow into a complete ecosystem for communication, productivity and AI.
        </p>
        <div className="actions">
          <a className="primary" href="#products">Explore ZYVO</a>
          <a className="secondary" href="#mail">ZYVO Mail</a>
        </div>
      </section>

      <section id="products" className="grid">
        <article><span>01</span><h2>ZYVO ID</h2><p>One secure identity across the entire ZYVO ecosystem.</p></article>
        <article id="mail"><span>02</span><h2>ZYVO Mail</h2><p>A clean, intelligent email experience built for the next generation.</p></article>
        <article><span>03</span><h2>ZYVO AI</h2><p>AI assistance woven into communication, search and productivity.</p></article>
        <article><span>04</span><h2>ZYVO Admin</h2><p>Security, accounts, audit, operations and platform intelligence.</p></article>
      </section>
    </main>
  );
}
