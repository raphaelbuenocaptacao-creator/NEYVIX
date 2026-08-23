import Link from "next/link";

const orbit = [
  ["IA", "/ai", "PENSAR"], ["Studio", "/studio", "CONSTRUIR"], ["Content", "/content", "CRIAR"],
  ["Automation", "/automation", "AUTOMATIZAR"], ["Estate", "/estate", "VENDER"], ["Mail", "/mail", "CONECTAR"],
];

export default function Home() {
  return (
    <main className="experience-shell visual-v3">
      <section className="experience-hero v3-hero">
        <div className="aurora aurora-a"/><div className="aurora aurora-b"/><div className="v3-noise"/>
        <nav className="experience-nav v3-nav">
          <Link href="/" className="brand-lockup">NEYVIX<span className="brand-pulse"/></Link>
          <div className="nav-center"><span>UNIVERSO DIGITAL</span><i/><span>CORE 01</span></div>
          <div className="nav-actions"><Link href="/ecosystem">Ecossistema</Link><Link href="/plans">Planos</Link><Link href="/login">Entrar</Link><Link className="nav-cta" href="/register">Early Access</Link></div>
        </nav>

        <div className="hero-grid v3-grid">
          <div className="hero-copy v3-copy">
            <div className="live-pill"><span/> EARLY ACCESS · INTELIGÊNCIA ATIVA</div>
            <p className="eyebrow">UMA IDENTIDADE · UMA INTELIGÊNCIA · UM UNIVERSO</p>
            <h1><span>Não use</span><br/>tecnologia.<br/><em>Comande-a.</em></h1>
            <p className="lead">Diga o que você quer fazer. A NEYVIX conecta inteligência, criação e execução para transformar intenção em trabalho pronto.</p>
            <div className="actions"><Link className="primary hero-primary" href="/register">Quero acesso <b>↗</b></Link><Link className="secondary" href="/estate">Ver Estate</Link></div>
            <div className="v3-manifesto"><span>01</span><p>Você pede.</p><span>02</span><p>A NEYVIX coordena.</p><span>03</span><p>O ecossistema executa.</p></div>
          </div>

          <div className="ecosystem-orbit v3-orbit" aria-label="Mapa do ecossistema NEYVIX">
            <div className="orbit-halo halo-one"/><div className="orbit-halo halo-two"/><div className="orbit-glow"/>
            <div className="core-sphere v3-core"><div className="core-eye"><i/><i/></div><span>N</span><small>NEYVIX CORE</small></div>
            {orbit.map(([name, href, action], index) => <Link key={name} href={href} className={`orbit-node orbit-node-${index + 1}`}><small>{action}</small><strong>{name}</strong><b>↗</b></Link>)}
            <div className="core-caption"><i/><span>SISTEMA VIVO</span><strong>Uma intenção. Vários módulos em movimento.</strong></div>
          </div>
        </div>
      </section>

      <section className="experience-section v3-section">
        <div className="section-heading"><p className="eyebrow">VEJA A IDEIA</p><h2>Você pede uma coisa.<br/><em>O ecossistema inteiro se move.</em></h2></div>
        <div className="command-preview v3-command"><div className="command-topline"><span className="command-dot"/> NEYVIX COMMAND <small>ENTENDA · CRIE · EXECUTE</small></div><div className="command-input"><span>›</span> “Quero lançar uma imobiliária digital e começar a captar clientes.”<i/></div><div className="command-flow"><span><b>01</b> AI planeja</span><i>→</i><span><b>02</b> Estate cria o site</span><i>→</i><span><b>03</b> Content cria a campanha</span><i>→</i><span><b>04</b> Automation organiza o fluxo</span></div></div>
      </section>

      <section className="experience-section product-showcase v3-products">
        <div className="section-heading"><p className="eyebrow">NEYVIX UNIVERSE</p><h2>Não são ferramentas soltas.<br/><em>É um sistema de trabalho.</em></h2></div>
        <div className="premium-grid">
          {[["NEYVIX AI","Pense, planeje e transforme intenção em ação.","/ai"],["NEYVIX Studio","Transforme uma ideia em arquitetura e produto.","/studio"],["NEYVIX Content","Campanhas, conteúdo e comunicação em um só fluxo.","/content"],["NEYVIX Automation","Crie fluxos e mantenha ações sensíveis sob aprovação.","/automation"],["NEYVIX Estate","Crie e publique sites profissionais para o mercado imobiliário.","/estate"],["NEYVIX Mail","Sua comunicação ligada à mesma identidade.","/mail"]].map(([name,description,href],index)=><Link href={href} className="premium-card v3-card" key={name}><div className="card-index">0{index+1}</div><div><small>MÓDULO NEYVIX</small><h3>{name}</h3><p>{description}</p></div><span className="card-arrow">↗</span></Link>)}
        </div>
      </section>

      <section className="experience-section v3-section">
        <div className="section-heading"><p className="eyebrow">PRIMEIROS USUÁRIOS</p><h2>Entre antes.<br/><em>Ajude a construir o próximo estágio.</em></h2></div>
        <div className="command-preview v3-command"><div className="command-topline"><span className="command-dot"/> NEYVIX FOUNDERS <small>EARLY ACCESS</small></div><div className="command-input"><span>›</span> Acesso antecipado ao ecossistema e às novas experiências conforme forem liberadas.<i/></div><div className="actions" style={{ marginTop: "1.5rem" }}><Link className="primary" href="/register">Criar meu NEYVIX ID</Link><Link className="secondary" href="/plans">Conhecer planos</Link></div></div>
      </section>

      <footer className="v3-footer"><strong>NEYVIX</strong><span>Não use tecnologia. Comande-a.</span><i>CORE ONLINE</i></footer>
    </main>
  );
}
