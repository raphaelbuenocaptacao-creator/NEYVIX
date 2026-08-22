const metrics = [
  { label: "Users", value: "—", description: "Connected NEYVIX IDs" },
  { label: "Mailboxes", value: "—", description: "Provisioned NEYVIX Mail accounts" },
  { label: "Security", value: "Ready", description: "Audit and security event layer planned" },
  { label: "Platform", value: "Foundation", description: "Core services under construction" },
];

export default function AdminPage() {
  return (
    <main className="shell">
      <section className="hero" style={{ minHeight: "42vh" }}>
        <div className="brand">NEYVIX</div>
        <p className="eyebrow">ADMIN</p>
        <h1>Platform control center.</h1>
        <p className="lead">Accounts, security, mail operations, audit and ecosystem health will live here.</p>
      </section>

      <section className="grid">
        {metrics.map((item) => (
          <article key={item.label}>
            <span>{item.label.toUpperCase()}</span>
            <h2>{item.value}</h2>
            <p>{item.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
