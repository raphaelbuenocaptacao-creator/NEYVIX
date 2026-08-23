import Link from "next/link";

const messages: Record<string, string> = {
  invalid: "O link de redefinição é inválido, expirou ou já foi utilizado.",
  success: "Senha atualizada. Agora você já pode entrar com a nova senha.",
  mismatch: "As senhas não coincidem.",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ status?: string; token?: string }> }) {
  const params = await searchParams;
  const message = params.status ? messages[params.status] : null;
  const token = params.token?.trim() ?? "";
  const ready = token.length >= 20;

  return (
    <main className="auth-shell"><section className="auth-card">
      <Link href="/" className="brand">NEYVIX</Link>
      <p className="eyebrow">NEYVIX ID · SEGURANÇA</p>
      <h1>Redefinir senha.</h1>
      <p className="muted">Defina sua nova senha usando um link de redefinição válido. O token é de uso único e expira automaticamente.</p>
      {message ? <p className="legal-copy" role="alert">{message}</p> : null}
      {ready ? (
        <form className="auth-form" action="/api/auth/reset-password" method="post">
          <input type="hidden" name="token" value={token} />
          <label>Nova senha<input type="password" name="password" minLength={10} autoComplete="new-password" required /></label>
          <label>Confirmar nova senha<input type="password" name="confirmPassword" minLength={10} autoComplete="new-password" required /></label>
          <button type="submit" className="primary-button">Atualizar minha senha</button>
        </form>
      ) : <p className="legal-copy">Abra esta página pelo link seguro de redefinição fornecido para sua conta.</p>}
      <p className="legal-copy">A senha é processada somente no servidor e armazenada como hash protegido. O token é invalidado imediatamente após o uso.</p>
      <div className="auth-links"><Link href="/login">Voltar ao login</Link></div>
    </section></main>
  );
}
