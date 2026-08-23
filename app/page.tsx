import Link from "next/link";

const orbit = [
  ["IA", "/ai", "PENSAR"],
  ["Studio", "/studio", "CONSTRUIR"],
  ["Content", "/content", "CRIAR"],
  ["Mail", "/mail", "CONECTAR"],
  ["Deploy", "/deploy", "PUBLICAR"],
  ["Admin", "/admin", "CONTROLAR"],
];

export default function Home() {
  return (
    <main className="experience-shell visual-v3">
      <section className="experience-hero v3-hero">
        <div className="aurora aurora-a"/><div className="aurora aurora-b"/><div className="v3-noise"/>
        <nav className="experience-nav v3-nav">
          <Link href="/" className="brand-lockup">NEYVIX<span className="brand-pulse"/></Link>
          <div className="nav-center"><span>UNIVERSO DIGITAL</span><i/><span>CORE 01</span></div>
          <div className="nav-actions">
            <Link href="/ecosystem">Ecossistema</Link>
            <Link href="/login">Entrar</Link>
            <Link className="nav-cta" href="/register">Criar NEYVIX ID</Link>
          </div>
        </nav>

        <div className="hero-grid v3-grid">
          <div className="hero-copy v3-copy">
            <div className="live-pill"><span/> INTELIGÊNCIA ATIVA</div>
            <p className="eyebrow">UMA IDENTIDADE · UMA INTELIGÊNCIA · UM UNIVERSO</p>
            <h1><span>Não use</span><br/>tecnologia.<br/><em>Comande-a.</em></h1>
            <p className="lead">A NEYVIX conecta identidade, inteligência, criação e execução em uma única experiência viva.</p>
            <div className="actions">
              <Link className="primary hero-primary" href="/register">Entrar no universo <b>↗</b></Link>
              <Link className="secondary" href="/ecosystem">Explorar ecossistema</Link>
            </div>
            <div className="v3-manifesto"><span>01</span><p>Você imagina.</p><span>02</span><p>A NEYVIX entende.</p><span>03</span><p>O sistema executa.</p></div>
          </div>

          <div className="ecosystem-orbit v3-orbit" aria-label="Mapa do ecossistema NEYVIX">
            <div className="orbit-halo halo-one"/><div className="orbit-halo halo-two"/><div className="orbit-glow"/>
            <div className="core-sphere v3-core"><div className="core-eye"><i/><i/></div><span>N</span><small>NEYVIX CORE</small></div>
            {orbit.map(([name, href, action], index) => <Link key={name} href={href} className={`orbit-node orbit-node-${index + 1}`}><small>{action}</small><strong>{name}</strong><b>↗</b></Link>)}
            <div className="core-caption"><i/><span>SISTEMA VIVO</span><strong>Todos os módulos conectados</strong></div>
          </div>
        </div>
      </section>

      <section className="experience-section v3-section">
        <div className="section-heading"><p className="eyebrow">CAMADA DE COMANDO</p><h2>Uma intenção.<br/><em>Todo o sistema se move.</em></h2></div>
        <div className="command-preview v3-command">
          <div className="command-topline"><span className="command-dot"/> NEYVIX COMMAND <small>ESCUTE · ENTENDA · EXECUTE</small></div>
          <div className="command-input"><span>›</span> “Crie minha campanha, construa o produto e prepare tudo para publicar.”<i/></div>
          <div className="command-flow"><span><b>01</b> IA interpreta</span><i>→</i><span><b>02</b> Studio constrói</span><i>→</i><span><b>03</b> Content cria</span><i>→</i><span><b>04</b> Deploy publica</span></div>
        </div>
      </section>

      <section className="experience-section product-showcase v3-products">
        <div className="section-heading"><p className="eyebrow">NEYVIX UNIVERSE</p><h2>Produtos diferentes.<br/><em>Uma só inteligência.</em></h2></div>
        <div className="premium-grid">
          {[["NEYVIX AI","Pense, planeje e transforme intenção em ação.","/ai"],["NEYVIX Studio","Transforme uma ideia em arquitetura e produto.","/studio"],["NEYVIX Content","Campanhas, conteúdo e comunicação em um só fluxo.","/content"],["NEYVIX Mail","Sua comunicação ligada à mesma identidade.","/mail"],["NEYVIX Deploy","Do código à publicação sem quebrar o fluxo.","/deploy"],["NEYVIX Admin","Veja usuários, inteligência, atividade e operação.","/admin"]].map(([name,description,href],index)=><Link href={href} className="premium-card v3-card" key={name}><div className="card-index">0{index+1}</div><div><small>MÓDULO NEYVIX</small><h3>{name}</h3><p>{description}</p></div><span className="card-arrow">↗</span></Link>)}
        </div>
      </section>

      <footer className="v3-footer"><strong>NEYVIX</strong><span>O seu universo digital começa aqui.</span><i>CORE ONLINE</i></footer>
    </main>
  );
}
