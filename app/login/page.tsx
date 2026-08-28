import Link from "next/link";

const errors: Record<string, string> = {
  invalid: "E-mail ou senha inválidos. Confira seus dados e tente novamente.",
  config: "Não foi possível conectar à identidade NEYVIX agora. Tente novamente em instantes.",
  rate_limit: "Muitas tentativas de login foram feitas em pouco tempo. Aguarde alguns minutos e tente novamente.",
};

const magicMessages: Record<string, string> = {
  sent: "Se a conta existir e o transporte de e-mail estiver disponível, o link mágico foi enviado.",
  unavailable: "O envio de link mágico ainda não está disponível agora. Use sua senha para entrar.",
  invalid: "Informe um e-mail válido para receber o link mágico.",
  rate_limit: "Muitas solicitações de link mágico foram feitas. Aguarde alguns minutos e tente novamente.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string; next?: string; reason?: string; magic?: string }> }) {
  const params = await searchParams;
  const errorMessage = params.error ? errors[params.error] : null;
  const magicMessage = params.magic ? magicMessages[params.magic] : null;
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
        {magicMessage ? <p className="legal-copy" role={params.magic === "sent" ? "status" : "alert"}>{magicMessage}</p> : null}

        <form className="auth-form" action="/api/auth/login" method="post">
          <input type="hidden" name="next" value={next} />
          <label>E-mail<input type="email" name="email" placeholder="voce@neyvix.com" autoComplete="email" required /></label>
          <label>Senha<input type="password" name="password" placeholder="••••••••" autoComplete="current-password" required /></label>
          <button type="submit" className="primary-button">Continuar</button>
        </form>

        <p className="legal-copy"><strong>Ou entre sem senha.</strong> O link é válido por 10 minutos e pode ser usado uma única vez.</p>
        <form className="auth-form" action="/api/auth/magic-login/request" method="post">
          <label>E-mail para link mágico<input type="email" name="email" placeholder="voce@neyvix.com" autoComplete="email" required /></label>
          <button type="submit" className="primary-button">Enviar link mágico</button>
        </form>

        <div className="auth-links">
          <Link href="/reset-password">Redefinir senha</Link><span>·</span><Link href="/register">Criar NEYVIX ID</Link>
        </div>
      </section>
    </main>
  );
}
