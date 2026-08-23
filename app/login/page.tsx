import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">NEYVIX</Link>
        <p className="eyebrow">NEYVIX ID</p>
        <h1>Bem-vindo de volta.</h1>
        <p className="muted">Uma identidade para o Mail e todo o ecossistema NEYVIX.</p>

        <form className="auth-form" action="/api/auth/login" method="post">
          <label>
            E-mail
            <input type="email" name="email" placeholder="voce@neyvix.com" autoComplete="email" required />
          </label>
          <label>
            Senha
            <input type="password" name="password" placeholder="••••••••" autoComplete="current-password" required />
          </label>
          <button type="submit" className="primary-button">Continuar</button>
        </form>

        <div className="auth-links">
          <span className="muted">A recuperação de senha será habilitada na camada de identidade de produção.</span>
          <span>·</span>
          <Link href="/register">Criar NEYVIX ID</Link>
        </div>
      </section>
    </main>
  );
}
