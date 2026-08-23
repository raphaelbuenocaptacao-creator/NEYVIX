import Link from "next/link";

const plans = [
  { name: "Start", price: "R$ 49", suffix: "/mês", description: "Para profissionais que querem começar a produzir com a NEYVIX.", features: ["NEYVIX AI", "Content", "Studio", "PWA", "Histórico do workspace"], cta: "Começar" },
  { name: "Pro", price: "R$ 99", suffix: "/mês", description: "Para quem usa a NEYVIX no trabalho todos os dias.", features: ["Tudo do Start", "Automation", "Estate", "Mais capacidade de uso", "Publicação de projetos"], cta: "Escolher Pro", featured: true },
  { name: "Business", price: "R$ 249", suffix: "/mês", description: "Para pequenas empresas e operações que precisam de gestão.", features: ["Tudo do Pro", "Admin / User 360", "Aprovações", "Mail", "Estrutura para equipe"], cta: "Escolher Business" },
];

export default function PlansPage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">NEYVIX <span>PLANS</span></div>
        <p className="eyebrow">PLANOS DO ECOSSISTEMA</p>
        <h1>Uma assinatura. Um ecossistema inteiro.</h1>
        <p className="lead">Escolha a camada que combina com seu momento. Os valores abaixo definem nossa oferta comercial inicial; a cobrança automática será habilitada quando o provedor de pagamentos estiver conectado.</p>
        <div className="actions"><Link className="primary" href="/register">Criar NEYVIX ID</Link><Link className="secondary" href="/dashboard">Central de Comando</Link></div>
      </section>

      <section className="grid">
        {plans.map((plan) => (
          <article key={plan.name} style={plan.featured ? { borderColor: "rgba(66, 187, 255, .65)" } : undefined}>
            <span>{plan.featured ? "RECOMENDADO" : "NEYVIX"}</span>
            <h2>{plan.name}</h2>
            <p><strong style={{ fontSize: "1.6rem" }}>{plan.price}</strong> {plan.suffix}</p>
            <p>{plan.description}</p>
            <p>{plan.features.join(" · ")}</p>
            <Link className="secondary" href="/register">{plan.cta}</Link>
          </article>
        ))}
      </section>

      <section className="hero" style={{ marginTop: "2rem" }}>
        <p className="eyebrow">NEYVIX ESTATE</p>
        <h2>Oferta especializada para imobiliárias.</h2>
        <p className="lead">O Estate poderá ser vendido como adicional ou produto independente, com site imobiliário, catálogo de imóveis, WhatsApp, publicação e domínio personalizado.</p>
        <div className="actions"><Link className="primary" href="/estate">Conhecer Estate</Link></div>
      </section>
    </main>
  );
}
