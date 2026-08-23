import Link from "next/link";
import styles from "./admin.module.css";

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
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brand}>NEYVIX</Link>
        <div className={styles.status}><span/> PLATFORM CORE</div>
        <Link href="/dashboard" className={styles.back}>Command Center</Link>
      </header>

      <section className={styles.hero}>
        <div>
          <p className="eyebrow">NEYVIX ADMIN · MASTER OPERATIONS</p>
          <h1>See the ecosystem. Control the system.</h1>
          <p className={styles.lead}>Identity, intelligence, automation, content, builds and delivery converge here. Real metrics will appear as each production data source is connected.</p>
        </div>
        <div className={styles.coreOrb} aria-hidden="true"><span>CORE</span></div>
      </section>

      <section className={styles.strip}>
        <div><span>DATA</span><strong>Awaiting production metrics</strong></div>
        <div><span>AI GATEWAY</span><strong>Connected</strong></div>
        <div><span>TRIAL MODEL</span><strong>7-day foundation</strong></div>
        <div><span>DEPLOY</span><strong>Git-connected</strong></div>
      </section>

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
          <p className="eyebrow">ACTIVITY CENTER</p>
          <h2>Production data comes next.</h2>
          <p>Users, subscriptions, AI usage, Studio projects, automation runs and audit events will populate this area from Neon and runtime services.</p>
        </div>
        <div className={styles.stack}>
          <span>Identity events</span><span>AI requests</span><span>Studio builds</span><span>Automation runs</span>
        </div>
      </section>
    </main>
  );
}
