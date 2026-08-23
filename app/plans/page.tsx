import Link from "next/link";

const plans = [
  { name: "Start", price: "R$ 49", suffix: "/mês", description: "Para começar a produzir com a inteligência e as ferramentas criativas da NEYVIX.", features: ["NEYVIX AI", "Content", "Studio", "PWA", "Histórico do workspace"], cta: "Quero o Start" },
  { name: "Pro", price: "R$ 99", suffix: "/mês", description: "Para profissionais que querem sair da ideia e chegar à execução dentro do mesmo ecossistema.", features: ["Tudo do Start", "Automation", "Estate", "Mais capacidade de uso", "Publicação de projetos"], cta: "Quero o Pro", featured: true },
  { name: "Business", price: "R$ 249", suffix: "/mês", description: "Para operações e pequenas empresas que precisam de gestão, equipe e controle.", features: ["Tudo do Pro", "Admin / User 360", "Aprovações", "Mail", "Estrutura para equipe"], cta: "Quero o Business" },
];

export default function PlansPage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">NEYVIX <span>FOUNDERS</span></div>
        <p className="eyebrow">EARLY ACCESS</p>
        <h1>Entre antes. Construa mais rápido.</h1>
        <p className="lead">Os primeiros usuários entram no ecossistema enquanto novas capacidades são liberadas. Crie seu NEYVIX ID e experimente a plataforma; a cobrança automática será ativada quando o checkout estiver conectado.</p>
        <div className="actions"><Link className="primary" href="/register">Quero meu acesso</Link><Link className="secondary" href="/dashboard">Já tenho NEYVIX ID</Link></div>
      </section>

      <section className="grid">
        {plans.map((plan) => (
          <article key={plan.name} style={plan.featured ? { borderColor: "rgba(66, 187, 255, .65)" } : undefined}>
            <span>{plan.featured ? "MAIS COMPLETO PARA COMEÇAR" : "NEYVIX"}</span>
            <h2>{plan.name}</h2>
            <p><strong style={{ fontSize: "1.6rem" }}>{plan.price}</strong> {plan.suffix}</p>
            <p>{plan.description}</p>
            <p>{plan.features.join(" · ")}</p>
            <Link className="secondary" href={`/register?plan=${plan.name.toLowerCase()}`}>{plan.cta}</Link>
          </article>
        ))}
      </section>

      <section className="hero" style={{ marginTop: "2rem" }}>
        <p className="eyebrow">PRODUTO-VITRINE</p>
        <h2>NEYVIX Estate: uma demonstração que o cliente entende em segundos.</h2>
        <p className="lead">O corretor ou a imobiliária informa sua marca, imóveis e contato. O Estate organiza essas informações em uma presença digital pronta para divulgação, conectada ao restante do ecossistema.</p>
        <div className="actions"><Link className="primary" href="/estate">Experimentar Estate</Link><Link className="secondary" href="/register?plan=pro">Entrar no Pro</Link></div>
      </section>

      <section className="hero" style={{ marginTop: "2rem" }}>
        <p className="eyebrow">COMO A NEYVIX PENSA</p>
        <h2>Uma intenção pode movimentar vários produtos.</h2>
        <p className="lead">AI ajuda a planejar. Studio estrutura. Content cria a comunicação. Estate transforma a operação imobiliária em presença digital. Automation organiza o fluxo. A proposta não é vender ferramentas isoladas — é reduzir o caminho entre ideia e execução.</p>
      </section>
    </main>
  );
}
