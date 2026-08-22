import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

const modules = [
  ["AI", "/ai", "Create, plan and build with NEYVIX AI"],
  ["Mail", "/mail", "Inbox and communication"],
  ["Admin", "/admin", "Users, roles and operations"],
  ["Deploy", "/deploy", "Projects and releases"],
  ["Ecosystem", "/ecosystem", "NEYVIX product map"],
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
    <main className="dashboard-shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">NEYVIX ID</p>
          <h1>Welcome, {session.name}.</h1>
          <p className="muted">Signed in as {session.email}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="secondary-button" type="submit">Sign out</button>
        </form>
      </section>

      <section className="module-grid">
        {modules.map(([name, href, description]) => (
          <Link key={name} href={href} className="module-card">
            <span className="eyebrow">NEYVIX {name}</span>
            <h2>{name}</h2>
            <p>{description}</p>
          </Link>
        ))}
      </section>

      <section className="status-card">
        <div>
          <p className="eyebrow">Identity core</p>
          <h2>Preview session active</h2>
        </div>
        <p className="muted">This working preview stores the encrypted password verifier in a signed, HttpOnly browser cookie. The production milestone is migrating account storage to a dedicated NEYVIX Postgres database.</p>
      </section>
    </main>
  );
}
