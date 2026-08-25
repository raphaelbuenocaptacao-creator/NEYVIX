import Link from "next/link";

const errors: Record<string, string> = {
  invalid: "Revise seu nome, endereço NEYVIX e use uma senha com pelo menos 8 caracteres.",
  taken: "Esse endereço NEYVIX já está em uso. Escolha outro identificador.",
  config: "Não foi possível conectar à identidade NEYVIX agora. Tente novamente em instantes.",
};

const planLabels: Record<string, string> = { start: "Start", pro: "Pro", business: "Business" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string; plan?: string }> }) {
  const params = await searchParams;
  const errorMessage = params.error ? errors[params.error] : null;
  const selectedPlan = params.plan && planLabels[params.plan] ? params.plan : "";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">NEYVIX</Link>
        <p className="eyebrow">CRIAR NEYVIX ID</p>
        <h1>Sua identidade começa aqui.</h1>
        <p className="muted">Uma única conta para entrar no ecossistema NEYVIX.</p>

        {selectedPlan ? <p className="legal-copy"><strong>Plano escolhido: {planLabels[selectedPlan]}</strong><br/>Sua escolha será vinculada ao cadastro e poderá ser confirmada no checkout quando a cobrança automática estiver habilitada.</p> : null}
        {errorMessage ? <p className="legal-copy" role="alert">{errorMessage}</p> : null}

        <form className="auth-form" action="/api/auth/register" method="post">
          {selectedPlan ? <input type="hidden" name="plan" value={selectedPlan} /> : null}
          <label>Nome completo<input type="text" name="name" placeholder="Seu nome" autoComplete="name" minLength={2} required /></label>
          <label>Endereço NEYVIX<div className="address-field"><input type="text" name="handle" placeholder="seunome" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" required /><span>@neyvix.com</span></div></label>
          <label>Senha<input type="password" name="password" minLength={8} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" required /></label>
          <button type="submit" className="primary-button">Criar meu NEYVIX ID</button>
        </form>

        <p className="legal-copy">Seu NEYVIX ID protege o acesso aos produtos, histórico e assinatura do ecossistema.</p>
        <div className="auth-links"><Link href="/login">Já tenho um NEYVIX ID</Link><Link href="/plans">Comparar planos</Link></div>
      </section>
    </main>
  );
}
