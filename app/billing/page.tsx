import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getEntitlements } from "@/lib/entitlements";

const planCopy = {
  start: { name: "Start", price: "R$ 49/mês" },
  pro: { name: "Pro", price: "R$ 99/mês" },
  business: { name: "Business", price: "R$ 249/mês" },
  trial: { name: "Trial", price: "Acesso antecipado" },
  legacy: { name: "Acesso compatível", price: "Sem cobrança automática" },
  expired: { name: "Acesso expirado", price: "Escolha um plano para continuar" },
} as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const entitlements = await getEntitlements(session.email);
  const current = planCopy[entitlements.plan];
  const trialEnds = entitlements.trialEndsAt ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(entitlements.trialEndsAt)) : null;

  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">NEYVIX <span>BILLING</span></div>
        <p className="eyebrow">ASSINATURA E ACESSO</p>
        <h1>Seu plano controla o que o ecossistema libera.</h1>
        <p className="lead">Acompanhe seu acesso atual, recursos disponíveis e escolha o próximo plano quando estiver pronto.</p>
        <div className="actions"><Link className="secondary" href="/dashboard">Voltar ao Command Center</Link><Link className="secondary" href="/plans">Comparar planos</Link></div>
      </section>

      {params.error === "checkout_unavailable" ? <section className="hero" style={{ marginTop: "1rem" }}><p className="lead">O checkout automático ainda não foi conectado ao provedor de pagamentos. Seu acesso atual continua preservado.</p></section> : null}

      <section className="grid">
        <article>
          <span>PLANO ATUAL</span>
          <h2>{current.name}</h2>
          <p><strong>{current.price}</strong></p>
          <p>Status: {entitlements.status ?? "compatibilidade"}</p>
          {trialEnds ? <p>Trial até {trialEnds}</p> : null}
          <p>Enforcement: {entitlements.enforcementEnabled ? "ativo" : "modo seguro de implantação"}</p>
        </article>
        <article>
          <span>RECURSOS LIBERADOS</span>
          <h2>{entitlements.features.length}</h2>
          <p>{entitlements.features.join(" · ")}</p>
        </article>
        <article>
          <span>ORIGEM</span>
          <h2>{entitlements.source === "database" ? "Banco NEYVIX" : "Compatibilidade"}</h2>
          <p>{entitlements.source === "database" ? "Seu acesso foi calculado a partir da assinatura persistida." : "A plataforma está preservando seu acesso enquanto a camada comercial é finalizada."}</p>
        </article>
      </section>

      <section className="hero" style={{ marginTop: "2rem" }}>
        <p className="eyebrow">MUDAR DE PLANO</p>
        <h2>Escolha sua próxima camada.</h2>
        <div className="actions">
          {(["start", "pro", "business"] as const).map((plan) => (
            <form action="/api/billing/checkout" method="post" key={plan}>
              <input type="hidden" name="plan" value={plan} />
              <button className={plan === "pro" ? "primary" : "secondary"} type="submit">{planCopy[plan].name} · {planCopy[plan].price}</button>
            </form>
          ))}
        </div>
        <p className="lead">Quando o provedor de pagamentos estiver configurado, estes botões abrirão o checkout oficial. Até lá, nenhuma cobrança é iniciada.</p>
      </section>
    </main>
  );
}
