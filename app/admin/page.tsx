import Link from "next/link";

const modules = [
  { label: "IDENTITY", title: "NEYVIX ID", state: "Foundation", text: "Accounts, sessions, trial access and organization identity." },
  { label: "INTELLIGENCE", title: "AI Gateway", state: "Connected", text: "Gemini routed through the NEYVIX AI gateway and n8n." },
  { label: "BUILD", title: "Studio", state: "Beta", text: "Prompt-to-blueprint product creation workspace." },
  { label: "CONTENT", title: "Content", state: "Beta", text: "Marketing and communication generation workspace." },
  { label: "OPERATIONS", title: "Automation", state: "Foundation", text: "Execution runs, approvals and operational workflows." },
  { label: "DELIVERY", title: "Deploy", state: "Foundation", text: "Git-connected releases and deployment orchestration." },
];

export default function AdminPage() {
  return (
    <main className="admin-command-shell">
      <header className="admin-command-topbar">
        <Link href="/dashboard" className="admin-command-brand">NEYVIX</Link>
        <div className="admin-command-status"><span/> PLATFORM CORE</div>
        <Link href="/dashboard" className="secondary-button">Command Center</Link>
      </header>

      <section className="admin-command-hero">
        <div>
          <p className="eyebrow">NEYVIX ADMIN · MASTER OPERATIONS</p>
          <h1>See the ecosystem. Control the system.</h1>
          <p className="lead">Identity, intelligence, automation, content, builds and delivery converge here. Real metrics will appear as each production data source is connected.</p>
        </div>
        <div className="admin-core-orb" aria-hidden="true"><span>CORE</span></div>
      </section>

      <section className="admin-command-strip">
        <div><span>DATA</span><strong>Awaiting production metrics</strong></div>
        <div><span>AI GATEWAY</span><strong>Connected</strong></div>
        <div><span>TRIAL MODEL</span><strong>7-day foundation</strong></div>
        <div><span>DEPLOY</span><strong>Git-connected</strong></div>
      </section>

      <section className="admin-command-grid">
        {modules.map((item) => (
          <article key={item.title} className="admin-command-card">
            <div className="admin-card-top"><span>{item.label}</span><small>{item.state}</small></div>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
            <div className="admin-card-line"><i/><i/><i/></div>
          </article>
        ))}
      </section>

      <section className="admin-activity-panel">
        <div>
          <p className="eyebrow">ACTIVITY CENTER</p>
          <h2>Production data comes next.</h2>
          <p>Users, subscriptions, AI usage, Studio projects, automation runs and audit events will populate this area from Neon and runtime services.</p>
        </div>
        <div className="admin-activity-stack">
          <span>Identity events</span><span>AI requests</span><span>Studio builds</span><span>Automation runs</span>
        </div>
      </section>
    </main>
  );
}
