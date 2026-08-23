import Link from "next/link";
import styles from "./admin.module.css";
import UserInspector from "./UserInspector";
import { getAdminUserSummaries } from "@/lib/db";

const modules = [
  { label: "IDENTITY", title: "NEYVIX ID", state: "Connected", text: "Accounts, sessions, trial access and organization identity." },
  { label: "INTELLIGENCE", title: "AI Gateway", state: "Connected", text: "Gemini routed through the NEYVIX AI gateway and n8n." },
  { label: "BUILD", title: "Studio", state: "Beta", text: "Prompt-to-blueprint product creation workspace." },
  { label: "CONTENT", title: "Content", state: "Beta", text: "Marketing and communication generation workspace." },
  { label: "OPERATIONS", title: "Automation", state: "Foundation", text: "Execution runs, approvals and operational workflows." },
  { label: "DELIVERY", title: "Deploy", state: "Foundation", text: "Git-connected releases and deployment orchestration." },
];

export default async function AdminPage() {
  let users = [];
  try {
    users = await getAdminUserSummaries();
  } catch (error) {
    console.error("NEYVIX Admin user summaries failed", error);
  }

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
          <p className={styles.lead}>Identity, intelligence, automation, content, builds and delivery converge here. The new User 360 panel lets you open a person and inspect their NEYVIX activity in one place.</p>
        </div>
        <div className={styles.coreOrb} aria-hidden="true"><span>CORE</span></div>
      </section>

      <section className={styles.strip}>
        <div><span>USERS</span><strong>{users.length ? `${users.length} loaded` : "Awaiting DB"}</strong></div>
        <div><span>AI GATEWAY</span><strong>Connected</strong></div>
        <div><span>TRIAL MODEL</span><strong>7-day foundation</strong></div>
        <div><span>DEPLOY</span><strong>Git-connected</strong></div>
      </section>

      <UserInspector users={users} />

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
          <h2>User context is becoming operational.</h2>
          <p>From here we can add Studio projects, Content history, automation runs, billing and security events to the same user profile.</p>
        </div>
        <div className={styles.stack}>
          <span>Identity events</span><span>AI requests</span><span>Studio builds</span><span>Automation runs</span>
        </div>
      </section>
    </main>
  );
}
