import Link from "next/link";
import { getHealthStatus } from "@/lib/health";
import "./status.css";

function flag(value: boolean) {
  return value ? "Operacional" : "Aguardando configuração";
}

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const health = await getHealthStatus();
  const sessionReady = Boolean(process.env.NEYVIX_SESSION_SECRET?.trim());
  const aiReady = Boolean(process.env.NEYVIX_AI_GATEWAY_URL?.trim());
  const billingReady = Boolean(process.env.NEYVIX_BILLING_WEBHOOK_SECRET?.trim());
  const checkoutReady = Boolean(process.env.NEYVIX_PAYMENT_PROVIDER?.trim());
  const mailReady = Boolean(process.env.NEYVIX_MAIL_TRANSPORT_URL?.trim());
  const storageReady = Boolean(process.env.NEYVIX_STORAGE_UPLOAD_URL?.trim());

  const core = health.ok && sessionReady;
  const checks = [
    ["Core NEYVIX", core ? "Operacional" : "Degradado", "Aplicação, identidade e projeto principal"],
    ["Banco / Neon", health.database === "connected" ? "Operacional" : "Degradado", "Persistência central do ecossistema"],
    ["Billing", health.billing === "ready" ? "Operacional" : "Degradado", "Planos, assinaturas e eventos de cobrança"],
    ["Estate", health.estate === "ready" ? "Operacional" : "Degradado", "Sites imobiliários e catálogo de imóveis"],
    ["Mail", health.mail === "ready" ? "Operacional" : "Degradado", "Caixas postais e persistência de mensagens"],
    ["NEYVIX AI", flag(aiReady), "Gateway de inteligência"],
    ["Checkout", flag(checkoutReady && billingReady), "Entrada comercial e confirmação automática"],
    ["Envio externo Mail", flag(mailReady), "Transporte de e-mail para provedores externos"],
    ["Storage", flag(storageReady), "Upload externo de imagens do Estate"],
  ] as const;

  return <main className="status-shell">
    <div className="status-aurora" aria-hidden="true" />
    <nav className="status-nav">
      <Link href="/" className="status-brand">NEYVIX</Link>
      <div><Link href="/ecosystem">Ecossistema</Link><Link href="/plans">Planos</Link><Link href="/login">Entrar</Link></div>
    </nav>

    <section className="status-hero">
      <p>NEYVIX STATUS CENTER</p>
      <h1>{core ? "Sistemas centrais operacionais." : "Operação parcialmente degradada."}</h1>
      <span>Monitoramento público de disponibilidade e preparação das principais camadas do ecossistema.</span>
    </section>

    <section className="status-grid">
      {checks.map(([name, state, description]) => <article key={name} className={state === "Operacional" ? "ok" : state === "Degradado" ? "bad" : "wait"}>
        <div className="status-card-top"><strong>{name}</strong><span>{state}</span></div>
        <p>{description}</p>
      </article>)}
    </section>

    <footer className="status-footer">
      <span>Atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date())}</span>
      <Link href="/api/health">Ver health JSON →</Link>
    </footer>
  </main>;
}
