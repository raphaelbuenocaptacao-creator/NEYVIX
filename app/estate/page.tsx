import Link from "next/link";
import EstateBuilder from "@/components/estate-builder";
import { requireActiveSession } from "@/lib/require-active-session";
import "./estate.css";

export default async function EstatePage() {
  await requireActiveSession("/estate");

  return <main className="shell estate-shell">
    <section className="hero estate-hero">
      <div className="brand">NEYVIX <span>Estate</span></div>
      <p className="eyebrow">SITES IMOBILIÁRIOS · IA · PUBLICAÇÃO</p>
      <h1>Seu site imobiliário pronto para vender.</h1>
      <p className="lead">Informe sua marca, região e imóveis. O NEYVIX Estate transforma esses dados em uma presença digital profissional pronta para divulgação.</p>
      <div className="actions"><Link className="secondary" href="/dashboard">Central de Comando</Link><Link className="secondary" href="/ai">Planejar com AI</Link><Link className="secondary" href="/estate/upload">Enviar fotos</Link></div>
    </section>
    <EstateBuilder />
  </main>;
}
