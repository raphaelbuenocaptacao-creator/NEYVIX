import Link from "next/link";

const errors: Record<string, string> = {
  invalid: "E-mail ou senha inválidos. Confira seus dados e tente novamente.",
  config: "O login está temporariamente indisponível. A infraestrutura de identidade precisa estar conectada.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const errorMessage = params.error ? errors[params.error] : null;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">NEYVIX</Link>
        <p className="eyebrow">NEYVIX ID</p>
        <h1>Bem-vindo de volta.</h1>
        <p className="muted">Uma identidade para o Mail e todo o ecossistema NEYVIX.</p>

        {errorMessage ? <p className="legal-copy" role="alert">{errorMessage}</p> : null}

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
