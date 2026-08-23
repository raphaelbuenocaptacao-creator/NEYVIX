import Link from "next/link";

const orbit = [
  ["AI", "/ai", "Think"],
  ["Studio", "/studio", "Build"],
  ["Content", "/content", "Create"],
  ["Mail", "/mail", "Connect"],
  ["Deploy", "/deploy", "Ship"],
  ["Admin", "/admin", "Control"],
];

export default function Home() {
  return (
    <main className="experience-shell">
      <section className="experience-hero">
        <nav className="experience-nav">
          <Link href="/" className="brand-lockup">NEYVIX</Link>
          <div className="nav-actions">
            <Link href="/ecosystem">Ecosystem</Link>
            <Link href="/login">Sign in</Link>
            <Link className="nav-cta" href="/register">Create NEYVIX ID</Link>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <div className="live-pill"><span /> NEYVIX CORE ONLINE</div>
            <p className="eyebrow">ONE ID. ONE INTELLIGENCE. ONE ECOSYSTEM.</p>
            <h1>Your digital world, finally working as one.</h1>
            <p className="lead">
              Identity, AI, creation, communication and deployment connected by a single intelligent layer.
            </p>
            <div className="actions">
              <Link className="primary hero-primary" href="/register">Enter NEYVIX</Link>
              <Link className="secondary" href="/ecosystem">Explore the ecosystem</Link>
            </div>
            <div className="hero-signals">
              <div><strong>1</strong><span>Identity</span></div>
              <div><strong>1</strong><span>Command center</span></div>
              <div><strong>∞</strong><span>Ways to build</span></div>
            </div>
          </div>

          <div className="ecosystem-orbit" aria-label="NEYVIX ecosystem map">
            <div className="orbit-glow" />
            <div className="core-sphere"><span>N</span><small>CORE</small></div>
            {orbit.map(([name, href, action], index) => (
              <Link
                key={name}
                href={href}
                className={`orbit-node orbit-node-${index + 1}`}
              >
                <small>{action}</small>
                <strong>{name}</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="experience-section">
        <div className="section-heading">
          <p className="eyebrow">THE OPERATING LAYER</p>
          <h2>Ask once. NEYVIX coordinates the rest.</h2>
        </div>
        <div className="command-preview">
          <div className="command-topline"><span className="command-dot" /> Command Center</div>
          <div className="command-input">“Create a launch campaign, generate the content and prepare the app.”</div>
          <div className="command-flow">
            <span>AI understands</span><i>→</i><span>Studio builds</span><i>→</i><span>Content creates</span><i>→</i><span>Deploy ships</span>
          </div>
        </div>
      </section>

      <section className="experience-section product-showcase">
        <div className="section-heading">
          <p className="eyebrow">CONNECTED PRODUCTS</p>
          <h2>One account. Every capability.</h2>
        </div>
        <div className="premium-grid">
          {[
            ["NEYVIX AI", "Your intelligence layer for thinking, planning and execution.", "/ai"],
            ["NEYVIX Studio", "Turn a prompt into a product blueprint and a build plan.", "/studio"],
            ["NEYVIX Content", "Create campaigns, posts, scripts, ads and launch material.", "/content"],
            ["NEYVIX Mail", "Communication connected to the same identity and workspace.", "/mail"],
            ["NEYVIX Deploy", "Projects, releases and future cloud orchestration.", "/deploy"],
            ["NEYVIX Admin", "Operate users, access, usage and the health of the ecosystem.", "/admin"],
          ].map(([name, description, href], index) => (
            <Link href={href} className="premium-card" key={name}>
              <div className="card-index">0{index + 1}</div>
              <div>
                <h3>{name}</h3>
                <p>{description}</p>
              </div>
              <span className="card-arrow">↗</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
