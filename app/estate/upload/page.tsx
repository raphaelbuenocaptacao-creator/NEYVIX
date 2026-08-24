import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import EstateUploadPanel from "@/components/estate-upload-panel";

export default async function EstateUploadPage() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/estate/upload");

  return <main className="shell">
    <section className="hero">
      <div className="brand">NEYVIX <span>Estate</span></div>
      <div className="actions"><Link className="secondary" href="/estate">Voltar ao editor</Link><Link className="secondary" href="/dashboard">Command Center</Link></div>
    </section>
    <EstateUploadPanel />
  </main>;
}
