import Link from "next/link";

const messages: Record<string, string> = {
  invalid: "Não foi possível redefinir a senha. Confira o e-mail e tente novamente.",
  success: "Senha atualizada. Agora você já pode entrar com a nova senha.",
  mismatch: "As senhas não coincidem.",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const message = params.status ? messages[params.status] : null;
  return (
    <main className="auth-shell"><section className="auth-card">
      <Link href="/" className="brand">NEYVIX</Link>
      <p className="eyebrow">NEYVIX ID · SEGURANÇA</p>
      <h1>Redefinir senha.</h1>
      <p className="muted">Use o e-mail da sua conta e defina uma nova senha. A atualização acontece no servidor e a senha nunca é salva no código.</p>
      {message ? <p className="legal-copy" role="alert">{message}</p> : null}
      <form className="auth-form" action="/api/auth/reset-password" method="post">
        <label>E-mail<input type="email" name="email" autoComplete="email" required /></label>
        <label>Nova senha<input type="password" name="password" minLength={10} autoComplete="new-password" required /></label>
        <label>Confirmar nova senha<input type="password" name="confirmPassword" minLength={10} autoComplete="new-password" required /></label>
        <button type="submit" className="primary-button">Atualizar minha senha</button>
      </form>
      <p className="legal-copy">Por segurança, a redefinição direta só é permitida para a conta administrativa autorizada enquanto o serviço de recuperação por e-mail não estiver ativo.</p>
      <div className="auth-links"><Link href="/login">Voltar ao login</Link></div>
    </section></main>
  );
}
