import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import EstateBuilder from "@/components/estate-builder";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

export default async function EstatePage() {
  const store = await cookies();
  let session = null;
  try { session = readSession(store.get(SESSION_COOKIE)?.value); } catch { session = null; }
  if (!session) redirect("/login");

  return <main className="shell estate-shell">
    <section className="hero estate-hero">
      <div className="brand">NEYVIX <span>Estate</span></div>
      <p className="eyebrow">SITES IMOBILIÁRIOS · IA · PUBLICAÇÃO</p>
      <h1>Seu site imobiliário pronto para vender.</h1>
      <p className="lead">Informe sua marca, região e imóveis. O NEYVIX Estate transforma esses dados em uma presença digital profissional pronta para divulgação.</p>
      <div className="actions"><Link className="secondary" href="/dashboard">Central de Comando</Link><Link className="secondary" href="/ai">Planejar com AI</Link></div>
    </section>
    <EstateBuilder />
  </main>;
}
