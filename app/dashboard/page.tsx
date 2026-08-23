import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

const modules = [
  ["AI", "/ai", "Think, plan and execute with NEYVIX intelligence", "Ask"],
  ["Studio", "/studio", "Transform prompts into product blueprints", "Build"],
  ["Content", "/content", "Generate campaigns, scripts and launch assets", "Create"],
  ["Mail", "/mail", "Communicate inside the same identity layer", "Connect"],
  ["Deploy", "/deploy", "Projects, releases and future cloud orchestration", "Ship"],
  ["Admin", "/admin", "Users, access, usage and operations", "Control"],
  ["Ecosystem", "/ecosystem", "Explore the full NEYVIX product map", "Explore"],
];

export default async function DashboardPage() {
  const store = await cookies();
  let session;
  try {
    session = readSession(store.get(SESSION_COOKIE)?.value);
  } catch {
    session = null;
  }
  if (!session) redirect("/login");

  return (
    <main className="command-shell">
      <header className="command-header">
        <div>
          <div className="brand-lockup">NEYVIX</div>
          <p className="eyebrow">COMMAND CENTER</p>
        </div>
        <div className="command-user">
          <div className="user-copy">
            <strong>{session.name}</strong>
            <span>{session.email}</span>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="secondary-button" type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <section className="command-hero-card">
        <div className="command-hero-copy">
          <div className="live-pill"><span /> NEYVIX READY</div>
          <h1>What do you want to make happen?</h1>
          <p className="muted">Start with an idea. NEYVIX routes you to the right intelligence, workspace or execution layer.</p>
        </div>
        <Link href="/ai" className="command-prompt-box">
          <span className="command-key">N</span>
          <span className="command-placeholder">Ask NEYVIX to create, plan, analyze or automate…</span>
          <span className="command-enter">Open AI ↗</span>
        </Link>
        <div className="quick-command-row">
          <Link href="/studio">Create an app</Link>
          <Link href="/content">Build a launch campaign</Link>
          <Link href="/ai">Plan an automation</Link>
          <Link href="/deploy">Ship a project</Link>
        </div>
      </section>

      <section className="command-layout">
        <div className="command-main">
          <div className="section-heading compact-heading">
            <p className="eyebrow">YOUR ECOSYSTEM</p>
            <h2>Everything is one workspace.</h2>
          </div>
          <div className="command-module-grid">
            {modules.map(([name, href, description, action], index) => (
              <Link key={name} href={href} className="command-module-card">
                <div className="module-card-topline"><span>0{index + 1}</span><em>{action}</em></div>
                <div>
                  <h3>{name}</h3>
                  <p>{description}</p>
                </div>
                <span className="module-open">↗</span>
              </Link>
            ))}
          </div>
        </div>

        <aside className="activity-panel">
          <div className="activity-head">
            <div>
              <p className="eyebrow">ACTIVITY CENTER</p>
              <h2>System pulse</h2>
            </div>
            <span className="status-badge">LIVE</span>
          </div>
          <div className="activity-list">
            <div className="activity-item"><span className="activity-icon">AI</span><div><strong>Intelligence gateway</strong><p>Gemini routed through NEYVIX</p></div><em>Online</em></div>
            <div className="activity-item"><span className="activity-icon">ID</span><div><strong>Identity session</strong><p>Signed in as {session.email}</p></div><em>Active</em></div>
            <div className="activity-item"><span className="activity-icon">ST</span><div><strong>Studio workspace</strong><p>Ready for your next product idea</p></div><em>Ready</em></div>
            <div className="activity-item"><span className="activity-icon">DP</span><div><strong>Deploy layer</strong><p>Connected to the NEYVIX release flow</p></div><em>Ready</em></div>
          </div>
          <div className="activity-note">
            <span>Next milestone</span>
            <strong>Persistent NEYVIX ID + saved activity</strong>
            <p>Database-backed identity, history and project persistence are the next production foundation.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
