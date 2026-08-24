import Link from "next/link";

const errors: Record<string, string> = {
  invalid: "E-mail ou senha inválidos. Confira seus dados e tente novamente.",
  config: "O login está temporariamente indisponível. A infraestrutura de identidade precisa estar conectada.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string; next?: string; reason?: string }> }) {
  const params = await searchParams;
  const errorMessage = params.error ? errors[params.error] : null;
  const resetSuccess = params.reset === "success";
  const sessionExpired = params.reason === "session";
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">NEYVIX</Link>
        <p className="eyebrow">NEYVIX ID</p>
        <h1>Bem-vindo de volta.</h1>
        <p className="muted">Uma identidade para entrar em todo o ecossistema NEYVIX.</p>

        {resetSuccess ? <p className="legal-copy" role="status"><strong>Senha atualizada com sucesso.</strong> Entre com sua nova senha.</p> : null}
        {sessionExpired ? <p className="legal-copy" role="status">Sua sessão expirou. Entre novamente para continuar de onde parou.</p> : null}
        {errorMessage ? <p className="legal-copy" role="alert">{errorMessage}</p> : null}

        <form className="auth-form" action="/api/auth/login" method="post">
          <input type="hidden" name="next" value={next} />
          <label>E-mail<input type="email" name="email" placeholder="voce@neyvix.com" autoComplete="email" required /></label>
          <label>Senha<input type="password" name="password" placeholder="••••••••" autoComplete="current-password" required /></label>
          <button type="submit" className="primary-button">Continuar</button>
        </form>

        <div className="auth-links">
          <Link href="/reset-password">Redefinir senha</Link><span>·</span><Link href="/register">Criar NEYVIX ID</Link>
        </div>
      </section>
    </main>
  );
}
